"""Multiplayer state model.

Deliberate changes from v1
--------------------------
* **Players are keyed by ``id``, not by name.** v1 matched on ``player["name"]``
  in ``leave_lobby``, the ready toggle, the avatar update, both answer paths and
  the room-join session stamping -- so any client could act as another player
  just by sending their name, and two players with whitespace-variant names
  collided.
* **Answers are a dict keyed by question index**, so a resubmission overwrites
  rather than appending. v1 appended unconditionally and added to the score each
  time, so replaying ``submit_answer`` multiplied your score.
* **One answer shape.** v1 had two mutually incompatible ones -- the socket path
  wrote ``{question_index, answer, is_correct, score, time_taken}`` and the REST
  path wrote ``{question, userAnswer, correctAnswer, isCorrect, score}`` -- while
  the results UI expected the second and the client only ever produced the first.
* **Scores are computed here from server-measured time.** v1 trusted a
  client-supplied ``score`` and ``is_correct``.
* ``connected`` is tracked so a dropped player cannot deadlock the round. v1's
  "have all players answered?" check counted every player in the lobby and its
  disconnect handler removed nobody, so one closed tab froze the game forever.
* Settings are a validated model rather than an arbitrary dict. v1 copied every
  key from the request body into the lobby with no whitelist and no range check,
  leaving ``numQuestions`` unbounded server-side.
"""

from __future__ import annotations

import secrets
import threading
import time
from dataclasses import dataclass, field
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator

from api.models.quiz import Difficulty, Question

# Unambiguous alphabet: no O/0, I/1, S/5, so spoken codes survive a phone call.
_CODE_ALPHABET = "ABCDEFGHJKLMNPQRTUVWXYZ2346789"
CODE_LENGTH = 6

DEFAULT_AVATAR = "\N{GRINNING FACE}"

DIFFICULTY_MULTIPLIER: dict[Difficulty, float] = {
    Difficulty.EASY: 0.8,
    Difficulty.MEDIUM: 1.0,
    Difficulty.HARD: 1.5,
}

# Grace window added to the server deadline to absorb network latency, so a
# player who answered just in time locally isn't punished for their ping.
ANSWER_GRACE_MS = 750

# How long the correct answer is shown before the next question.
REVEAL_MS = 3000


class GameState(str, Enum):
    """Lobby lifecycle states."""

    LOBBY = "lobby"
    QUESTION = "question"
    REVEAL = "reveal"
    GAME_OVER = "game_over"


def generate_lobby_code() -> str:
    """Return a random lobby code."""
    return "".join(secrets.choice(_CODE_ALPHABET) for _ in range(CODE_LENGTH))


def now_ms() -> int:
    """Current wall-clock time in milliseconds."""
    return int(time.time() * 1000)


class LobbySettings(BaseModel):
    """Host-configurable game settings, validated and range-checked."""

    model_config = ConfigDict(extra="ignore", validate_assignment=True)

    num_questions: int = Field(default=10, ge=1, le=30)
    difficulty: Difficulty = Difficulty.MEDIUM
    time_per_question: int = Field(default=15, ge=5, le=60)
    include_images: bool = False
    topic: str | None = None
    category: str | None = None
    model: str | None = None

    @field_validator("difficulty", mode="before")
    @classmethod
    def _parse_difficulty(cls, value: object) -> object:
        """Accept any casing plus 'mixed'/'any'; reject anything else."""
        return Difficulty.parse(value, default=Difficulty.MEDIUM)

    @field_validator("topic", "category", "model", mode="before")
    @classmethod
    def _blank_to_none(cls, value: object) -> object:
        """Treat blank strings as absent."""
        if isinstance(value, str):
            return value.strip()[:120] or None
        return value

    def as_client_dict(self) -> dict[str, object]:
        """camelCase view for the browser."""
        return {
            "numQuestions": self.num_questions,
            "difficulty": self.difficulty.value,
            "timePerQuestion": self.time_per_question,
            "includeImages": self.include_images,
            "topic": self.topic,
            "category": self.category,
            "model": self.model,
        }

    @classmethod
    def from_client(cls, payload: object) -> "LobbySettings":
        """Build from a camelCase client payload, ignoring unknown keys."""
        if not isinstance(payload, dict):
            return cls()
        mapping = {
            "numQuestions": "num_questions",
            "num_questions": "num_questions",
            "difficulty": "difficulty",
            "timePerQuestion": "time_per_question",
            "time_per_question": "time_per_question",
            "includeImages": "include_images",
            "include_images": "include_images",
            "topic": "topic",
            "category": "category",
            "model": "model",
        }
        cleaned: dict[str, object] = {}
        for key, value in payload.items():
            target = mapping.get(str(key))
            if target is not None:
                cleaned[target] = value
        return cls.model_validate(cleaned)


@dataclass
class Answer:
    """One player's answer to one question."""

    question_index: int
    selected_index: int | None
    is_correct: bool
    points: int
    elapsed_ms: int
    timed_out: bool = False

    def as_client_dict(self) -> dict[str, object]:
        """Serialise for the browser."""
        return {
            "questionIndex": self.question_index,
            "selectedIndex": self.selected_index,
            "isCorrect": self.is_correct,
            "points": self.points,
            "elapsedMs": self.elapsed_ms,
            "timedOut": self.timed_out,
        }


@dataclass
class Player:
    """A participant in a lobby."""

    id: str
    name: str
    avatar: str = DEFAULT_AVATAR
    is_host: bool = False
    ready: bool = False
    connected: bool = True
    session_id: str | None = None
    score: int = 0
    answers: dict[int, Answer] = field(default_factory=dict)
    joined_at: int = field(default_factory=now_ms)

    @property
    def correct_count(self) -> int:
        """How many questions this player got right."""
        return sum(1 for answer in self.answers.values() if answer.is_correct)

    @property
    def total_time_ms(self) -> int:
        """Total time spent answering, used as a tie-breaker."""
        return sum(answer.elapsed_ms for answer in self.answers.values())

    def has_answered(self, question_index: int) -> bool:
        """Whether this player already answered the given question."""
        return question_index in self.answers

    def as_client_dict(self, *, include_answers: bool = False) -> dict[str, object]:
        """Serialise for the browser."""
        payload: dict[str, object] = {
            "id": self.id,
            "name": self.name,
            "avatar": self.avatar,
            "isHost": self.is_host,
            "ready": self.ready,
            "connected": self.connected,
            "score": self.score,
            "correctCount": self.correct_count,
            "answeredCount": len(self.answers),
        }
        if include_answers:
            payload["answers"] = [
                answer.as_client_dict()
                for answer in sorted(self.answers.values(), key=lambda a: a.question_index)
            ]
        return payload


@dataclass
class Lobby:
    """A single game room.

    Guarded by its own :attr:`lock` rather than one process-wide lock. v1 held a
    single global ``lobbies_lock`` across the entire quiz generation -- an LLM
    call plus one image crawl per image question -- freezing every other lobby's
    joins, ready toggles and answers for the duration.
    """

    code: str
    host_id: str
    players: dict[str, Player] = field(default_factory=dict)
    settings: LobbySettings = field(default_factory=LobbySettings)
    state: GameState = GameState.LOBBY
    questions: list[Question] = field(default_factory=list)
    current_index: int = -1
    # Tracked separately from ``state`` because the two answer different
    # questions. ``state`` is the instantaneous phase; ``started`` means "the
    # quiz has been generated and play has begun", which is what a client needs
    # in order to navigate. Deriving it from ``state`` made the ``game:started``
    # payload report ``started: false``, since the state only flips to QUESTION
    # once the first round actually opens.
    started: bool = False
    question_started_ms: int = 0
    deadline_ms: int = 0
    round_token: int = 0
    created_ms: int = field(default_factory=now_ms)
    last_activity_ms: int = field(default_factory=now_ms)
    generating: bool = False
    lock: threading.RLock = field(default_factory=threading.RLock, repr=False)

    def touch(self) -> None:
        """Mark the lobby as recently active."""
        self.last_activity_ms = now_ms()

    @property
    def host(self) -> Player | None:
        """The current host, if still present."""
        return self.players.get(self.host_id)

    @property
    def connected_players(self) -> list[Player]:
        """Players currently holding a live socket."""
        return [p for p in self.players.values() if p.connected]

    @property
    def current_question(self) -> Question | None:
        """The question in play, if any."""
        if 0 <= self.current_index < len(self.questions):
            return self.questions[self.current_index]
        return None

    @property
    def is_last_question(self) -> bool:
        """Whether the current question is the final one."""
        return self.current_index >= len(self.questions) - 1

    def ordered_players(self) -> list[Player]:
        """Players ranked for the scoreboard.

        Deterministic tie-breaking, which v1 lacked entirely: it sorted on score
        alone, so equal scores came out in arbitrary array order. ``elapsed_ms``
        was recorded but never used.
        """
        return sorted(
            self.players.values(),
            key=lambda p: (-p.score, -p.correct_count, p.total_time_ms, p.name.casefold()),
        )

    def everyone_answered(self) -> bool:
        """Whether every connected player has answered the current question.

        Disconnected players are excluded, so one dropped tab cannot stall the
        round the way it did in v1.
        """
        if self.current_index < 0:
            return False
        active = self.connected_players
        if not active:
            return False
        return all(p.has_answered(self.current_index) for p in active)

    def score_answer(self, *, selected_index: int | None, elapsed_ms: int) -> tuple[bool, int]:
        """Grade an answer and award points, entirely server-side.

        Points are the whole seconds remaining scaled by difficulty -- v1's
        concept, but computed from the server's own clock instead of a
        client-reported ``time_taken`` and a client-reported ``score``.
        """
        question = self.current_question
        if question is None or selected_index is None:
            return False, 0
        if not question.is_correct(selected_index):
            return False, 0

        limit_ms = self.settings.time_per_question * 1000
        remaining_ms = max(0, limit_ms - max(0, elapsed_ms))
        multiplier = DIFFICULTY_MULTIPLIER.get(question.difficulty, 1.0)
        points = round((remaining_ms / 1000) * multiplier)
        # A correct answer is always worth something, even at the buzzer.
        return True, max(1, points)

    def max_points_per_question(self) -> int:
        """Ceiling for one question, used for progress bars.

        v1's equivalent ignored the difficulty multiplier, so hard-mode bars
        overflowed past 100%.
        """
        multiplier = max(DIFFICULTY_MULTIPLIER.values())
        if self.questions:
            multiplier = DIFFICULTY_MULTIPLIER.get(self.questions[0].difficulty, 1.0)
        return max(1, round(self.settings.time_per_question * multiplier))

    def as_lobby_dict(self) -> dict[str, object]:
        """Snapshot for the lobby screen."""
        return {
            "lobbyCode": self.code,
            "hostId": self.host_id,
            "state": self.state.value,
            "started": self.started,
            "generating": self.generating,
            "settings": self.settings.as_client_dict(),
            "players": [p.as_client_dict() for p in self.ordered_players()],
            "questionCount": len(self.questions),
        }

    def as_game_dict(self) -> dict[str, object]:
        """Snapshot for the in-game screen.

        Includes ``settings`` -- v1's ``GET /game/<code>`` omitted them, so a
        page reload silently reset ``timePerQuestion`` to 15 and difficulty to
        medium, giving that player a different timer and score multiplier from
        everyone else.
        """
        question = self.current_question
        return {
            "lobbyCode": self.code,
            "hostId": self.host_id,
            "state": self.state.value,
            "settings": self.settings.as_client_dict(),
            "players": [p.as_client_dict() for p in self.ordered_players()],
            "questionIndex": self.current_index,
            "questionCount": len(self.questions),
            "maxPointsPerQuestion": self.max_points_per_question(),
            "question": _public_question(question) if question else None,
            "deadlineMs": self.deadline_ms,
            "serverNowMs": now_ms(),
        }

    def as_results_dict(self) -> dict[str, object]:
        """Final standings."""
        return {
            "lobbyCode": self.code,
            "state": self.state.value,
            "questionCount": len(self.questions),
            "questions": [
                {
                    # ``index`` is the 1-based display ordinal ("Question 3 of 10").
                    # ``questionIndex`` is the 0-based key used everywhere in the
                    # protocol, including ``Answer.questionIndex``. Both are sent
                    # so consumers can join answers to questions without
                    # off-by-one arithmetic.
                    "index": q.index,
                    "questionIndex": position,
                    "question": q.question,
                    "options": q.options,
                    "correctIndex": q.correct_index,
                    "imageUrl": q.image_url,
                    "explanation": q.explanation,
                }
                for position, q in enumerate(self.questions)
            ],
            "players": [p.as_client_dict(include_answers=True) for p in self.ordered_players()],
        }


def _public_question(question: Question) -> dict[str, object]:
    """A question with the answer withheld.

    v1 shipped the whole question list -- ``correct_answer`` included -- to every
    client at game start, so the answers were visible in devtools before anyone
    had answered. Only the reveal payload carries ``correctIndex`` now.
    """
    return {
        "index": question.index,
        "question": question.question,
        "options": question.options,
        "imageUrl": question.image_url,
        "difficulty": question.difficulty.value,
    }

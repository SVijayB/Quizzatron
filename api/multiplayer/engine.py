"""Server-authoritative multiplayer game engine.

The central change from v1: **the server runs the game.** Previously the browser
owned the countdown, graded its own answers, computed its own score, and the
*host's* browser alone decided when to advance. That produced four bugs that were
really one bug:

* any client could send ``score: 999999``;
* replaying ``submit_answer`` multiplied your score;
* one dropped tab froze the round forever, because "has everyone answered?"
  counted players who were no longer connected and the disconnect handler removed
  nobody;
* the host closing their tab froze the game permanently, since only the host
  emitted ``request_next_question``.

Here a background task per round owns the deadline, grading happens against the
server's own clock, answers are idempotent, disconnected players are excluded
from the round barrier, and the host role migrates. ``request_next_question`` is
gone -- the server advances on its own.

The engine talks to the outside world through a small :class:`Broadcaster`
protocol so the whole game loop is testable without a socket server.
"""

from __future__ import annotations

import logging
import threading
import uuid
from typing import Protocol

from pydantic import ValidationError

from api.core.config import get_settings
from api.models.quiz import Question, QuizRequest
from api.multiplayer.models import (
    ANSWER_GRACE_MS,
    DEFAULT_AVATAR,
    REVEAL_MS,
    Answer,
    GameState,
    Lobby,
    LobbySettings,
    Player,
    now_ms,
)
from api.multiplayer.store import LobbyError, store

logger = logging.getLogger(__name__)

# Poll interval for the round watcher. Short enough to react promptly when the
# last player answers, long enough to stay cheap.
_TICK_S = 0.2


class Broadcaster(Protocol):
    """How the engine reaches connected clients."""

    def emit(self, event: str, payload: dict, *, room: str | None = None) -> None:
        """Send an event to a room, or to everyone when ``room`` is None."""

    def sleep(self, seconds: float) -> None:
        """Cooperative sleep appropriate to the server's concurrency model."""

    def spawn(self, target, *args: object) -> None:
        """Run ``target`` in the background."""


class NullBroadcaster:
    """Discards everything. The default until a socket server registers."""

    def emit(self, event: str, payload: dict, *, room: str | None = None) -> None:
        """Ignore the event."""

    def sleep(self, seconds: float) -> None:
        """Sleep on a plain thread."""
        import time

        time.sleep(seconds)

    def spawn(self, target, *args: object) -> None:
        """Run on a daemon thread."""
        threading.Thread(target=target, args=args, daemon=True).start()


_broadcaster: Broadcaster = NullBroadcaster()


def set_broadcaster(broadcaster: Broadcaster) -> None:
    """Install the transport the engine should broadcast through."""
    global _broadcaster  # noqa: PLW0603 - single process-wide transport
    _broadcaster = broadcaster


def get_broadcaster() -> Broadcaster:
    """Return the active transport."""
    return _broadcaster


# ---------------------------------------------------------------------------
# Event names. Namespaced, unlike v1's flat set, and each has exactly one shape.
# ---------------------------------------------------------------------------

EV_LOBBY_UPDATE = "lobby:update"
EV_LOBBY_CLOSED = "lobby:closed"
EV_GAME_STARTED = "game:started"
EV_GAME_QUESTION = "game:question"
EV_GAME_ANSWERED = "game:answered"
EV_GAME_REVEAL = "game:reveal"
EV_GAME_OVER = "game:over"
EV_ERROR = "error"


# ---------------------------------------------------------------------------
# Lobby lifecycle
# ---------------------------------------------------------------------------


def create_lobby(*, host_name: str, avatar: str | None = None) -> tuple[Lobby, Player]:
    """Create a lobby with its host."""
    return store.create(host_name=host_name, avatar=avatar)


def join_lobby(*, code: str, player_name: str, avatar: str | None = None) -> tuple[Lobby, Player]:
    """Add a player to a lobby."""
    lobby = store.require(code)
    name = " ".join(str(player_name or "").split())[:20]
    if not name:
        raise LobbyError("A player name is required.")

    with lobby.lock:
        if lobby.state is not GameState.LOBBY:
            raise LobbyError("That game has already started.", status=409)
        if len(lobby.players) >= get_settings().max_players_per_lobby:
            raise LobbyError("That lobby is full.", status=409)
        if any(p.name.casefold() == name.casefold() for p in lobby.players.values()):
            raise LobbyError("That name is already taken in this lobby.", status=409)

        player = Player(id=str(uuid.uuid4()), name=name, avatar=avatar or DEFAULT_AVATAR)
        lobby.players[player.id] = player
        lobby.touch()
        snapshot = lobby.as_lobby_dict()

    _emit(EV_LOBBY_UPDATE, snapshot, room=lobby.code)
    logger.info("Player %r joined lobby %s", name, lobby.code)
    return lobby, player


def leave_lobby(*, code: str, player_id: str) -> None:
    """Remove a player, migrating the host role or closing the lobby."""
    lobby = store.get(code)
    if lobby is None:
        return

    closed = False
    with lobby.lock:
        player = lobby.players.pop(player_id, None)
        if player is None:
            return
        lobby.touch()

        if not lobby.players:
            closed = True
        elif player.is_host:
            _migrate_host_locked(lobby)

        snapshot = None if closed else lobby.as_lobby_dict()

    if closed:
        store.remove(lobby.code)
        _emit(
            EV_LOBBY_CLOSED, {"lobbyCode": lobby.code, "reason": "Everyone left."}, room=lobby.code
        )
        logger.info("Lobby %s closed (empty)", lobby.code)
        return

    _emit(EV_LOBBY_UPDATE, snapshot or {}, room=lobby.code)
    # A departure can complete the round barrier.
    _maybe_finish_round(lobby)


def _migrate_host_locked(lobby: Lobby) -> None:
    """Promote the longest-present remaining player. Caller holds the lock.

    v1 had no migration at all: mid-game the host was simply popped, and since
    only the host advanced questions, the game froze permanently.
    """
    candidates = sorted(lobby.players.values(), key=lambda p: (not p.connected, p.joined_at))
    if not candidates:
        return
    new_host = candidates[0]
    new_host.is_host = True
    new_host.ready = True
    lobby.host_id = new_host.id
    logger.info("Lobby %s host migrated to %r", lobby.code, new_host.name)


def set_ready(*, code: str, player_id: str, ready: bool) -> Lobby:
    """Toggle a player's ready flag."""
    lobby = store.require(code)
    with lobby.lock:
        player = lobby.players.get(player_id)
        if player is None:
            raise LobbyError("You are not in that lobby.", status=404)
        if lobby.state is not GameState.LOBBY:
            raise LobbyError("That game has already started.", status=409)
        player.ready = bool(ready)
        lobby.touch()
        snapshot = lobby.as_lobby_dict()
    _emit(EV_LOBBY_UPDATE, snapshot, room=lobby.code)
    return lobby


def update_settings(*, code: str, player_id: str, payload: object) -> Lobby:
    """Replace lobby settings. Host only."""
    lobby = store.require(code)
    with lobby.lock:
        _require_host_locked(lobby, player_id)
        if lobby.state is not GameState.LOBBY:
            raise LobbyError("Settings are locked once the game starts.", status=409)
        merged = {
            **lobby.settings.as_client_dict(),
            **(payload if isinstance(payload, dict) else {}),
        }
        try:
            lobby.settings = LobbySettings.from_client(merged)
        except ValidationError as exc:
            raise LobbyError(_first_validation_message(exc), status=400) from exc
        lobby.touch()
        snapshot = lobby.as_lobby_dict()
    _emit(EV_LOBBY_UPDATE, snapshot, room=lobby.code)
    return lobby


def update_avatar(*, code: str, player_id: str, avatar: str) -> Lobby:
    """Change a player's avatar."""
    lobby = store.require(code)
    with lobby.lock:
        player = lobby.players.get(player_id)
        if player is None:
            raise LobbyError("You are not in that lobby.", status=404)
        cleaned = str(avatar or "").strip()[:8]
        if cleaned:
            player.avatar = cleaned
        lobby.touch()
        snapshot = lobby.as_lobby_dict()
    _emit(EV_LOBBY_UPDATE, snapshot, room=lobby.code)
    return lobby


def _first_validation_message(exc: ValidationError) -> str:
    """Turn a pydantic error into one readable sentence for the client."""
    errors = exc.errors()
    if not errors:
        return "Those settings are not valid."
    first = errors[0]
    field = ".".join(str(part) for part in first.get("loc", ())) or "setting"
    return f"Invalid {field}: {first.get('msg', 'not allowed')}."


def _require_host_locked(lobby: Lobby, player_id: str) -> Player:
    """Assert the caller is the host. Caller holds the lock.

    v1 had no ownership check on any multiplayer endpoint, so anyone with a lobby
    code could change settings or start the game.
    """
    player = lobby.players.get(player_id)
    if player is None:
        raise LobbyError("You are not in that lobby.", status=404)
    if not player.is_host:
        raise LobbyError("Only the host can do that.", status=403)
    return player


# ---------------------------------------------------------------------------
# Connection tracking
# ---------------------------------------------------------------------------


def attach_session(*, code: str, player_id: str, session_id: str) -> Lobby | None:
    """Bind a socket session to a player and mark them connected."""
    lobby = store.get(code)
    if lobby is None:
        return None
    with lobby.lock:
        player = lobby.players.get(player_id)
        if player is None:
            return None
        player.session_id = session_id
        player.connected = True
        lobby.touch()
        snapshot = lobby.as_lobby_dict()
    _emit(EV_LOBBY_UPDATE, snapshot, room=lobby.code)
    return lobby


def detach_session(session_id: str) -> None:
    """Mark whoever owned ``session_id`` as disconnected.

    The player is kept in the lobby so they can rejoin with their score intact,
    but they stop counting toward the round barrier -- which is what made v1
    deadlock on a single dropped tab.
    """
    for code in store.codes():
        lobby = store.get(code)
        if lobby is None:
            continue
        hit = False
        with lobby.lock:
            for player in lobby.players.values():
                if player.session_id == session_id:
                    player.connected = False
                    player.session_id = None
                    hit = True
                    break
            if not hit:
                continue
            in_lobby = lobby.state is GameState.LOBBY
            everyone_gone = not lobby.connected_players
            snapshot = lobby.as_lobby_dict()

        _emit(EV_LOBBY_UPDATE, snapshot, room=lobby.code)

        if in_lobby and everyone_gone:
            store.remove(lobby.code)
            logger.info("Lobby %s closed (all players disconnected pre-game)", lobby.code)
        else:
            _maybe_finish_round(lobby)
        return


# ---------------------------------------------------------------------------
# Starting a game
# ---------------------------------------------------------------------------


def start_game(*, code: str, player_id: str) -> Lobby:
    """Generate questions and begin the game. Host only.

    Question generation happens **outside** the lobby lock. v1 held a single
    process-wide lock across the LLM call plus one image lookup per image
    question, freezing every other lobby for the duration.
    """
    lobby = store.require(code)

    with lobby.lock:
        _require_host_locked(lobby, player_id)
        if lobby.state is not GameState.LOBBY:
            raise LobbyError("That game has already started.", status=409)
        if lobby.generating:
            raise LobbyError("The quiz is already being generated.", status=409)
        active = [p for p in lobby.players.values() if p.connected]
        if len(active) < 2:
            raise LobbyError("You need at least two connected players to start.", status=409)
        if not all(p.ready or p.is_host for p in active):
            raise LobbyError("Everyone needs to be ready first.", status=409)

        lobby.generating = True
        settings = lobby.settings.model_copy()
        lobby.touch()
        snapshot = lobby.as_lobby_dict()

    _emit(EV_LOBBY_UPDATE, snapshot, room=lobby.code)

    try:
        questions = _build_questions(settings)
    except Exception as exc:  # noqa: BLE001 - reported to the room, not swallowed
        with lobby.lock:
            lobby.generating = False
            lobby.touch()
            snapshot = lobby.as_lobby_dict()
        logger.warning("Quiz generation failed for lobby %s: %s", lobby.code, exc)
        _emit(EV_ERROR, {"message": str(exc) or "Could not build the quiz."}, room=lobby.code)
        _emit(EV_LOBBY_UPDATE, snapshot, room=lobby.code)
        raise LobbyError(str(exc) or "Could not build the quiz.", status=502) from exc

    with lobby.lock:
        lobby.generating = False
        if lobby.state is not GameState.LOBBY:
            # Someone else won the race; discard this generation.
            return lobby
        lobby.questions = questions
        lobby.started = True
        for player in lobby.players.values():
            player.score = 0
            player.answers.clear()
        lobby.touch()
        started = lobby.as_lobby_dict()

    _emit(EV_GAME_STARTED, started, room=lobby.code)
    _begin_question(lobby, 0)
    return lobby


def _build_questions(settings: LobbySettings) -> list[Question]:
    """Produce the question list for a lobby, from a category or the LLM."""
    from api.services.quiz_service import quiz_from_category

    if settings.category:
        quiz = quiz_from_category(
            category=settings.category,
            num_questions=settings.num_questions,
            difficulty=settings.difficulty,
        )
        return quiz.questions

    from api.services.quiz_service import generate_quiz

    request = QuizRequest(
        topic=settings.topic or "general knowledge",
        difficulty=settings.difficulty,
        num_questions=settings.num_questions,
        include_images=settings.include_images,
        model=settings.model,
    )
    return generate_quiz(request).questions


# ---------------------------------------------------------------------------
# The round loop
# ---------------------------------------------------------------------------


def _begin_question(lobby: Lobby, index: int) -> None:
    """Move the lobby onto question ``index`` and start its watcher."""
    with lobby.lock:
        if index >= len(lobby.questions):
            _finish_game_locked(lobby)
            results = lobby.as_results_dict()
        else:
            results = None

    if results is not None:
        _emit(EV_GAME_OVER, results, room=lobby.code)
        return

    with lobby.lock:
        lobby.current_index = index
        lobby.state = GameState.QUESTION
        lobby.question_started_ms = now_ms()
        lobby.deadline_ms = lobby.question_started_ms + lobby.settings.time_per_question * 1000
        lobby.round_token += 1
        token = lobby.round_token
        lobby.touch()
        payload = lobby.as_game_dict()

    _emit(EV_GAME_QUESTION, payload, room=lobby.code)
    _broadcaster.spawn(_watch_round, lobby.code, token)


def _watch_round(code: str, token: int) -> None:
    """Own the deadline for one question, then reveal and advance.

    ``round_token`` makes this task idempotent: if the round is superseded (a
    restart, a manual advance, the lobby closing) the stale watcher exits without
    touching anything.
    """
    try:
        while True:
            lobby = store.get(code)
            if lobby is None:
                return
            with lobby.lock:
                if lobby.round_token != token or lobby.state is not GameState.QUESTION:
                    return
                if lobby.everyone_answered():
                    break
                remaining_ms = lobby.deadline_ms + ANSWER_GRACE_MS - now_ms()
            if remaining_ms <= 0:
                break
            _broadcaster.sleep(min(_TICK_S, max(remaining_ms / 1000, 0.01)))

        _reveal_and_advance(code, token)
    except Exception:  # noqa: BLE001 - a crashed watcher must not wedge the lobby
        logger.exception("Round watcher failed for lobby %s", code)
        _emit(EV_ERROR, {"message": "The round could not be completed."}, room=code)


def _reveal_and_advance(code: str, token: int) -> None:
    """Show the answer, then move to the next question or end the game."""
    lobby = store.get(code)
    if lobby is None:
        return

    with lobby.lock:
        if lobby.round_token != token or lobby.state is not GameState.QUESTION:
            return
        question = lobby.current_question
        if question is None:
            return

        # Anyone who didn't answer in time gets a recorded zero, so the results
        # screen can distinguish "wrong" from "ran out of time".
        for player in lobby.players.values():
            if not player.has_answered(lobby.current_index):
                player.answers[lobby.current_index] = Answer(
                    question_index=lobby.current_index,
                    selected_index=None,
                    is_correct=False,
                    points=0,
                    elapsed_ms=lobby.settings.time_per_question * 1000,
                    timed_out=True,
                )

        lobby.state = GameState.REVEAL
        lobby.touch()
        index = lobby.current_index
        last = lobby.is_last_question
        reveal = {
            "questionIndex": index,
            "correctIndex": question.correct_index,
            "correctOption": question.correct_option,
            "explanation": question.explanation,
            "isLastQuestion": last,
            "nextInMs": REVEAL_MS,
            "players": [p.as_client_dict() for p in lobby.ordered_players()],
            "breakdown": [
                {
                    "playerId": p.id,
                    "selectedIndex": p.answers[index].selected_index,
                    "isCorrect": p.answers[index].is_correct,
                    "points": p.answers[index].points,
                    "timedOut": p.answers[index].timed_out,
                }
                for p in lobby.ordered_players()
                if index in p.answers
            ],
        }

    _emit(EV_GAME_REVEAL, reveal, room=lobby.code)
    _broadcaster.sleep(REVEAL_MS / 1000)

    lobby = store.get(code)
    if lobby is None:
        return
    with lobby.lock:
        if lobby.round_token != token or lobby.state is not GameState.REVEAL:
            return
        next_index = lobby.current_index + 1
        finished = next_index >= len(lobby.questions)
        if finished:
            _finish_game_locked(lobby)
            payload = lobby.as_results_dict()

    if finished:
        _emit(EV_GAME_OVER, payload, room=lobby.code)
        logger.info("Lobby %s finished", lobby.code)
    else:
        _begin_question(lobby, next_index)


def _finish_game_locked(lobby: Lobby) -> None:
    """Mark the game over. Caller holds the lock.

    v1 emitted ``game_over`` but never set the state or populated results, so
    ``GET /results/<code>`` returned 400 "Game is not over yet" forever and the
    results screen could only work from a localStorage cache.
    """
    lobby.state = GameState.GAME_OVER
    lobby.deadline_ms = 0
    lobby.round_token += 1
    lobby.touch()


def _maybe_finish_round(lobby: Lobby) -> None:
    """Close the round early if the remaining players have all answered."""
    with lobby.lock:
        if lobby.state is not GameState.QUESTION:
            return
        if not lobby.everyone_answered():
            return
        token = lobby.round_token
    _broadcaster.spawn(_reveal_and_advance, lobby.code, token)


# ---------------------------------------------------------------------------
# Answering
# ---------------------------------------------------------------------------


def submit_answer(
    *, code: str, player_id: str, question_index: int, selected_index: object
) -> Answer:
    """Record and grade an answer. Server-authoritative and idempotent."""
    lobby = store.require(code)

    with lobby.lock:
        player = lobby.players.get(player_id)
        if player is None:
            raise LobbyError("You are not in that lobby.", status=404)
        if lobby.state not in (GameState.QUESTION, GameState.REVEAL):
            raise LobbyError("There is no question in play.", status=409)
        if int(question_index) != lobby.current_index:
            # Stale or forged index. v1 accepted any index, and an index of -1
            # before the game started made the server broadcast game_over.
            raise LobbyError("That question is no longer in play.", status=409)
        if player.has_answered(lobby.current_index):
            # Idempotent: v1 appended and re-added the score every time.
            return player.answers[lobby.current_index]

        elapsed_ms = max(0, now_ms() - lobby.question_started_ms)
        limit_ms = lobby.settings.time_per_question * 1000
        timed_out = elapsed_ms > limit_ms + ANSWER_GRACE_MS

        chosen = _coerce_index(selected_index)
        if timed_out:
            is_correct, points = False, 0
        else:
            is_correct, points = lobby.score_answer(selected_index=chosen, elapsed_ms=elapsed_ms)

        answer = Answer(
            question_index=lobby.current_index,
            selected_index=chosen,
            is_correct=is_correct,
            points=points,
            elapsed_ms=min(elapsed_ms, limit_ms),
            timed_out=timed_out,
        )
        player.answers[answer.question_index] = answer
        player.score += points
        lobby.touch()

        active = lobby.connected_players
        progress = {
            "playerId": player.id,
            "playerName": player.name,
            "questionIndex": answer.question_index,
            "answeredCount": sum(1 for p in active if p.has_answered(answer.question_index)),
            "totalPlayers": len(active),
        }

    # Deliberately does not leak correctness: v1's socket path broadcast
    # is_correct and score to the whole room the moment anyone answered.
    _emit(EV_GAME_ANSWERED, progress, room=lobby.code)
    _maybe_finish_round(lobby)
    return answer


def _coerce_index(value: object) -> int | None:
    """Parse a selected option index from client input."""
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value if 0 <= value <= 3 else None
    text = str(value).strip()
    if not text:
        return None
    if text.isdigit():
        number = int(text)
        return number if 0 <= number <= 3 else None
    if len(text) == 1 and text.upper() in "ABCD":
        return "ABCD".index(text.upper())
    return None


# ---------------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------------


def get_lobby_state(code: str) -> dict:
    """Lobby snapshot for the lobby screen."""
    lobby = store.require(code)
    with lobby.lock:
        lobby.touch()
        return lobby.as_lobby_dict()


def get_game_state(code: str) -> dict:
    """Game snapshot, including settings and the server clock."""
    lobby = store.require(code)
    with lobby.lock:
        if lobby.state is GameState.LOBBY:
            raise LobbyError("That game has not started yet.", status=409)
        lobby.touch()
        return lobby.as_game_dict()


def get_results(code: str) -> dict:
    """Final standings once the game is over."""
    lobby = store.require(code)
    with lobby.lock:
        if lobby.state is not GameState.GAME_OVER:
            raise LobbyError("That game is not over yet.", status=409)
        return lobby.as_results_dict()


def restart_game(*, code: str, player_id: str) -> Lobby:
    """Return a finished lobby to the pre-game state so it can be replayed."""
    lobby = store.require(code)
    with lobby.lock:
        _require_host_locked(lobby, player_id)
        lobby.state = GameState.LOBBY
        lobby.started = False
        lobby.questions = []
        lobby.current_index = -1
        lobby.deadline_ms = 0
        lobby.round_token += 1
        for player in lobby.players.values():
            player.score = 0
            player.answers.clear()
            player.ready = player.is_host
        lobby.touch()
        snapshot = lobby.as_lobby_dict()
    _emit(EV_LOBBY_UPDATE, snapshot, room=lobby.code)
    return lobby


def _emit(event: str, payload: dict, *, room: str | None = None) -> None:
    """Broadcast, never letting a transport failure break game logic."""
    try:
        _broadcaster.emit(event, payload, room=room)
    except Exception:  # noqa: BLE001
        logger.exception("Failed to emit %s to %s", event, room)


__all__ = [
    "Broadcaster",
    "EV_ERROR",
    "EV_GAME_ANSWERED",
    "EV_GAME_OVER",
    "EV_GAME_QUESTION",
    "EV_GAME_REVEAL",
    "EV_GAME_STARTED",
    "EV_LOBBY_CLOSED",
    "EV_LOBBY_UPDATE",
    "NullBroadcaster",
    "attach_session",
    "create_lobby",
    "detach_session",
    "get_game_state",
    "get_lobby_state",
    "get_results",
    "join_lobby",
    "leave_lobby",
    "restart_game",
    "set_broadcaster",
    "set_ready",
    "start_game",
    "submit_answer",
    "update_avatar",
    "update_settings",
]

"""Multiplayer engine tests.

v1 had **zero** multiplayer coverage, and `.coveragerc` explicitly omitted
``*/multiplayer*`` and ``api/socket_server.py`` -- roughly 1,500 lines,
unmeasured. Each class below pins one of the defects that made the old
implementation unplayable.
"""

from __future__ import annotations

import time

import pytest

from api.multiplayer import engine
from api.multiplayer.models import GameState
from api.multiplayer.store import LobbyError


def _seed(broadcaster, *, players: int = 2, questions: int = 2, seconds: int = 30):
    """Create a started game with ``players`` connected participants."""
    lobby, host = engine.create_lobby(host_name="Host")
    others = []
    for i in range(players - 1):
        _, player = engine.join_lobby(code=lobby.code, player_name=f"P{i}")
        engine.set_ready(code=lobby.code, player_id=player.id, ready=True)
        others.append(player)
    engine.update_settings(
        code=lobby.code,
        player_id=host.id,
        payload={"numQuestions": questions, "timePerQuestion": seconds},
    )
    for player in [host, *others]:
        engine.attach_session(code=lobby.code, player_id=player.id, session_id=f"sid-{player.id}")
    engine.start_game(code=lobby.code, player_id=host.id)
    return lobby, host, others


class TestLobbyLifecycle:
    """Joining, naming, capacity, and ownership."""

    def test_create_and_join(self, broadcaster) -> None:
        """A lobby holds its host plus joiners."""
        lobby, host = engine.create_lobby(host_name="Ada")
        engine.join_lobby(code=lobby.code, player_name="Bob")
        assert len(lobby.players) == 2
        assert lobby.players[host.id].is_host is True

    def test_lobby_code_is_case_insensitive(self, broadcaster) -> None:
        """Players type codes in any case."""
        lobby, _ = engine.create_lobby(host_name="Ada")
        engine.join_lobby(code=lobby.code.lower(), player_name="Bob")
        assert len(lobby.players) == 2

    def test_duplicate_name_rejected(self, broadcaster) -> None:
        """Names must be unique within a lobby, regardless of case."""
        lobby, _ = engine.create_lobby(host_name="Ada")
        with pytest.raises(LobbyError) as exc:
            engine.join_lobby(code=lobby.code, player_name="ada")
        assert exc.value.status == 409

    def test_missing_lobby_is_404(self, broadcaster) -> None:
        """An unknown code is a 404, not a 500."""
        with pytest.raises(LobbyError) as exc:
            engine.join_lobby(code="ZZZZZZ", player_name="Bob")
        assert exc.value.status == 404

    def test_capacity_enforced(self, broadcaster) -> None:
        """A lobby fills up."""
        lobby, _ = engine.create_lobby(host_name="Host")
        for i in range(7):
            engine.join_lobby(code=lobby.code, player_name=f"P{i}")
        with pytest.raises(LobbyError, match="full"):
            engine.join_lobby(code=lobby.code, player_name="TooMany")

    def test_cannot_join_started_game(self, broadcaster) -> None:
        """Late arrivals are turned away."""
        lobby, _, _ = _seed(broadcaster)
        with pytest.raises(LobbyError, match="already started"):
            engine.join_lobby(code=lobby.code, player_name="Late")

    def test_only_host_changes_settings(self, broadcaster) -> None:
        """v1 had no ownership check on any multiplayer endpoint."""
        lobby, _ = engine.create_lobby(host_name="Host")
        _, bob = engine.join_lobby(code=lobby.code, player_name="Bob")
        with pytest.raises(LobbyError) as exc:
            engine.update_settings(code=lobby.code, player_id=bob.id, payload={"numQuestions": 3})
        assert exc.value.status == 403

    def test_only_host_starts(self, broadcaster) -> None:
        """Non-hosts cannot start the game."""
        lobby, _ = engine.create_lobby(host_name="Host")
        _, bob = engine.join_lobby(code=lobby.code, player_name="Bob")
        engine.set_ready(code=lobby.code, player_id=bob.id, ready=True)
        with pytest.raises(LobbyError) as exc:
            engine.start_game(code=lobby.code, player_id=bob.id)
        assert exc.value.status == 403


class TestSettingsValidation:
    """v1 copied every key from the request body into the lobby with no
    whitelist and no range check, leaving ``numQuestions`` unbounded."""

    @pytest.mark.parametrize(
        "payload",
        [
            {"timePerQuestion": 1},
            {"timePerQuestion": 9999},
            {"numQuestions": 0},
            {"numQuestions": 100000},
        ],
    )
    def test_out_of_range_is_400(self, broadcaster, payload: dict) -> None:
        """Bad values are a client error, not a 500 and not silently accepted."""
        lobby, host = engine.create_lobby(host_name="Host")
        with pytest.raises(LobbyError) as exc:
            engine.update_settings(code=lobby.code, player_id=host.id, payload=payload)
        assert exc.value.status == 400

    def test_unknown_keys_ignored(self, broadcaster) -> None:
        """Arbitrary keys cannot be injected into lobby state."""
        lobby, host = engine.create_lobby(host_name="Host")
        engine.update_settings(
            code=lobby.code, player_id=host.id, payload={"evil": "x", "numQuestions": 4}
        )
        assert lobby.settings.num_questions == 4
        assert not hasattr(lobby.settings, "evil")

    def test_difficulty_case_insensitive(self, broadcaster) -> None:
        """ "Hard" is accepted."""
        lobby, host = engine.create_lobby(host_name="Host")
        engine.update_settings(code=lobby.code, player_id=host.id, payload={"difficulty": "Hard"})
        assert lobby.settings.difficulty.value == "hard"


class TestStartGate:
    """The client and server disagreed on this in v1."""

    def test_needs_two_players(self, broadcaster) -> None:
        """A solo host cannot start."""
        lobby, host = engine.create_lobby(host_name="Host")
        engine.attach_session(code=lobby.code, player_id=host.id, session_id="s1")
        with pytest.raises(LobbyError, match="two connected players"):
            engine.start_game(code=lobby.code, player_id=host.id)

    def test_needs_everyone_ready(self, broadcaster) -> None:
        """Unready players block the start."""
        lobby, host = engine.create_lobby(host_name="Host")
        _, bob = engine.join_lobby(code=lobby.code, player_name="Bob")
        for pid in (host.id, bob.id):
            engine.attach_session(code=lobby.code, player_id=pid, session_id=f"s-{pid}")
        with pytest.raises(LobbyError, match="ready"):
            engine.start_game(code=lobby.code, player_id=host.id)


class TestAnswerIntegrity:
    """Scoring is server-authoritative and answers are idempotent."""

    def test_answers_are_not_leaked_in_question_payload(self, broadcaster) -> None:
        """v1 shipped ``correct_answer`` to every client at game start, so the
        answers were visible in devtools before anyone had answered."""
        _seed(broadcaster)
        payload = broadcaster.last(engine.EV_GAME_QUESTION)
        assert payload is not None
        assert "correctIndex" not in payload["question"]
        assert "correct_index" not in payload["question"]

    def test_replay_does_not_multiply_score(self, broadcaster) -> None:
        """v1 appended and re-added the score on every resubmission."""
        lobby, host, _ = _seed(broadcaster)
        correct = lobby.questions[0].correct_index
        first = engine.submit_answer(
            code=lobby.code, player_id=host.id, question_index=0, selected_index=correct
        )
        after_one = lobby.players[host.id].score
        for _ in range(5):
            engine.submit_answer(
                code=lobby.code, player_id=host.id, question_index=0, selected_index=correct
            )
        assert lobby.players[host.id].score == after_one
        assert len(lobby.players[host.id].answers) == 1
        assert first.points > 0

    def test_wrong_answer_scores_zero(self, broadcaster) -> None:
        """Server grades; the client cannot claim points."""
        lobby, host, _ = _seed(broadcaster)
        wrong = (lobby.questions[0].correct_index + 1) % 4
        answer = engine.submit_answer(
            code=lobby.code, player_id=host.id, question_index=0, selected_index=wrong
        )
        assert answer.is_correct is False
        assert answer.points == 0
        assert lobby.players[host.id].score == 0

    def test_client_cannot_supply_score(self) -> None:
        """The API simply has no parameter for it.

        v1's socket handler did ``player["score"] += score`` with whatever the
        client sent, and trusted ``is_correct`` too.
        """
        import inspect

        params = set(inspect.signature(engine.submit_answer).parameters)
        assert params == {"code", "player_id", "question_index", "selected_index"}

    def test_stale_index_rejected(self, broadcaster) -> None:
        """v1 accepted any index; ``-1`` before start made it broadcast game_over."""
        lobby, host, _ = _seed(broadcaster)
        for bad in (-1, 1, 99):
            with pytest.raises(LobbyError) as exc:
                engine.submit_answer(
                    code=lobby.code, player_id=host.id, question_index=bad, selected_index=0
                )
            assert exc.value.status == 409

    def test_answer_before_start_rejected(self, broadcaster) -> None:
        """No question in play means no answer."""
        lobby, host = engine.create_lobby(host_name="Host")
        with pytest.raises(LobbyError, match="no question in play"):
            engine.submit_answer(
                code=lobby.code, player_id=host.id, question_index=0, selected_index=0
            )

    def test_non_member_rejected(self, broadcaster) -> None:
        """You cannot answer on behalf of a lobby you're not in."""
        lobby, _, _ = _seed(broadcaster)
        with pytest.raises(LobbyError) as exc:
            engine.submit_answer(
                code=lobby.code, player_id="not-a-player", question_index=0, selected_index=0
            )
        assert exc.value.status == 404

    @pytest.mark.parametrize("value", [None, "", "Z", 99, -1, True, [], {}])
    def test_garbage_selection_scores_zero(self, broadcaster, value: object) -> None:
        """Malformed selections are recorded as wrong, not crashes."""
        lobby, host, _ = _seed(broadcaster)
        answer = engine.submit_answer(
            code=lobby.code, player_id=host.id, question_index=0, selected_index=value
        )
        assert answer.is_correct is False
        assert answer.points == 0


class TestRoundAdvance:
    """The server owns the clock. v1 had no server timers at all."""

    def test_all_answered_advances_immediately(self, broadcaster) -> None:
        """The round closes as soon as everyone has answered."""
        lobby, host, (bob,) = _seed(broadcaster, seconds=30)
        engine.submit_answer(code=lobby.code, player_id=host.id, question_index=0, selected_index=0)
        assert lobby.state is GameState.QUESTION
        engine.submit_answer(code=lobby.code, player_id=bob.id, question_index=0, selected_index=0)
        assert broadcaster.wait_for(engine.EV_GAME_REVEAL)
        assert lobby.state in (GameState.REVEAL, GameState.QUESTION, GameState.GAME_OVER)

    def test_dropped_player_does_not_deadlock(self, broadcaster) -> None:
        """The headline v1 bug: one closed tab froze the game forever, because
        the barrier counted disconnected players and the disconnect handler
        removed nobody."""
        lobby, host, (bob,) = _seed(broadcaster, seconds=30)
        engine.submit_answer(code=lobby.code, player_id=host.id, question_index=0, selected_index=0)
        assert lobby.state is GameState.QUESTION

        engine.detach_session(f"sid-{bob.id}")

        assert broadcaster.wait_for(engine.EV_GAME_REVEAL, timeout=5)
        assert lobby.players[bob.id].connected is False
        # Bob keeps his slot and score so he can rejoin.
        assert bob.id in lobby.players

    def test_timeout_advances_without_answers(self, broadcaster) -> None:
        """Nobody answering still moves the game on."""
        lobby, _, _ = _seed(broadcaster, questions=1, seconds=5)
        assert broadcaster.wait_for(engine.EV_GAME_REVEAL, timeout=15)
        reveal = broadcaster.last(engine.EV_GAME_REVEAL)
        assert all(entry["timedOut"] for entry in reveal["breakdown"])

    def test_game_runs_to_completion_unattended(self, broadcaster) -> None:
        """No client action required. v1 depended on the host's browser."""
        lobby, _, _ = _seed(broadcaster, questions=2, seconds=5)
        assert broadcaster.wait_for(engine.EV_GAME_OVER, timeout=40)
        assert lobby.state is GameState.GAME_OVER
        assert broadcaster.count(engine.EV_GAME_QUESTION) == 2
        assert broadcaster.count(engine.EV_GAME_REVEAL) == 2

    def test_reveal_exposes_the_answer(self, broadcaster) -> None:
        """The correct index arrives only at reveal time."""
        lobby, host, (bob,) = _seed(broadcaster, seconds=30)
        expected = lobby.questions[0].correct_index
        for pid in (host.id, bob.id):
            engine.submit_answer(
                code=lobby.code, player_id=pid, question_index=0, selected_index=expected
            )
        assert broadcaster.wait_for(engine.EV_GAME_REVEAL)
        assert broadcaster.last(engine.EV_GAME_REVEAL)["correctIndex"] == expected


class TestHostMigration:
    """v1 froze permanently when the host left, since only the host advanced."""

    def test_host_leaving_promotes_someone(self, broadcaster) -> None:
        """A new host is appointed."""
        lobby, host, others = _seed(broadcaster, players=3, seconds=30)
        engine.leave_lobby(code=lobby.code, player_id=host.id)
        assert lobby.host_id != host.id
        assert lobby.players[lobby.host_id].is_host is True

    def test_game_still_completes_after_host_leaves(self, broadcaster) -> None:
        """The server keeps driving the game."""
        lobby, host, others = _seed(broadcaster, players=3, questions=1, seconds=5)
        engine.leave_lobby(code=lobby.code, player_id=host.id)
        assert broadcaster.wait_for(engine.EV_GAME_OVER, timeout=25)
        assert lobby.state is GameState.GAME_OVER

    def test_last_player_leaving_closes_lobby(self, broadcaster, store) -> None:
        """An empty lobby is removed."""
        lobby, host = engine.create_lobby(host_name="Solo")
        engine.leave_lobby(code=lobby.code, player_id=host.id)
        assert store.get(lobby.code) is None
        assert broadcaster.count(engine.EV_LOBBY_CLOSED) == 1


class TestResultsAndRanking:
    """v1 never set GAME_OVER or populated results, so ``GET /results`` returned
    400 forever and the UI could only read a localStorage cache."""

    def test_results_available_after_completion(self, broadcaster) -> None:
        """The endpoint works."""
        lobby, _, _ = _seed(broadcaster, questions=1, seconds=5)
        assert broadcaster.wait_for(engine.EV_GAME_OVER, timeout=25)
        results = engine.get_results(lobby.code)
        assert len(results["players"]) == 2
        assert len(results["questions"]) == 1
        assert all("answers" in player for player in results["players"])

    def test_results_before_completion_is_409(self, broadcaster) -> None:
        """Asking early is a clear conflict, not a generic failure."""
        lobby, _, _ = _seed(broadcaster, seconds=30)
        with pytest.raises(LobbyError) as exc:
            engine.get_results(lobby.code)
        assert exc.value.status == 409

    def test_ranking_is_deterministic(self, broadcaster) -> None:
        """v1 sorted on score alone, so ties came out in arbitrary order and the
        recorded ``time_taken`` was never used."""
        lobby, host, (bob,) = _seed(broadcaster, seconds=30)
        host_player, bob_player = lobby.players[host.id], lobby.players[bob.id]
        host_player.score = bob_player.score = 50
        from api.multiplayer.models import Answer

        host_player.answers[0] = Answer(0, 0, True, 50, elapsed_ms=1000)
        bob_player.answers[0] = Answer(0, 0, True, 50, elapsed_ms=9000)
        ranked = lobby.ordered_players()
        assert ranked[0].id == host.id, "faster player wins an equal score"
        assert lobby.ordered_players() == ranked, "ordering is stable"

    def test_faster_correct_answer_scores_higher(self, broadcaster) -> None:
        """Points come from remaining time."""
        lobby, host, (bob,) = _seed(broadcaster, seconds=10)
        correct = lobby.questions[0].correct_index
        engine.submit_answer(
            code=lobby.code, player_id=host.id, question_index=0, selected_index=correct
        )
        time.sleep(1.2)
        engine.submit_answer(
            code=lobby.code, player_id=bob.id, question_index=0, selected_index=correct
        )
        assert lobby.players[host.id].score > lobby.players[bob.id].score


class TestGameStateSnapshot:
    """A reload must not desync the player."""

    def test_game_state_includes_settings(self, broadcaster) -> None:
        """v1's ``GET /game/<code>`` omitted settings, so a reload silently reset
        timePerQuestion to 15 and difficulty to medium -- changing that player's
        timer and score multiplier."""
        lobby, _, _ = _seed(broadcaster, seconds=25)
        state = engine.get_game_state(lobby.code)
        assert state["settings"]["timePerQuestion"] == 25
        assert "deadlineMs" in state and "serverNowMs" in state

    def test_lobby_state_before_start(self, broadcaster) -> None:
        """The game snapshot is unavailable before kickoff."""
        lobby, _ = engine.create_lobby(host_name="Host")
        with pytest.raises(LobbyError) as exc:
            engine.get_game_state(lobby.code)
        assert exc.value.status == 409
        assert engine.get_lobby_state(lobby.code)["state"] == "lobby"


class TestReconnect:
    """v1's client logged "Automatically rejoining room" but never re-emitted."""

    def test_rejoin_restores_connection_and_score(self, broadcaster) -> None:
        """Reattaching a session keeps the accumulated score."""
        lobby, host, (bob,) = _seed(broadcaster, seconds=30)
        engine.submit_answer(
            code=lobby.code,
            player_id=bob.id,
            question_index=0,
            selected_index=lobby.questions[0].correct_index,
        )
        earned = lobby.players[bob.id].score
        assert earned > 0

        engine.detach_session(f"sid-{bob.id}")
        assert lobby.players[bob.id].connected is False

        engine.attach_session(code=lobby.code, player_id=bob.id, session_id="sid-new")
        assert lobby.players[bob.id].connected is True
        assert lobby.players[bob.id].score == earned


class TestRestartAndReaper:
    """Replay and cleanup."""

    def test_restart_resets_scores(self, broadcaster) -> None:
        """A finished lobby can be replayed."""
        lobby, host, _ = _seed(broadcaster, questions=1, seconds=5)
        assert broadcaster.wait_for(engine.EV_GAME_OVER, timeout=25)
        engine.restart_game(code=lobby.code, player_id=host.id)
        assert lobby.state is GameState.LOBBY
        assert all(player.score == 0 for player in lobby.players.values())
        assert lobby.questions == []

    def test_reaper_removes_idle_lobbies(self, broadcaster, store) -> None:
        """v1 shipped two cleanup functions and called neither."""
        lobby, _ = engine.create_lobby(host_name="Idle")
        assert store.count() == 1
        lobby.last_activity_ms = 0
        assert lobby.code in store.reap()
        assert store.count() == 0

    def test_reaper_keeps_active_lobbies(self, broadcaster, store) -> None:
        """Live lobbies survive a sweep."""
        engine.create_lobby(host_name="Active")
        assert store.reap() == []
        assert store.count() == 1

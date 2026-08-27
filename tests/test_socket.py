"""Socket.IO transport tests.

Exercised through Flask-SocketIO's own test client, so the handlers, room
membership, and payload validation are covered rather than just the engine.

v1's `.coveragerc` explicitly omitted ``api/socket_server.py``.
"""

from __future__ import annotations

import pytest

from api.multiplayer import engine


@pytest.fixture
def sio_app():
    """A Flask app plus its Socket.IO server, with the real broadcaster wired."""
    from api.app import create_app

    application, socketio = create_app()
    application.config.update(TESTING=True)
    return application, socketio


def _events(client) -> list[dict]:
    """Drain received events into a list of ``{'name', 'args'}`` dicts."""
    return client.get_received()


def _names(received: list[dict]) -> list[str]:
    """Event names from a drained list."""
    return [item["name"] for item in received]


def _payload(received: list[dict], name: str) -> dict | None:
    """The most recent payload for an event name."""
    for item in reversed(received):
        if item["name"] == name:
            args = item.get("args") or []
            return args[0] if args else {}
    return None


class TestConnection:
    """Handshake behaviour."""

    def test_connect_acknowledges(self, sio_app, store) -> None:
        """A client learns its session id on connect."""
        app, socketio = sio_app
        client = socketio.test_client(app)
        assert client.is_connected()
        received = _events(client)
        assert "connection:ready" in _names(received)
        assert _payload(received, "connection:ready")["sessionId"]

    def test_async_mode_is_threading(self, sio_app) -> None:
        """Threading mode is what makes the async LLM bridge safe: no eventlet or
        gevent monkey-patching in the process."""
        _, socketio = sio_app
        assert socketio.async_mode == "threading"


class TestLobbyJoin:
    """Room membership and validation."""

    def _lobby(self, client_app):
        app, socketio = client_app
        rest = app.test_client()
        created = rest.post("/api/multiplayer/create", json={"hostName": "Ada"}).get_json()
        return rest, created["lobbyCode"], created["playerId"]

    def test_join_returns_snapshot(self, sio_app, store) -> None:
        """A joiner immediately receives state, so a mid-game reload resyncs."""
        app, socketio = sio_app
        _, code, host_id = self._lobby(sio_app)

        client = socketio.test_client(app)
        _events(client)
        client.emit("lobby:join", {"lobbyCode": code, "playerId": host_id})
        received = _events(client)
        assert "lobby:joined" in _names(received)
        assert _payload(received, "lobby:joined")["lobbyCode"] == code

    @pytest.mark.parametrize(
        "payload",
        [{}, {"lobbyCode": "ABCDEF"}, {"playerId": "x"}, None, "not-a-dict", 42],
    )
    def test_malformed_join_errors_cleanly(self, sio_app, store, payload: object) -> None:
        """Bad payloads produce an error event, never a disconnect."""
        app, socketio = sio_app
        client = socketio.test_client(app)
        _events(client)
        client.emit("lobby:join", payload)
        assert "error" in _names(_events(client))
        assert client.is_connected()

    def test_join_unknown_lobby_errors(self, sio_app, store) -> None:
        """A stale code is reported, not crashed on."""
        app, socketio = sio_app
        client = socketio.test_client(app)
        _events(client)
        client.emit("lobby:join", {"lobbyCode": "ZZZZZZ", "playerId": "nope"})
        received = _events(client)
        assert "error" in _names(received)
        assert "no longer exists" in _payload(received, "error")["message"]

    def test_join_as_non_member_errors(self, sio_app, store) -> None:
        """You cannot bind to a lobby you never joined."""
        app, socketio = sio_app
        _, code, _ = self._lobby(sio_app)
        client = socketio.test_client(app)
        _events(client)
        client.emit("lobby:join", {"lobbyCode": code, "playerId": "fabricated"})
        assert "error" in _names(_events(client))


class TestBroadcasts:
    """Events reach the room, not just the sender."""

    def test_lobby_update_reaches_other_members(self, sio_app, store) -> None:
        """v1 emitted ``game_started`` with no room, so only the host got it."""
        app, socketio = sio_app
        rest = app.test_client()
        created = rest.post("/api/multiplayer/create", json={"hostName": "Ada"}).get_json()
        code, host_id = created["lobbyCode"], created["playerId"]

        host = socketio.test_client(app)
        _events(host)
        host.emit("lobby:join", {"lobbyCode": code, "playerId": host_id})
        _events(host)

        # Bob joins over REST; the host should hear about it.
        rest.post("/api/multiplayer/join", json={"lobbyCode": code, "playerName": "Bob"})
        assert "lobby:update" in _names(_events(host))

    def test_errors_go_only_to_the_caller(self, sio_app, store) -> None:
        """A non-host's rejected action must not spam the room."""
        app, socketio = sio_app
        rest = app.test_client()
        created = rest.post("/api/multiplayer/create", json={"hostName": "Ada"}).get_json()
        code, host_id = created["lobbyCode"], created["playerId"]
        bob_id = rest.post(
            "/api/multiplayer/join", json={"lobbyCode": code, "playerName": "Bob"}
        ).get_json()["playerId"]

        host = socketio.test_client(app)
        bob = socketio.test_client(app)
        for client, pid in ((host, host_id), (bob, bob_id)):
            _events(client)
            client.emit("lobby:join", {"lobbyCode": code, "playerId": pid})
            _events(client)

        # Bob is not the host, so this must fail — and only Bob should see it.
        bob.emit("lobby:settings", {"lobbyCode": code, "playerId": bob_id, "settings": {}})
        assert "error" in _names(_events(bob))
        assert "error" not in _names(_events(host))


class TestGameplayOverSockets:
    """The primary gameplay path end to end."""

    def test_full_game(self, sio_app, store) -> None:
        """Start, answer, reveal, and finish entirely over Socket.IO."""
        app, socketio = sio_app
        rest = app.test_client()

        created = rest.post("/api/multiplayer/create", json={"hostName": "Ada"}).get_json()
        code, host_id = created["lobbyCode"], created["playerId"]
        bob_id = rest.post(
            "/api/multiplayer/join", json={"lobbyCode": code, "playerName": "Bob"}
        ).get_json()["playerId"]

        host = socketio.test_client(app)
        bob = socketio.test_client(app)
        for client, pid in ((host, host_id), (bob, bob_id)):
            _events(client)
            client.emit("lobby:join", {"lobbyCode": code, "playerId": pid})
            _events(client)

        bob.emit("lobby:ready", {"lobbyCode": code, "playerId": bob_id, "ready": True})
        host.emit(
            "lobby:settings",
            {
                "lobbyCode": code,
                "playerId": host_id,
                "settings": {"numQuestions": 1, "timePerQuestion": 5},
            },
        )
        _events(host)
        _events(bob)

        host.emit("game:start", {"lobbyCode": code, "playerId": host_id})

        host_events = _events(host)
        assert "game:started" in _names(host_events)
        question = _payload(host_events, "game:question")
        assert question is not None
        assert "correctIndex" not in question["question"], "answers must not leak"
        assert question["deadlineMs"] > question["serverNowMs"]

        # Both answer, which should close the round immediately.
        for client, pid in ((host, host_id), (bob, bob_id)):
            client.emit(
                "game:answer",
                {"lobbyCode": code, "playerId": pid, "questionIndex": 0, "selectedIndex": 0},
            )

        from api.multiplayer.store import store as lobby_store

        lobby = lobby_store.get(code)
        deadline = __import__("time").monotonic() + 25
        while lobby.state.value != "game_over" and __import__("time").monotonic() < deadline:
            __import__("time").sleep(0.2)

        assert lobby.state.value == "game_over"
        names = _names(_events(host)) + _names(_events(bob))
        assert "game:reveal" in names
        assert "game:over" in names

        results = rest.get(f"/api/multiplayer/results/{code}")
        assert results.status_code == 200

    def test_answer_with_bad_index_errors(self, sio_app, store) -> None:
        """A forged index is rejected without disconnecting the client."""
        app, socketio = sio_app
        rest = app.test_client()
        created = rest.post("/api/multiplayer/create", json={"hostName": "Ada"}).get_json()
        code, host_id = created["lobbyCode"], created["playerId"]

        client = socketio.test_client(app)
        _events(client)
        client.emit("lobby:join", {"lobbyCode": code, "playerId": host_id})
        _events(client)

        client.emit(
            "game:answer",
            {"lobbyCode": code, "playerId": host_id, "questionIndex": 99, "selectedIndex": 0},
        )
        assert "error" in _names(_events(client))
        assert client.is_connected()

    def test_no_request_next_question_handler(self, sio_app, store) -> None:
        """The server advances rounds; v1 depended on the host's browser."""
        app, socketio = sio_app
        client = socketio.test_client(app)
        _events(client)
        # An unregistered event is simply ignored; nothing should break.
        client.emit("request_next_question", {"lobby_code": "ABCDEF"})
        assert client.is_connected()
        assert not hasattr(engine, "request_next_question")


class TestDisconnect:
    """Dropping a client must not wedge the lobby."""

    def test_disconnect_marks_player_offline(self, sio_app, store) -> None:
        """The player keeps their slot and score so they can rejoin."""
        app, socketio = sio_app
        rest = app.test_client()
        created = rest.post("/api/multiplayer/create", json={"hostName": "Ada"}).get_json()
        code, host_id = created["lobbyCode"], created["playerId"]

        client = socketio.test_client(app)
        _events(client)
        client.emit("lobby:join", {"lobbyCode": code, "playerId": host_id})
        _events(client)

        from api.multiplayer.store import store as lobby_store

        assert lobby_store.get(code).players[host_id].connected is True
        client.disconnect()

        lobby = lobby_store.get(code)
        # A lone pre-game player disconnecting closes the lobby; otherwise the
        # player is simply marked offline.
        assert lobby is None or lobby.players[host_id].connected is False

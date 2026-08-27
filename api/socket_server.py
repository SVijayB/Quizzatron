"""Socket.IO transport.

This file is now a thin adapter: it validates payloads, joins rooms, and
forwards to :mod:`api.multiplayer.engine`. All game logic lives in the engine.

v1's version contained the game rules inline (trusting client scores, scanning
for "has everyone answered", broadcasting ``game_over``) *and* carried a second,
never-registered copy of the broadcast helpers whose ``new_question`` payload
used a different field name -- a latent contract fork. There was also a third
dead implementation in ``multiplayer_api.py`` referencing state fields that did
not exist.

``request_next_question`` is deliberately absent. The server advances rounds.
"""

from __future__ import annotations

import logging

from flask import request
from flask_socketio import SocketIO, join_room, leave_room

from api.multiplayer import engine
from api.multiplayer.store import LobbyError, store

logger = logging.getLogger(__name__)

socketio: SocketIO | None = None


class SocketBroadcaster:
    """Adapts Flask-SocketIO to the engine's :class:`~api.multiplayer.engine.Broadcaster`."""

    def __init__(self, sio: SocketIO) -> None:
        """Wrap a SocketIO server."""
        self._sio = sio

    def emit(self, event: str, payload: dict, *, room: str | None = None) -> None:
        """Broadcast to a room, or to everyone."""
        self._sio.emit(event, payload, to=room)

    def sleep(self, seconds: float) -> None:
        """Sleep using the server's own concurrency primitive."""
        self._sio.sleep(seconds)

    def spawn(self, target, *args: object) -> None:
        """Run a background task on the SocketIO server."""
        self._sio.start_background_task(target, *args)


def init_socketio(app) -> SocketIO:
    """Create the Socket.IO server and wire up handlers."""
    global socketio  # noqa: PLW0603 - one server per process

    from api.core.config import get_settings

    settings = get_settings()
    socketio = SocketIO(
        app,
        cors_allowed_origins=settings.cors_origins,
        logger=False,
        engineio_logger=False,
        # Explicit rather than inferred. Threading mode means no monkey-patching,
        # which is what lets the async LLM layer run safely (see api/core/aio.py).
        async_mode="threading",
        ping_interval=25,
        ping_timeout=60,
    )
    engine.set_broadcaster(SocketBroadcaster(socketio))
    _register_handlers(socketio)
    return socketio


def _register_handlers(sio: SocketIO) -> None:
    """Attach every event handler."""

    @sio.on("connect")
    def _connect():
        """Acknowledge a new connection."""
        sio.emit("connection:ready", {"sessionId": request.sid}, to=request.sid)

    @sio.on("disconnect")
    def _disconnect():
        """Mark the player disconnected without removing them.

        Keeping them in the lobby preserves their score for a rejoin, while
        :func:`engine.detach_session` excludes them from the round barrier so a
        dropped tab cannot stall the game.
        """
        engine.detach_session(request.sid)

    @sio.on("lobby:join")
    def _join(data):
        """Join a lobby's room and bind this socket to a player.

        Clients call this on every ``connect``, including after a reconnect. v1
        only logged "Automatically rejoining room" and never re-emitted, so a
        transport blip silently cut the client off from all broadcasts for the
        rest of the game.
        """
        payload = data if isinstance(data, dict) else {}
        code = str(payload.get("lobbyCode") or "").strip().upper()
        player_id = str(payload.get("playerId") or "").strip()
        if not code or not player_id:
            sio.emit("error", {"message": "lobbyCode and playerId are required."}, to=request.sid)
            return

        lobby = store.get(code)
        if lobby is None:
            sio.emit("error", {"message": "That lobby no longer exists."}, to=request.sid)
            return

        join_room(code)
        attached = engine.attach_session(code=code, player_id=player_id, session_id=request.sid)
        if attached is None:
            sio.emit("error", {"message": "You are not a member of that lobby."}, to=request.sid)
            return

        # Send the joiner a full snapshot so a mid-game reload can resync
        # immediately rather than waiting for the next broadcast.
        sio.emit("lobby:joined", _snapshot(code), to=request.sid)

    @sio.on("lobby:leave")
    def _leave(data):
        """Leave a lobby."""
        payload = data if isinstance(data, dict) else {}
        code = str(payload.get("lobbyCode") or "").strip().upper()
        player_id = str(payload.get("playerId") or "").strip()
        if code and player_id:
            engine.leave_lobby(code=code, player_id=player_id)
            leave_room(code)

    @sio.on("lobby:ready")
    def _ready(data):
        """Toggle ready state."""
        _guarded(
            data,
            lambda code, pid, payload: engine.set_ready(
                code=code, player_id=pid, ready=bool(payload.get("ready", True))
            ),
        )

    @sio.on("lobby:settings")
    def _settings(data):
        """Update settings. Host only."""
        _guarded(
            data,
            lambda code, pid, payload: engine.update_settings(
                code=code, player_id=pid, payload=payload.get("settings") or {}
            ),
        )

    @sio.on("lobby:avatar")
    def _avatar(data):
        """Update an avatar."""
        _guarded(
            data,
            lambda code, pid, payload: engine.update_avatar(
                code=code, player_id=pid, avatar=str(payload.get("avatar") or "")
            ),
        )

    @sio.on("game:start")
    def _start(data):
        """Start the game. Host only."""
        _guarded(data, lambda code, pid, payload: engine.start_game(code=code, player_id=pid))

    @sio.on("game:answer")
    def _answer(data):
        """Submit an answer, graded on the server."""

        def run(code: str, pid: str, payload: dict):
            return engine.submit_answer(
                code=code,
                player_id=pid,
                question_index=int(payload.get("questionIndex", -1)),
                selected_index=payload.get("selectedIndex"),
            )

        _guarded(data, run)

    @sio.on("game:restart")
    def _restart(data):
        """Reset a finished lobby. Host only."""
        _guarded(data, lambda code, pid, payload: engine.restart_game(code=code, player_id=pid))


def _guarded(data, action) -> None:
    """Run an engine call, reporting failures to just the caller."""
    payload = data if isinstance(data, dict) else {}
    code = str(payload.get("lobbyCode") or "").strip().upper()
    player_id = str(payload.get("playerId") or "").strip()

    if not code or not player_id:
        _emit_error("lobbyCode and playerId are required.")
        return

    try:
        action(code, player_id, payload)
    except LobbyError as exc:
        _emit_error(str(exc))
    except (TypeError, ValueError) as exc:
        _emit_error(f"Invalid request: {exc}")
    except Exception:  # noqa: BLE001 - never let a handler kill the connection
        logger.exception("Socket handler failed for lobby %s", code)
        _emit_error("Something went wrong handling that action.")


def _emit_error(message: str) -> None:
    """Send an error to the current client only."""
    if socketio is None:
        return
    socketio.emit("error", {"message": message}, to=request.sid)


def _snapshot(code: str) -> dict:
    """Best-available state snapshot for a rejoining client."""
    try:
        return engine.get_game_state(code)
    except LobbyError:
        try:
            return engine.get_lobby_state(code)
        except LobbyError:
            return {}

"""Multiplayer REST endpoints.

These are thin wrappers over :mod:`api.multiplayer.engine`. Real-time play runs
over Socket.IO; REST exists for the initial create/join handshake and for state
recovery after a reload.

``POST /next-question`` is gone -- the server advances rounds itself now.
Every mutating endpoint requires the caller's ``playerId``, which is what makes
host-only actions enforceable. v1 identified players by display name and had no
ownership checks at all.
"""

from __future__ import annotations

from flask import Blueprint, jsonify, request

from api.core.errors import ApiError
from api.multiplayer import engine
from api.multiplayer.store import LobbyError

multiplayer_bp = Blueprint("multiplayer", __name__, url_prefix="/multiplayer")


def _body() -> dict:
    """Read a JSON (or form) body as a dict."""
    payload = request.get_json(silent=True)
    if payload is None:
        payload = dict(request.form) if request.form else {}
    if not isinstance(payload, dict):
        raise ApiError("Expected a JSON object.", status=400, code="invalid_request")
    return payload


def _field(payload: dict, name: str) -> str:
    """Pull one required string field out of a body."""
    value = str(payload.get(name) or "").strip()
    if not value:
        raise ApiError(f"{name} is required.", status=400, code="invalid_request")
    return value


def _lobby_and_player(payload: dict) -> tuple[str, str]:
    """Pull the two fields every mutating multiplayer call needs."""
    return _field(payload, "lobbyCode"), _field(payload, "playerId")


def _wrap(exc: LobbyError) -> ApiError:
    """Convert an engine error into an API error, preserving its status."""
    return ApiError(str(exc), status=exc.status, code="lobby_error")


@multiplayer_bp.post("/create")
def create():
    """Create a lobby."""
    payload = _body()
    host_name = _field(payload, "hostName")
    try:
        lobby, host = engine.create_lobby(host_name=host_name, avatar=payload.get("avatar"))
    except LobbyError as exc:
        raise _wrap(exc) from exc
    return (
        jsonify({"lobbyCode": lobby.code, "playerId": host.id, "lobby": lobby.as_lobby_dict()}),
        201,
    )


@multiplayer_bp.post("/join")
def join():
    """Join an existing lobby."""
    payload = _body()
    code = _field(payload, "lobbyCode")
    name = _field(payload, "playerName")
    try:
        lobby, player = engine.join_lobby(code=code, player_name=name, avatar=payload.get("avatar"))
    except LobbyError as exc:
        raise _wrap(exc) from exc
    return jsonify({"lobbyCode": lobby.code, "playerId": player.id, "lobby": lobby.as_lobby_dict()})


@multiplayer_bp.post("/leave")
def leave():
    """Leave a lobby."""
    payload = _body()
    code, player_id = _lobby_and_player(payload)
    engine.leave_lobby(code=code, player_id=player_id)
    return jsonify({"ok": True})


@multiplayer_bp.post("/ready")
def ready():
    """Set the caller's ready flag."""
    payload = _body()
    code, player_id = _lobby_and_player(payload)
    try:
        lobby = engine.set_ready(
            code=code, player_id=player_id, ready=bool(payload.get("ready", True))
        )
    except LobbyError as exc:
        raise _wrap(exc) from exc
    return jsonify({"ok": True, "lobby": lobby.as_lobby_dict()})


@multiplayer_bp.post("/settings")
def settings():
    """Update lobby settings. Host only."""
    payload = _body()
    code, player_id = _lobby_and_player(payload)
    try:
        lobby = engine.update_settings(
            code=code, player_id=player_id, payload=payload.get("settings") or {}
        )
    except LobbyError as exc:
        raise _wrap(exc) from exc
    return jsonify({"ok": True, "lobby": lobby.as_lobby_dict()})


@multiplayer_bp.post("/avatar")
def avatar():
    """Update the caller's avatar."""
    payload = _body()
    code, player_id = _lobby_and_player(payload)
    emoji = _field(payload, "avatar")
    try:
        lobby = engine.update_avatar(code=code, player_id=player_id, avatar=emoji)
    except LobbyError as exc:
        raise _wrap(exc) from exc
    return jsonify({"ok": True, "lobby": lobby.as_lobby_dict()})


@multiplayer_bp.post("/start")
def start():
    """Generate the quiz and begin play. Host only."""
    payload = _body()
    code, player_id = _lobby_and_player(payload)
    try:
        lobby = engine.start_game(code=code, player_id=player_id)
    except LobbyError as exc:
        raise _wrap(exc) from exc
    return jsonify({"ok": True, "lobby": lobby.as_lobby_dict()})


@multiplayer_bp.post("/answer")
def answer():
    """Submit an answer. Graded server-side."""
    payload = _body()
    code, player_id = _lobby_and_player(payload)
    if "questionIndex" not in payload:
        raise ApiError("questionIndex is required.", status=400, code="invalid_request")
    try:
        recorded = engine.submit_answer(
            code=code,
            player_id=player_id,
            question_index=int(payload["questionIndex"]),
            selected_index=payload.get("selectedIndex"),
        )
    except (TypeError, ValueError) as exc:
        raise ApiError(
            "questionIndex must be a number.", status=400, code="invalid_request"
        ) from exc
    except LobbyError as exc:
        raise _wrap(exc) from exc
    return jsonify({"ok": True, "answer": recorded.as_client_dict()})


@multiplayer_bp.post("/restart")
def restart():
    """Reset a finished lobby for another round. Host only."""
    payload = _body()
    code, player_id = _lobby_and_player(payload)
    try:
        lobby = engine.restart_game(code=code, player_id=player_id)
    except LobbyError as exc:
        raise _wrap(exc) from exc
    return jsonify({"ok": True, "lobby": lobby.as_lobby_dict()})


@multiplayer_bp.get("/lobby/<lobby_code>")
def lobby_state(lobby_code: str):
    """Lobby snapshot."""
    try:
        return jsonify(engine.get_lobby_state(lobby_code))
    except LobbyError as exc:
        raise _wrap(exc) from exc


@multiplayer_bp.get("/game/<lobby_code>")
def game_state(lobby_code: str):
    """In-game snapshot, including settings and the server clock."""
    try:
        return jsonify(engine.get_game_state(lobby_code))
    except LobbyError as exc:
        raise _wrap(exc) from exc


@multiplayer_bp.get("/results/<lobby_code>")
def results(lobby_code: str):
    """Final standings."""
    try:
        return jsonify(engine.get_results(lobby_code))
    except LobbyError as exc:
        raise _wrap(exc) from exc

"""Module for handling multiplayer quiz API routes."""

from flask import Blueprint, request, jsonify
from api.services.multiplayer_service import (
    create_new_lobby,
    join_existing_lobby,
    update_player_ready_status,
    update_lobby_settings,
    start_game,
    leave_lobby,
    get_lobby_info,
    get_game_state,
    submit_player_answer,
    get_game_results,
)

# Create blueprint
multiplayer_bp = Blueprint("multiplayer", __name__, url_prefix="/multiplayer")


# Route to create a new lobby
@multiplayer_bp.route("/create", methods=["POST"])
def create_lobby():
    """Create a new multiplayer lobby."""
    data = request.json

    if not data or "host_name" not in data:
        return jsonify({"error": "Host name is required"}), 400

    host_name = data.get("host_name")
    host_avatar = data.get("avatar", "")

    lobby = create_new_lobby(host_name, host_avatar)

    return (
        jsonify({"lobby_code": lobby["lobby_code"], "host_id": lobby["host_id"]}),
        201,
    )


# Route to join an existing lobby
@multiplayer_bp.route("/join", methods=["POST"])
def join_lobby():
    """Join an existing multiplayer lobby."""
    data = request.json

    if not data or "lobby_code" not in data or "player_name" not in data:
        return jsonify({"error": "Lobby code and player name are required"}), 400

    lobby_code = data.get("lobby_code")
    player_name = data.get("player_name")
    player_avatar = data.get("avatar", "")

    result, status_code = join_existing_lobby(lobby_code, player_name, player_avatar)

    if status_code != 200:
        return jsonify(result), status_code

    return jsonify({"lobby_code": lobby_code, "player_id": result["player_id"]}), 200


# Route to mark player as ready
@multiplayer_bp.route("/ready", methods=["POST"])
def toggle_ready():
    """Mark a player as ready to start the game."""
    data = request.json

    if (
        not data
        or "lobby_code" not in data
        or "player_name" not in data
        or "ready" not in data
    ):
        return (
            jsonify(
                {"error": "Lobby code, player name, and ready status are required"}
            ),
            400,
        )

    lobby_code = data.get("lobby_code")
    player_name = data.get("player_name")
    ready_status = data.get("ready")

    result, status_code = update_player_ready_status(
        lobby_code, player_name, ready_status
    )
    return jsonify(result), status_code


# Route to update game settings
@multiplayer_bp.route("/settings", methods=["POST"])
def update_settings():
    """Update the settings of a multiplayer game."""
    data = request.json

    if not data or "lobby_code" not in data or "settings" not in data:
        return jsonify({"error": "Lobby code and settings are required"}), 400

    lobby_code = data.get("lobby_code")
    new_settings = data.get("settings")

    result, status_code = update_lobby_settings(lobby_code, new_settings)
    return jsonify(result), status_code


# Route to start the game
@multiplayer_bp.route("/start", methods=["POST"])
def start_game_route():
    """Start a multiplayer game."""
    data = request.json

    if not data or "lobby_code" not in data:
        return jsonify({"error": "Lobby code is required"}), 400

    lobby_code = data.get("lobby_code")

    result, status_code = start_game(lobby_code)
    return jsonify(result), status_code


# Route to leave a lobby
@multiplayer_bp.route("/leave", methods=["POST"])
def leave_lobby_route():
    """Leave a multiplayer lobby."""
    data = request.json

    if not data or "lobby_code" not in data or "player_name" not in data:
        return jsonify({"error": "Lobby code and player name are required"}), 400

    lobby_code = data.get("lobby_code")
    player_name = data.get("player_name")

    result, status_code = leave_lobby(lobby_code, player_name)
    return jsonify(result), status_code


# Route to get lobby info
@multiplayer_bp.route("/lobby/<lobby_code>", methods=["GET"])
def get_lobby(lobby_code):
    """Get information about a lobby."""
    result, status_code = get_lobby_info(lobby_code)
    return jsonify(result), status_code


# Route to get game state (including questions)
@multiplayer_bp.route("/game/<lobby_code>", methods=["GET"])
def get_game(lobby_code):
    """Get the current state of a game including questions."""
    result, status_code = get_game_state(lobby_code)
    return jsonify(result), status_code


# Route to submit an answer
@multiplayer_bp.route("/answer", methods=["POST"])
def submit_answer():
    """Submit a player's answer to a question."""
    data = request.json

    if not data or "lobby_code" not in data or "player_name" not in data:
        return jsonify({"error": "Lobby code and player name are required"}), 400

    lobby_code = data.get("lobby_code")
    player_name = data.get("player_name")
    question_index = data.get("question_index", 0)
    answer = data.get("answer", "")
    time_taken = data.get("time_taken", 0)
    is_correct = data.get("is_correct", False)
    score = data.get("score", 0)

    result, status_code = submit_player_answer(
        lobby_code, player_name, question_index, answer, time_taken, is_correct, score
    )
    return jsonify(result), status_code


# Route to get game results
@multiplayer_bp.route("/results/<lobby_code>", methods=["GET"])
def get_results(lobby_code):
    """Get the results of a completed game."""
    result, status_code = get_game_results(lobby_code)
    return jsonify(result), status_code

"""Enhanced multiplayer quiz API routes with WebSocket support."""

from flask import Blueprint, request, jsonify
from flask_socketio import emit, join_room, leave_room
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
    advance_to_next_question,
    get_game_results,
    update_player_avatar,
)

# Create blueprint - use 'multiplayer' as the endpoint for simplicity
multiplayer_bp = Blueprint("multiplayer", __name__, url_prefix="/multiplayer")


class SocketIOHandler:
    """Handler for socket.io events in the multiplayer API."""

    # Class variable to store the socketio instance
    _instance = None

    @classmethod
    def init_socketio(cls, socketio_instance):
        """Initialize the SocketIO instance."""
        cls._instance = socketio_instance
        cls.setup_socket_events()

    @classmethod
    def setup_socket_events(cls):
        """Set up all WebSocket event handlers."""
        # pylint: disable=too-many-statements

        if not cls._instance:
            return

        @cls._instance.on("connect")
        def handle_connect():
            """Handle client connection."""
            emit("connection_response", {"status": "connected"})

        @cls._instance.on("disconnect")
        def handle_disconnect():
            """Handle client disconnection."""
            # Leaving blank as cleanup logic is handled in socket_server.py

        @cls._instance.on("join_room")
        def handle_join_room(data):
            """Add a player to a specific lobby room."""
            lobby_code = data.get("lobby_code")
            player_name = data.get("player_name")

            if not lobby_code:
                emit("error", {"message": "Lobby code is required"})
                return

            join_room(lobby_code)
            emit(
                "room_joined",
                {"lobby_code": lobby_code, "player": player_name},
                room=lobby_code,
            )

            # Update all clients with new lobby information
            result, _ = get_lobby_info(lobby_code)
            emit("lobby_update", result, room=lobby_code)

        @cls._instance.on("leave_room")
        def handle_leave_room(data):
            """Remove a player from a specific lobby room."""
            lobby_code = data.get("lobby_code")
            player_name = data.get("player_name")

            if lobby_code:
                leave_room(lobby_code)
                emit("player_left", {"player": player_name}, room=lobby_code)

                # Update all clients with new lobby information
                result, _ = get_lobby_info(lobby_code)
                emit("lobby_update", result, room=lobby_code)

        @cls._instance.on("start_game")
        def handle_start_game(data):
            """Start a game and broadcast the first question."""
            lobby_code = data.get("lobby_code")

            if not lobby_code:
                emit("error", {"message": "Lobby code is required"})
                return

            result, status_code = start_game(lobby_code)

            if status_code == 200:
                # Send the first question to all players
                game_state, _ = get_game_state(lobby_code)
                emit("game_started", game_state, room=lobby_code)
                emit(
                    "new_question",
                    {
                        "question": game_state["current_question"],
                        "question_index": game_state["current_question_index"],
                    },
                    room=lobby_code,
                )
            else:
                emit("error", result, room=lobby_code)

        @cls._instance.on("submit_answer")
        def handle_submit_answer(data):
            """Handle a player submitting an answer."""
            lobby_code = data.get("lobby_code")
            player_name = data.get("player_name")
            question_index = data.get("question_index", 0)
            answer = data.get("answer", "")
            time_taken = data.get("time_taken", 0)
            is_correct = data.get("is_correct", False)
            score = data.get("score", 0)

            if not lobby_code or not player_name:
                emit("error", {"message": "Lobby code and player name are required"})
                return

            # Call service but don't need to use return values here
            submit_player_answer(
                lobby_code,
                player_name,
                question_index,
                answer,
                time_taken,
                is_correct,
                score,
            )

            # Acknowledge the answer submission to the player
            emit(
                "answer_submitted",
                {
                    "player": player_name,
                    "question_index": question_index,
                    "is_correct": is_correct,
                },
                room=request.sid,
            )

            # Get updated game state to check if all players have answered
            game_state, _ = get_game_state(lobby_code)

            if game_state.get("all_players_answered", False):
                # If all players have answered, show mini-scoreboard
                emit(
                    "mini_scoreboard",
                    {
                        "results": game_state.get("current_question_results", []),
                        "scores": game_state.get("player_scores", {}),
                    },
                    room=lobby_code,
                )

                # After a delay (this should be handled by the client), move to next question
                # The client will emit 'request_next_question' after showing the mini-scoreboard

        @cls._instance.on("request_next_question")
        def handle_next_question(data):
            """Move to the next question after mini-scoreboard is displayed."""
            lobby_code = data.get("lobby_code")

            if not lobby_code:
                emit("error", {"message": "Lobby code is required"})
                return

            result, status_code = advance_to_next_question(lobby_code)

            if status_code == 200:
                if result.get("game_complete", False):
                    # Game is complete, show final results
                    final_results, _ = get_game_results(lobby_code)
                    emit("game_complete", final_results, room=lobby_code)
                else:
                    # Send the next question
                    game_state, _ = get_game_state(lobby_code)
                    emit(
                        "new_question",
                        {
                            "question": game_state["current_question"],
                            "question_index": game_state["current_question_index"],
                        },
                        room=lobby_code,
                    )
            else:
                emit("error", result, room=lobby_code)


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


# Route to manually advance to next question (primarily for testing)
@multiplayer_bp.route("/next-question", methods=["POST"])
def next_question():
    """Manually advance to the next question."""
    data = request.json

    if not data or "lobby_code" not in data:
        return jsonify({"error": "Lobby code is required"}), 400

    lobby_code = data.get("lobby_code")

    result, status_code = advance_to_next_question(lobby_code)
    return jsonify(result), status_code


# Route to get game results
@multiplayer_bp.route("/results/<lobby_code>", methods=["GET"])
def get_results(lobby_code):
    """Get the results of a completed game."""
    result, status_code = get_game_results(lobby_code)
    return jsonify(result), status_code


# Route to update player avatar
@multiplayer_bp.route("/update-avatar", methods=["POST"])
def update_avatar():
    """Update a player's avatar."""
    data = request.json

    if (
        not data
        or "lobby_code" not in data
        or "player_name" not in data
        or "avatar" not in data
    ):
        return (
            jsonify({"error": "Lobby code, player name, and avatar are required"}),
            400,
        )

    lobby_code = data.get("lobby_code")
    player_name = data.get("player_name")
    avatar = data.get("avatar")

    result, status_code = update_player_avatar(lobby_code, player_name, avatar)
    return jsonify(result), status_code

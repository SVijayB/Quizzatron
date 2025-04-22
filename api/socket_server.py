"""WebSocket server implementation for real-time multiplayer quiz game."""

import logging
from flask import request
from flask_socketio import SocketIO, join_room, leave_room, emit

# SocketIO instance
socketio = None


def init_socketio(app):
    """Initialize SocketIO with the Flask app."""
    global socketio
    socketio = SocketIO(
        app, cors_allowed_origins="*", logger=True, engineio_logger=True
    )

    setup_socket_handlers(socketio)

    return socketio


def setup_socket_handlers(sio):
    """Set up socket event handlers."""

    @sio.on("connect")
    def handle_connect():
        """Handle client connection."""
        logging.info(f"Client connected: {request.sid}")
        emit("connection_response", {"status": "connected"})

    @sio.on("disconnect")
    def handle_disconnect():
        """Handle client disconnection."""
        logging.info(f"Client disconnected: {request.sid}")

    @sio.on("join_room")
    def handle_join_lobby(data):
        """Handle client joining a lobby room."""
        logging.info(f"Join room request: {data}")
        if not data or "lobby_code" not in data or "player_name" not in data:
            emit("error", {"message": "Invalid data for joining room"})
            return

        lobby_code = data["lobby_code"]
        player_name = data["player_name"]
        player_id = data.get("player_id", "")

        # Join the room
        join_room(lobby_code)
        logging.info(f"Player {player_name} ({request.sid}) joined lobby {lobby_code}")

        # Notify other clients in the room
        emit(
            "player_joined",
            {"name": player_name, "id": player_id},
            room=lobby_code,
            skip_sid=request.sid,
        )

        # Acknowledge join to the client who joined
        emit("room_joined", {"lobby_code": lobby_code, "status": "success"})

    @sio.on("leave_lobby")
    def handle_leave_lobby(data):
        """Handle client leaving a lobby room."""
        if not data or "lobby_code" not in data or "player_name" not in data:
            return

        lobby_code = data["lobby_code"]
        player_name = data["player_name"]
        player_id = data.get("player_id", "")

        # Leave the room
        leave_room(lobby_code)
        logging.info(f"Player {player_name} ({request.sid}) left lobby {lobby_code}")

        # Notify other clients in the room
        emit("player_left", {"name": player_name, "id": player_id}, room=lobby_code)


# Broadcast functions used by the multiplayer service


def broadcast_lobby_update(lobby_code, data):
    """Broadcast a lobby update to all clients in the room."""
    if not socketio:
        logging.warning("SocketIO not initialized, cannot broadcast")
        return

    try:
        logging.info(f"Broadcasting lobby update to {lobby_code}: {data}")
        socketio.emit("lobby_update", data, room=lobby_code)
        logging.info(f"Broadcast completed to {lobby_code}")
    except Exception as e:
        logging.error(f"Error broadcasting lobby update: {str(e)}")


def broadcast_question(lobby_code, question, question_index):
    """Broadcast a new question to all clients in the room."""
    if not socketio:
        logging.warning("SocketIO not initialized")
        return

    socketio.emit(
        "new_question", {"question": question, "index": question_index}, room=lobby_code
    )
    logging.info(f"Broadcasted question {question_index} to {lobby_code}")


def broadcast_player_answered(lobby_code, player_id, player_name, question_index):
    """Broadcast that a player has answered to all clients in the room."""
    if not socketio:
        logging.warning("SocketIO not initialized")
        return

    socketio.emit(
        "player_answered",
        {
            "player_id": player_id,
            "player_name": player_name,
            "question_index": question_index,
        },
        room=lobby_code,
    )
    logging.debug(
        f"Broadcasted that {player_name} answered question {question_index} to {lobby_code}"
    )


def broadcast_all_answers_in(lobby_code):
    """Broadcast that all players have answered to all clients in the room."""
    if not socketio:
        logging.warning("SocketIO not initialized")
        return

    socketio.emit("all_answers_in", {}, room=lobby_code)
    logging.debug(f"Broadcasted all answers in to {lobby_code}")


def broadcast_scoreboard(lobby_code, scoreboard_data):
    """Broadcast scoreboard data to all clients in the room."""
    if not socketio:
        logging.warning("SocketIO not initialized")
        return

    socketio.emit("scoreboard", {"players": scoreboard_data}, room=lobby_code)
    logging.info(f"Broadcasted scoreboard to {lobby_code}")


def broadcast_game_over(lobby_code, final_results):
    """Broadcast game over and final results to all clients in the room."""
    if not socketio:
        logging.warning("SocketIO not initialized")
        return

    socketio.emit("game_over", {"results": final_results}, room=lobby_code)
    logging.info(f"Broadcasted game over to {lobby_code}")

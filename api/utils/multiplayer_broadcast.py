"""Utility functions for multiplayer broadcast functionality."""

import logging


def broadcast_lobby_update(lobby_code, data):
    """Broadcast a lobby update to all clients in the room."""
    from api.socket_server import socketio

    if socketio:
        socketio.emit("lobby_update", data, room=lobby_code)
        logging.info(f"Broadcasting lobby update to room {lobby_code}")


def broadcast_question(lobby_code, question, question_index):
    """Broadcast a new question to all clients in the room."""
    from api.socket_server import socketio

    if socketio:
        socketio.emit(
            "new_question",
            {
                "question": question,
                "question_index": question_index,
                "time_limit": 15,  # Default time limit
            },
            room=lobby_code,
        )
        logging.info(f"Broadcasting question {question_index + 1} to room {lobby_code}")


def broadcast_player_answered(lobby_code, player_id, player_name, question_index):
    """Broadcast that a player has answered to all clients in the room."""
    from api.socket_server import socketio

    if socketio:
        socketio.emit(
            "player_answered",
            {
                "player_id": player_id,
                "player_name": player_name,
                "question_index": question_index,
            },
            room=lobby_code,
        )
        logging.info(
            f"Broadcasting that {player_name} answered question {question_index + 1}"
        )


def broadcast_all_answers_in(lobby_code):
    """Broadcast that all players have answered to all clients in the room."""
    from api.socket_server import socketio

    if socketio:
        socketio.emit("all_answers_in", {}, room=lobby_code)
        logging.info(f"Broadcasting all answers received for room {lobby_code}")


def broadcast_scoreboard(lobby_code, scoreboard_data):
    """Broadcast scoreboard data to all clients in the room."""
    from api.socket_server import socketio

    if socketio:
        socketio.emit("scoreboard", {"players": scoreboard_data}, room=lobby_code)
        logging.info(f"Broadcasting scoreboard to room {lobby_code}")


def broadcast_game_over(lobby_code, final_results):
    """Broadcast game over and final results to all clients in the room."""
    from api.socket_server import socketio

    if socketio:
        socketio.emit("game_over", {"results": final_results}, room=lobby_code)
        logging.info(f"Broadcasting game over to room {lobby_code}")

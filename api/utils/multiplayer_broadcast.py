"""Utility functions for multiplayer broadcast functionality."""

import logging
from api.socket_server import SocketServer


def broadcast_lobby_update(lobby_code, data):
    """Broadcast a lobby update to all clients in the room."""
    socketio_instance = SocketServer.get_instance()

    if socketio_instance:
        socketio_instance.emit("lobby_update", data, room=lobby_code)
        logging.info("Broadcasting lobby update to room %s", lobby_code)


def broadcast_question(lobby_code, question, question_index):
    """Broadcast a new question to all clients in the room."""
    socketio_instance = SocketServer.get_instance()

    if socketio_instance:
        socketio_instance.emit(
            "new_question",
            {
                "question": question,
                "question_index": question_index,
                "time_limit": 15,  # Default time limit
            },
            room=lobby_code,
        )
        logging.info(
            "Broadcasting question %s to room %s", question_index + 1, lobby_code
        )


def broadcast_player_answered(lobby_code, player_id, player_name, question_index):
    """Broadcast that a player has answered to all clients in the room."""
    socketio_instance = SocketServer.get_instance()

    if socketio_instance:
        socketio_instance.emit(
            "player_answered",
            {
                "player_id": player_id,
                "player_name": player_name,
                "question_index": question_index,
            },
            room=lobby_code,
        )
        logging.info(
            "Broadcasting that %s answered question %s", player_name, question_index + 1
        )


def broadcast_all_answers_in(lobby_code):
    """Broadcast that all players have answered to all clients in the room."""
    socketio_instance = SocketServer.get_instance()

    if socketio_instance:
        socketio_instance.emit("all_answers_in", {}, room=lobby_code)
        logging.info("Broadcasting all answers received for room %s", lobby_code)


def broadcast_scoreboard(lobby_code, scoreboard_data):
    """Broadcast scoreboard data to all clients in the room."""
    socketio_instance = SocketServer.get_instance()

    if socketio_instance:
        socketio_instance.emit(
            "scoreboard", {"players": scoreboard_data}, room=lobby_code
        )
        logging.info("Broadcasting scoreboard to room %s", lobby_code)


def broadcast_game_over(lobby_code, final_results):
    """Broadcast game over and final results to all clients in the room."""
    socketio_instance = SocketServer.get_instance()

    if socketio_instance:
        socketio_instance.emit(
            "game_over",
            {"results": final_results, "players": final_results},
            room=lobby_code,
        )
        logging.info("Broadcasting game over to room %s", lobby_code)

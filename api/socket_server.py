"""WebSocket server implementation for real-time multiplayer quiz game."""

# pylint: disable=import-outside-toplevel

import logging
from flask import request
from flask_socketio import SocketIO, join_room, leave_room, emit

# Remove top-level imports to break circular dependency


class SocketServer:
    """Socket server class to manage WebSocket connections and events."""

    # Class variable to store the socketio instance
    _instance = None

    @classmethod
    def init_socketio(cls, app):
        """Initialize SocketIO with the Flask app."""
        cls._instance = SocketIO(
            app, cors_allowed_origins="*", logger=True, engineio_logger=True
        )

        cls.setup_socket_handlers(cls._instance)

        return cls._instance

    @classmethod
    def get_instance(cls):
        """Get the SocketIO instance."""
        return cls._instance

    @staticmethod
    def setup_socket_handlers(sio):
        """Set up socket event handlers."""
        # pylint: disable=too-many-statements

        @sio.on("connect")
        def handle_connect():
            """Handle client connection."""
            logging.info("Client connected: %s", request.sid)
            emit("connection_response", {"status": "connected"})

        @sio.on("disconnect")
        def handle_disconnect():
            """Handle client disconnection."""
            logging.info("Client disconnected: %s", request.sid)

            from api.services.multiplayer_service import active_lobbies, lobbies_lock

            disconnected_player_found = False
            with lobbies_lock:
                for lobby_code, lobby in active_lobbies.items():
                    for player in lobby["players"]:
                        if player.get("session_id") == request.sid:
                            player_name = player["name"]
                            disconnected_player_found = True

                            logging.info(
                                "Player %s disconnected from lobby %s",
                                player_name,
                                lobby_code,
                            )
                            break

                    if disconnected_player_found:
                        break

            if not disconnected_player_found:
                logging.warning(
                    "Disconnected client %s not found in any lobby.", request.sid
                )

        @sio.on("join_room")
        def handle_join_lobby(data):
            """Handle client joining a lobby room."""
            logging.info("Join room request: %s", data)
            if not data or "lobby_code" not in data or "player_name" not in data:
                emit("error", {"message": "Invalid data for joining room"})
                return

            lobby_code = data["lobby_code"]
            player_name = data["player_name"]
            player_id = data.get("player_id", "")

            # Join the room
            join_room(lobby_code)
            logging.info(
                "Player %s (%s) joined lobby %s", player_name, request.sid, lobby_code
            )

            from api.services.multiplayer_service import active_lobbies, lobbies_lock

            # Store the session ID in the player's record for disconnect handling
            with lobbies_lock:
                if lobby_code in active_lobbies:
                    for player in active_lobbies[lobby_code]["players"]:
                        if player["name"] == player_name:
                            player["session_id"] = request.sid
                            break

            # Notify other clients in the room
            emit(
                "player_joined",
                {"name": player_name, "id": player_id},
                room=lobby_code,
                skip_sid=request.sid,
            )

            # Acknowledge join to the client who joined
            emit("room_joined", {"lobby_code": lobby_code, "status": "success"})

        @sio.on("leave_room")
        def handle_leave_lobby(data):
            """Handle client leaving a lobby room."""
            if not data or "lobby_code" not in data or "player_name" not in data:
                return

            lobby_code = data["lobby_code"]
            player_name = data["player_name"]
            # We don't need player_id so removed it

            # Leave the room
            leave_room(lobby_code)
            logging.info(
                "Player %s (%s) left lobby %s", player_name, request.sid, lobby_code
            )

            from api.services.multiplayer_service import leave_lobby

            # Call the multiplayer service to update lobby state
            result, status_code = leave_lobby(lobby_code, player_name)

            if status_code == 200:
                logging.info(
                    "Player %s successfully removed from lobby %s",
                    player_name,
                    lobby_code,
                )
            else:
                logging.error(
                    "Failed to remove player %s from lobby %s: %s",
                    player_name,
                    lobby_code,
                    result,
                )

            # Note: The leave_lobby function will broadcast player_left and lobby_update events

        @sio.on("start_game")
        def handle_start_game(data):
            """Handle game start request."""
            logging.info("Start game request: %s", data)
            if not data or "lobby_code" not in data:
                emit("error", {"message": "Invalid data for starting game"})
                return

            lobby_code = data["lobby_code"]

            from api.services.multiplayer_service import start_game

            # Call the multiplayer service to start the game
            result, status_code = start_game(lobby_code)

            if status_code != 200:
                emit("error", {"message": result.get("error", "Failed to start game")})
                return

            # Game start is handled by the multiplayer service, which broadcasts to all clients
            emit("game_started", {"status": "success"})

        @sio.on("submit_answer")
        def handle_submit_answer(data):
            """Handle answer submission with simplified approach."""
            # pylint: disable=too-many-branches, too-many-locals
            logging.info("Answer submission: %s", data)
            if (
                not data
                or "lobby_code" not in data
                or "player_name" not in data
                or "question_index" not in data
            ):
                emit("error", {"message": "Invalid answer submission data"})
                return

            # Get data from submission
            lobby_code = data["lobby_code"]
            player_name = data["player_name"]
            question_index = data["question_index"]
            answer = data["answer"]
            time_taken = data["time_taken"]
            is_correct = data["is_correct"]
            score = data["score"]

            from api.services.multiplayer_service import active_lobbies, lobbies_lock

            # Get the player ID and update player data
            player_id = None
            with lobbies_lock:
                if lobby_code in active_lobbies:
                    for player in active_lobbies[lobby_code]["players"]:
                        if player["name"] == player_name:
                            player_id = player["id"]

                            # Update player score directly
                            player["score"] += score
                            if is_correct:
                                player["correctAnswers"] += 1
                            player["currentQuestion"] = question_index + 1

                            # Add answer to player's answer list
                            if "answers" not in player:
                                player["answers"] = []

                            player["answers"].append(
                                {
                                    "question_index": question_index,
                                    "answer": answer,
                                    "is_correct": is_correct,
                                    "score": score,
                                    "time_taken": time_taken,
                                }
                            )
                            break

            # Broadcast to all players that this player has answered
            emit(
                "player_answered",
                {
                    "player_name": player_name,
                    "player_id": player_id,
                    "question_index": question_index,
                    "is_correct": is_correct,
                    "score": score,
                },
                room=lobby_code,
            )

            # Check if all players have answered this question
            with lobbies_lock:
                if lobby_code in active_lobbies:
                    lobby = active_lobbies[lobby_code]
                    all_answered = True

                    for player in lobby["players"]:
                        # Check if player has answered current question
                        has_answered = False
                        if "answers" in player:
                            for answer_data in player["answers"]:
                                if answer_data.get("question_index") == question_index:
                                    has_answered = True
                                    break

                        if not has_answered:
                            all_answered = False
                            break

                    if all_answered:
                        logging.info(
                            "All players have answered question %s in lobby %s",
                            question_index,
                            lobby_code,
                        )
                        # Emit an event to tell all clients they can advance
                        emit("all_answers_in", {}, room=lobby_code)

                        # Check if this was the last question
                        questions_count = 0
                        if (
                            "questions" in lobby
                            and isinstance(lobby["questions"], list)
                            and len(lobby["questions"]) > 0
                        ):
                            if isinstance(lobby["questions"][0], list):
                                questions_count = len(lobby["questions"][0])
                            else:
                                questions_count = len(lobby["questions"])

                        if question_index >= questions_count - 1:
                            # This was the last question, game is over
                            # Create a more detailed results structure for the frontend
                            final_results = []
                            for player in lobby["players"]:
                                final_results.append(
                                    {
                                        "name": player["name"],
                                        "score": player["score"],
                                        "correctAnswers": player.get(
                                            "correctAnswers", 0
                                        ),
                                        "avatar": player.get("avatar", "👤"),
                                    }
                                )

                            # Sort by score (highest first)
                            final_results = sorted(
                                final_results, key=lambda p: p["score"], reverse=True
                            )

                            # Store in lobby for later retrieval
                            lobby["final_results"] = final_results

                            emit(
                                "game_over",
                                {"results": final_results, "players": final_results},
                                room=lobby_code,
                            )

        @sio.on("request_next_question")
        def handle_next_question(data):
            """Handle request for next question."""
            logging.info("Next question request: %s", data)
            if not data or "lobby_code" not in data:
                emit("error", {"message": "Invalid next question request"})
                return

            lobby_code = data["lobby_code"]

            from api.services.multiplayer_service import advance_to_next_question

            # Advance to next question
            result, status_code = advance_to_next_question(lobby_code)

            if status_code != 200:
                emit(
                    "error",
                    {
                        "message": result.get(
                            "error", "Failed to advance to next question"
                        )
                    },
                )
                return

            # If game is over, notify client
            if result.get("game_over", False):
                emit("game_over_acknowledged", {"status": "success"})

        @sio.on("validate_lobby")
        def handle_validate_lobby(data):
            """Validate if a lobby is still active."""
            if not data or "lobby_code" not in data:
                emit("error", {"message": "Invalid data for lobby validation"})
                return

            lobby_code = data["lobby_code"]

            from api.services.multiplayer_service import active_lobbies, lobbies_lock

            with lobbies_lock:
                if lobby_code in active_lobbies:
                    emit("validate_lobby_response", {"valid": True})
                else:
                    emit("validate_lobby_response", {"valid": False})


# Broadcast functions used by the multiplayer service


def broadcast_lobby_update(lobby_code, data):
    """Broadcast a lobby update to all clients in the room."""
    socketio_instance = SocketServer.get_instance()
    if not socketio_instance:
        logging.warning("SocketIO not initialized, cannot broadcast")
        return

    try:
        logging.info("Broadcasting lobby update to %s: %s", lobby_code, data)
        socketio_instance.emit("lobby_update", data, room=lobby_code)
        logging.info("Broadcast completed to %s", lobby_code)
    except (ConnectionError, TimeoutError) as e:
        logging.error("Connection error broadcasting lobby update: %s", str(e))
    except ValueError as e:
        logging.error("Value error broadcasting lobby update: %s", str(e))
    except TypeError as e:
        logging.error("Type error broadcasting lobby update: %s", str(e))


def broadcast_question(lobby_code, question, question_index):
    """Broadcast a new question to all clients in the room."""
    socketio_instance = SocketServer.get_instance()
    if not socketio_instance:
        logging.warning("SocketIO not initialized")
        return

    socketio_instance.emit(
        "new_question", {"question": question, "index": question_index}, room=lobby_code
    )
    logging.info("Broadcasted question %s to %s", question_index, lobby_code)


def broadcast_player_answered(lobby_code, player_id, player_name, question_index):
    """Broadcast that a player has answered to all clients in the room."""
    socketio_instance = SocketServer.get_instance()
    if not socketio_instance:
        logging.warning("SocketIO not initialized")
        return

    socketio_instance.emit(
        "player_answered",
        {
            "player_id": player_id,
            "player_name": player_name,
            "question_index": question_index,
        },
        room=lobby_code,
    )
    logging.debug(
        "Broadcasted that %s answered question %s to %s",
        player_name,
        question_index,
        lobby_code,
    )


def broadcast_all_answers_in(lobby_code):
    """Broadcast that all players have answered to all clients in the room."""
    socketio_instance = SocketServer.get_instance()
    if not socketio_instance:
        logging.warning("SocketIO not initialized")
        return

    socketio_instance.emit("all_answers_in", {}, room=lobby_code)
    logging.debug("Broadcasted all answers in to %s", lobby_code)


def broadcast_scoreboard(lobby_code, scoreboard_data):
    """Broadcast scoreboard data to all clients in the room."""
    socketio_instance = SocketServer.get_instance()
    if not socketio_instance:
        logging.warning("SocketIO not initialized")
        return

    socketio_instance.emit("scoreboard", {"players": scoreboard_data}, room=lobby_code)
    logging.info("Broadcasted scoreboard to %s", lobby_code)


def broadcast_game_over(lobby_code, final_results):
    """Broadcast game over and final results to all clients in the room."""
    socketio_instance = SocketServer.get_instance()
    if not socketio_instance:
        logging.warning("SocketIO not initialized")
        return

    # Make sure final_results is in the format expected by the frontend
    socketio_instance.emit(
        "game_over",
        {"results": final_results, "players": final_results},
        room=lobby_code,
    )
    logging.info("Broadcasted game over to %s", lobby_code)

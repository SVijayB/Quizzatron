"""Enhanced multiplayer quiz game functionality with real-time updates."""

import uuid
import random
import time
import threading
import logging
import json
from flask import jsonify
from api.services.quiz_gen_service import generate_quiz

# Game states
GAME_STATE = {
    "LOBBY": "lobby",
    "QUESTION": "question",
    "WAITING": "waiting",
    "SCOREBOARD": "scoreboard",
    "GAME_OVER": "game_over",
}

# In-memory storage for active lobbies
active_lobbies = {}

# Lock for thread-safe operations on the lobbies dictionary
lobbies_lock = threading.Lock()


def cleanup_inactive_lobbies():
    """Remove lobbies that have been inactive for over an hour."""
    with lobbies_lock:
        current_time = time.time()
        inactive_lobbies = []

        for code, lobby in active_lobbies.items():
            # If lobby hasn't been accessed in 1 hour, mark for removal
            if current_time - lobby.get("last_activity", current_time) > 3600:
                inactive_lobbies.append(code)

        # Remove inactive lobbies
        for code in inactive_lobbies:
            del active_lobbies[code]
            logging.info(f"Removed inactive lobby: {code}")


def generate_lobby_code():
    """Generate a unique 6-character lobby code."""
    while True:
        code = "".join(random.choices("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", k=6))
        with lobbies_lock:
            if code not in active_lobbies:
                return code


def create_new_lobby(host_name, host_avatar):
    """
    Initialize a new multiplayer lobby.

    Args:
        host_name (str): The name of the lobby host
        host_avatar (str): The avatar of the lobby host

    Returns:
        dict: The created lobby information
    """
    lobby_code = generate_lobby_code()
    host_id = str(uuid.uuid4())

    lobby = {
        "lobby_code": lobby_code,
        "created_at": time.time(),
        "last_activity": time.time(),
        "host_id": host_id,
        "game_state": GAME_STATE["LOBBY"],
        "current_question_idx": -1,
        "players": [
            {
                "id": host_id,
                "name": host_name,
                "isHost": True,
                "avatar": host_avatar,
                "ready": False,
                "currentQuestion": 0,
                "score": 0,
                "correctAnswers": 0,
                "totalQuestions": 0,
                "answers": [],
            }
        ],
        "settings": {
            "numQuestions": 10,
            "categories": [],
            "difficulty": "medium",
            "timePerQuestion": 15,
            "allowSkipping": False,
            "topic": None,
            "model": "gemini",
        },
        "questions": [],
        "all_answers_received": False,
        "waiting_for_next_question": False,
    }

    with lobbies_lock:
        active_lobbies[lobby_code] = lobby

    return lobby


def join_existing_lobby(lobby_code, player_name, player_avatar):
    """
    Join an existing multiplayer lobby.

    Args:
        lobby_code (str): The code of the lobby to join
        player_name (str): The name of the player
        player_avatar (str): The avatar of the player

    Returns:
        tuple: A tuple containing player ID and status code, or error message and status code
    """
    with lobbies_lock:
        # Check if lobby exists
        if lobby_code not in active_lobbies:
            return {"error": "Lobby not found"}, 404

        lobby = active_lobbies[lobby_code]

        # Check if game has already started
        if lobby["game_state"] != GAME_STATE["LOBBY"]:
            return {"error": "Game has already started"}, 400

        # Check if player name is already taken
        for player in lobby["players"]:
            if player["name"] == player_name:
                return {"error": "Player name already taken"}, 400

        # Check if lobby is full (max 8 players)
        if len(lobby["players"]) >= 8:
            return {"error": "Lobby is full"}, 400

        # Add player to lobby
        player_id = str(uuid.uuid4())
        lobby["players"].append(
            {
                "id": player_id,
                "name": player_name,
                "isHost": False,
                "avatar": player_avatar,
                "ready": False,
                "currentQuestion": 0,
                "score": 0,
                "correctAnswers": 0,
                "totalQuestions": 0,
                "answers": [],
            }
        )

        # Update last activity
        lobby["last_activity"] = time.time()

        # Broadcast lobby update via WebSocket
        broadcast_lobby_update(
            lobby_code, {"players": lobby["players"], "settings": lobby["settings"]}
        )

    return {"player_id": player_id}, 200


def update_player_ready_status(lobby_code, player_name, ready_status):
    """
    Update the ready status of a player.

    Args:
        lobby_code (str): The code of the lobby
        player_name (str): The name of the player
        ready_status (bool): The new ready status

    Returns:
        tuple: A tuple containing success message and status code, or error message and status code
    """
    with lobbies_lock:
        # Check if lobby exists
        if lobby_code not in active_lobbies:
            return {"error": "Lobby not found"}, 404

        lobby = active_lobbies[lobby_code]

        # Check if game has already started
        if lobby["game_state"] != GAME_STATE["LOBBY"]:
            return {"error": "Game has already started"}, 400

        # Update player ready status
        player_found = False
        for player in lobby["players"]:
            if player["name"] == player_name:
                player["ready"] = ready_status
                player_found = True
                break

        if not player_found:
            return {"error": "Player not found in lobby"}, 404

        # Update last activity
        lobby["last_activity"] = time.time()

        # Broadcast lobby update via WebSocket - moved outside the loop for efficiency
        broadcast_lobby_update(lobby_code, {"players": lobby["players"]})

    return {"success": True}, 200


def update_lobby_settings(lobby_code, new_settings):
    """
    Update the settings of a lobby.

    Args:
        lobby_code (str): The code of the lobby to update
        new_settings (dict): The new settings to apply

    Returns:
        tuple: A tuple containing success message and status code, or error message and status code
    """
    logging.info(f"Updating settings for lobby {lobby_code}: {new_settings}")

    with lobbies_lock:
        # Check if lobby exists
        if lobby_code not in active_lobbies:
            logging.error(f"Lobby not found: {lobby_code}")
            return {"error": "Lobby not found"}, 404

        lobby = active_lobbies[lobby_code]

        # Check if game has already started
        if lobby["game_state"] != GAME_STATE["LOBBY"]:
            logging.error(
                f"Cannot update settings - game already started in lobby {lobby_code}"
            )
            return {"error": "Game has already started"}, 400

        # Print current settings before update
        logging.info(f"Current settings before update: {lobby['settings']}")

        # Update settings
        for key, value in new_settings.items():
            lobby["settings"][key] = value

        # Print settings after update
        logging.info(f"Updated settings: {lobby['settings']}")

        # Update last activity
        lobby["last_activity"] = time.time()

        # Broadcast lobby update via WebSocket
        broadcast_lobby_update(lobby_code, {"settings": lobby["settings"]})

    return {"success": True, "settings": lobby["settings"]}, 200


def start_game(lobby_code):
    """
    Start a multiplayer game by generating questions.

    Args:
        lobby_code (str): The code of the lobby to start

    Returns:
        tuple: A tuple containing success message and status code, or error message and status code
    """
    with lobbies_lock:
        # Check if lobby exists
        if lobby_code not in active_lobbies:
            return {"error": "Lobby not found"}, 404

        lobby = active_lobbies[lobby_code]

        # Check if game has already started
        if lobby["game_state"] != GAME_STATE["LOBBY"]:
            return {"error": "Game has already started"}, 400

        # Check if at least one player is ready (besides the host)
        ready_players = [p for p in lobby["players"] if p["ready"] or p["isHost"]]
        if len(ready_players) < 2:
            return {"error": "At least one other player must be ready to start"}, 400

        # Generate quiz questions based on settings
        settings = lobby["settings"]

        # Use the existing quiz generation service with proper parameters
        quiz_params = {
            "num_questions": settings["numQuestions"],
            "difficulty": (
                settings["difficulty"]
                if settings["difficulty"] != "mixed"
                else "medium"
            ),
            "model": settings["model"],
            "topic": settings["topic"],
            "image": settings.get("includeImages", False),
        }

        # Remove None values to prevent errors
        quiz_params = {k: v for k, v in quiz_params.items() if v is not None}

        try:
            # Generate the quiz using the existing service
            logging.info(f"⏳ Generating multiplayer quiz with params: {quiz_params}")

            # Call generate_quiz which returns a response
            response = generate_quiz(**quiz_params)

            # The response from generate_quiz is actually a Flask Response object
            # We need to convert it to the expected JSON format
            try:
                # Convert the response to string and parse as JSON
                response_data = response.get_data(as_text=True)
                parsed_data = json.loads(response_data)

                # Based on the example, we expect a list with:
                # - First element: list of question dictionaries
                # - Second element: status code (200)

                if isinstance(parsed_data, list) and len(parsed_data) == 2:
                    questions_list = parsed_data[0]  # Get the questions list
                    status_code = parsed_data[1]  # Get the status code

                    if status_code != 200:
                        return {"error": "Failed to generate quiz"}, status_code

                    if not questions_list or not isinstance(questions_list, list):
                        logging.error(
                            f"❌ Invalid questions format: {type(questions_list)}"
                        )
                        return {"error": "Failed to generate valid quiz questions"}, 500

                    # Update player total questions count
                    for player in lobby["players"]:
                        player["totalQuestions"] = len(questions_list)

                    # Store the questions in the lobby - save the entire parsed_data
                    # This keeps the original structure for compatibility
                    lobby["questions"] = parsed_data

                    # Change game state to first question
                    lobby["game_state"] = GAME_STATE["QUESTION"]
                    lobby["current_question_idx"] = 0
                    lobby["all_answers_received"] = False

                    # Mark the game as started for backward compatibility
                    # This can be removed in future versions
                    lobby["game_started"] = True
                    lobby["game_over"] = False

                    logging.info(
                        f"✅ Multiplayer game started successfully with {len(questions_list)} questions"
                    )

                    # Start the game by broadcasting the first question
                    first_question = questions_list[0]
                    broadcast_question(lobby_code, first_question, 0)

                else:
                    logging.error(f"❌ Unexpected response format: {parsed_data}")
                    return {
                        "error": "Unexpected response format from quiz generator"
                    }, 500

            except Exception as e:
                logging.error(f"❌ Failed to parse response data: {str(e)}")
                return {"error": f"Failed to process quiz: {str(e)}"}, 500

            # Update last activity timestamp
            lobby["last_activity"] = time.time()

        except Exception as e:
            logging.error(f"❌ Failed to generate multiplayer quiz: {str(e)}")
            return {"error": f"Failed to generate quiz: {str(e)}"}, 500

    return {"success": True}, 200


def leave_lobby(lobby_code, player_name):
    """
    Leave a multiplayer lobby.

    Args:
        lobby_code (str): The code of the lobby
        player_name (str): The name of the player

    Returns:
        tuple: A tuple containing success message and status code, or error message and status code
    """
    with lobbies_lock:
        # Check if lobby exists
        if lobby_code not in active_lobbies:
            return {"error": "Lobby not found"}, 404

        lobby = active_lobbies[lobby_code]

        # Find player index
        player_index = -1
        player_id = None
        for i, player in enumerate(lobby["players"]):
            if player["name"] == player_name:
                player_index = i
                player_id = player["id"]
                break

        if player_index == -1:
            return {"error": "Player not found in lobby"}, 404

        # If the player is the host and the game hasn't started, close the lobby
        if (
            lobby["players"][player_index]["isHost"]
            and lobby["game_state"] == GAME_STATE["LOBBY"]
        ):
            del active_lobbies[lobby_code]

            # Need to broadcast to everyone else that lobby is closing
            from api.socket_server import socketio

            if socketio:
                socketio.emit(
                    "lobby_closed",
                    {
                        "message": "The host has closed the lobby",
                        "lobby_code": lobby_code,
                    },
                    room=lobby_code,
                )
        else:
            # Otherwise just remove the player
            removed_player = lobby["players"].pop(player_index)
            logging.info(f"Removed player {player_name} from lobby {lobby_code}")

            # If no players left, remove the lobby
            if not lobby["players"]:
                logging.info(f"No players left in lobby {lobby_code}, removing it")
                del active_lobbies[lobby_code]
            else:
                # Update last activity
                lobby["last_activity"] = time.time()

                # Explicitly broadcast player_left event for immediate UI updates
                from api.socket_server import socketio

                if socketio:
                    # First emit specific player_left event
                    socketio.emit(
                        "player_left",
                        {"name": player_name, "id": player_id, "lobbyCode": lobby_code},
                        room=lobby_code,
                    )

                    # Then emit a complete lobby update for synchronization
                    socketio.emit(
                        "lobby_update",
                        {"players": lobby["players"], "settings": lobby["settings"]},
                        room=lobby_code,
                    )

                    logging.info(
                        f"Broadcasted player_left and lobby_update for {player_name} in {lobby_code}"
                    )

    return {"success": True}, 200


def get_lobby_info(lobby_code):
    """
    Get information about a lobby without questions.

    Args:
        lobby_code (str): The code of the lobby

    Returns:
        tuple: A tuple containing lobby info and status code, or error message and status code
    """
    with lobbies_lock:
        # Check if lobby exists
        if lobby_code not in active_lobbies:
            return {"error": "Lobby not found"}, 404

        lobby = active_lobbies[lobby_code]

        # Update last activity
        lobby["last_activity"] = time.time()

        # Return lobby info without questions (for backward compatibility)
        return {
            "lobby_code": lobby["lobby_code"],
            "game_started": lobby["game_state"] != GAME_STATE["LOBBY"],
            "game_state": lobby["game_state"],
            "current_question_idx": lobby["current_question_idx"],
            "players": lobby["players"],
            "settings": lobby["settings"],
        }, 200


def get_game_state(lobby_code):
    """
    Get the full game state including questions.

    Args:
        lobby_code (str): The code of the lobby

    Returns:
        tuple: A tuple containing game info and status code, or error message and status code
    """
    with lobbies_lock:
        # Check if lobby exists
        if lobby_code not in active_lobbies:
            return {"error": "Lobby not found"}, 404

        lobby = active_lobbies[lobby_code]

        # Update last activity
        lobby["last_activity"] = time.time()

        # Check if game has started
        if lobby["game_state"] == GAME_STATE["LOBBY"]:
            return {"error": "Game has not started yet"}, 400

        # Return game info with questions
        return {
            "lobby_code": lobby["lobby_code"],
            "game_started": True,  # For backward compatibility
            "game_over": lobby["game_state"] == GAME_STATE["GAME_OVER"],
            "game_state": lobby["game_state"],
            "current_question_idx": lobby["current_question_idx"],
            "all_answers_received": lobby["all_answers_received"],
            "players": lobby["players"],
            "questions": lobby["questions"],
        }, 200


def submit_player_answer(
    lobby_code, player_name, question_index, answer, time_taken, is_correct, score
):
    """
    Submit a player's answer to a question.

    Args:
        lobby_code (str): The code of the lobby
        player_name (str): The name of the player
        question_index (int): The index of the question
        answer (str): The player's answer
        time_taken (float): How long the player took to answer
        is_correct (bool): Whether the answer is correct
        score (int): The score for this answer

    Returns:
        tuple: A tuple containing success message and status code, or error message and status code
    """
    with lobbies_lock:
        # Check if lobby exists
        if lobby_code not in active_lobbies:
            return {"error": "Lobby not found"}, 404

        lobby = active_lobbies[lobby_code]

        # Check if game has started
        if lobby["game_state"] == GAME_STATE["LOBBY"]:
            return {"error": "Game has not started yet"}, 400

        # Check if game is over
        if lobby["game_state"] == GAME_STATE["GAME_OVER"]:
            return {"error": "Game is already over"}, 400

        # Access the questions correctly based on the known structure
        # The questions are stored as [questions_list, status_code]
        questions_data = lobby["questions"]

        if (
            not questions_data
            or not isinstance(questions_data, list)
            or len(questions_data) < 2
        ):
            return {"error": "Invalid quiz data structure"}, 500

        # Get the actual questions list from the first element
        questions_list = questions_data[0]

        # Check if question_index is valid
        if question_index < 0 or question_index >= len(questions_list):
            return {
                "error": f"Invalid question index: {question_index} (max: {len(questions_list)-1})"
            }, 400

        # Find player
        player_found = False
        player_id = None
        for player in lobby["players"]:
            if player["name"] == player_name:
                try:
                    # Get the current question
                    current_question = questions_list[question_index]

                    # Log the current question for debugging
                    logging.info(
                        f"Question data for index {question_index}: {current_question}"
                    )

                    # Record the answer with the correct data structure
                    player["answers"].append(
                        {
                            "question": current_question["question"],
                            "userAnswer": answer,
                            "correctAnswer": current_question["correct_answer"],
                            "isCorrect": is_correct,
                            "score": score,
                        }
                    )

                    # Update player stats
                    player["currentQuestion"] = question_index + 1
                    # Ensure the score is added to the player's total score
                    player["score"] += score
                    player_id = player["id"]

                    # Log the updated score for debugging
                    logging.info(
                        f"Player {player_name} answered Q{question_index+1}, correct: {is_correct}, score: +{score}, total: {player['score']}"
                    )

                    if is_correct:
                        player["correctAnswers"] += 1

                    player_found = True

                    # Broadcast that this player has answered
                    broadcast_player_answered(
                        lobby_code, player_id, player_name, question_index
                    )

                    # Check if all players have answered this question
                    all_answered = True
                    for p in lobby["players"]:
                        if len(p["answers"]) <= question_index:
                            all_answered = False
                            break

                    if all_answered:
                        logging.info(
                            f"All players have answered question {question_index}"
                        )
                        lobby["all_answers_received"] = True

                        # Explicitly broadcast that all answers are in
                        broadcast_all_answers_in(lobby_code)

                        # Move to scoreboard state
                        lobby["game_state"] = GAME_STATE["SCOREBOARD"]

                        # Prepare scoreboard data
                        scoreboard_data = []
                        for p in lobby["players"]:
                            # Get the player's answer for this question
                            answer_data = {}
                            if question_index < len(p["answers"]):
                                answer_data = p["answers"][question_index]

                            scoreboard_data.append(
                                {
                                    "id": p["id"],
                                    "name": p["name"],
                                    "avatar": p["avatar"],
                                    "isHost": p["isHost"],
                                    "score": p["score"],
                                    "totalCorrect": p["correctAnswers"],
                                    "answer": answer_data.get(
                                        "userAnswer", "Unanswered"
                                    ),
                                    "isCorrect": answer_data.get("isCorrect", False),
                                    "answerScore": answer_data.get("score", 0),
                                }
                            )

                        # Broadcast scoreboard to all players
                        broadcast_scoreboard(lobby_code, scoreboard_data)

                        # Check if this was the last question
                        if question_index >= len(questions_list) - 1:
                            # Set game over
                            lobby["game_state"] = GAME_STATE["GAME_OVER"]
                            lobby["game_over"] = True  # For backward compatibility

                            # Create final results
                            final_results = []
                            for p in lobby["players"]:
                                final_results.append(
                                    {
                                        "id": p["id"],
                                        "name": p["name"],
                                        "isHost": p["isHost"],
                                        "avatar": p["avatar"],
                                        "score": p["score"],
                                        "correctAnswers": p["correctAnswers"],
                                        "totalQuestions": p["totalQuestions"],
                                        "answers": p["answers"],
                                    }
                                )

                            # Store and broadcast final results
                            lobby["final_results"] = final_results
                            broadcast_game_over(lobby_code, final_results)
                        else:
                            # Schedule next question after delay (handled by frontend)
                            lobby["waiting_for_next_question"] = True

                    # If not all players answered, we're in waiting state
                    else:
                        lobby["game_state"] = GAME_STATE["WAITING"]

                except Exception as e:
                    # Log the error and return a helpful error message
                    logging.error(f"Error accessing question data: {e}")
                    return {"error": f"Error processing answer: {str(e)}"}, 500

                break

        if not player_found:
            return {"error": "Player not found in lobby"}, 404

        # Update last activity
        lobby["last_activity"] = time.time()

    return {"success": True}, 200


def advance_to_next_question(lobby_code):
    """
    Advance the game to the next question.

    Args:
        lobby_code (str): The code of the lobby

    Returns:
        tuple: A tuple containing success message and status code, or error message and status code
    """
    with lobbies_lock:
        # Check if lobby exists
        if lobby_code not in active_lobbies:
            return {"error": "Lobby not found"}, 404

        lobby = active_lobbies[lobby_code]

        # More lenient check for state transition - from any state except LOBBY
        if lobby["game_state"] == GAME_STATE["LOBBY"]:
            return {"error": "Game has not started yet"}, 400

        # Set waiting_for_next_question to true so we're always ready to advance
        lobby["waiting_for_next_question"] = True

        # Get the questions list
        questions_data = lobby["questions"]
        questions_list = questions_data[0]

        # Increment question index
        next_question_idx = lobby["current_question_idx"] + 1

        # Check if we've reached the end of questions
        if next_question_idx >= len(questions_list):
            lobby["game_state"] = GAME_STATE["GAME_OVER"]
            lobby["game_over"] = True  # For backward compatibility

            # Create final results if they don't exist yet
            if "final_results" not in lobby:
                final_results = []
                for p in lobby["players"]:
                    final_results.append(
                        {
                            "id": p["id"],
                            "name": p["name"],
                            "isHost": p["isHost"],
                            "avatar": p["avatar"],
                            "score": p["score"],
                            "correctAnswers": p["correctAnswers"],
                            "totalQuestions": p["totalQuestions"],
                            "answers": p["answers"],
                        }
                    )
                lobby["final_results"] = final_results

            return {"success": True, "game_over": True}, 200

        # Update game state
        lobby["current_question_idx"] = next_question_idx
        lobby["game_state"] = GAME_STATE["QUESTION"]
        lobby["all_answers_received"] = False
        lobby["waiting_for_next_question"] = False

        # Get the next question
        next_question = questions_list[next_question_idx]

        # Broadcast the next question
        broadcast_question(lobby_code, next_question, next_question_idx)

        # Update last activity
        lobby["last_activity"] = time.time()

        return {"success": True, "question_index": next_question_idx}, 200


def get_game_results(lobby_code):
    """
    Get the results of a completed game.

    Args:
        lobby_code (str): The code of the lobby

    Returns:
        tuple: A tuple containing game results and status code, or error message and status code
    """
    with lobbies_lock:
        # Check if lobby exists
        if lobby_code not in active_lobbies:
            return {"error": "Lobby not found"}, 404

        lobby = active_lobbies[lobby_code]

        # Check if game is over
        if lobby["game_state"] != GAME_STATE["GAME_OVER"]:
            return {"error": "Game is not over yet"}, 400

        # Update last activity
        lobby["last_activity"] = time.time()

        # Return results
        if "final_results" in lobby and lobby["final_results"]:
            return {
                "lobby_code": lobby["lobby_code"],
                "players": lobby["final_results"],
            }, 200
        else:
            # Fallback to returning players if final_results is missing
            return {"lobby_code": lobby["lobby_code"], "players": lobby["players"]}, 200


def update_player_avatar(lobby_code, player_name, avatar):
    """
    Update a player's avatar in a lobby.

    Args:
        lobby_code (str): The code of the lobby
        player_name (str): The name of the player to update
        avatar (str): The new avatar emoji

    Returns:
        tuple: A tuple containing success message and status code, or error message and status code
    """
    with lobbies_lock:
        # Check if lobby exists
        if lobby_code not in active_lobbies:
            return {"error": "Lobby not found"}, 404

        lobby = active_lobbies[lobby_code]

        # Find player and update avatar
        player_found = False
        for player in lobby["players"]:
            if player["name"] == player_name:
                player["avatar"] = avatar
                player_found = True
                break

        if not player_found:
            return {"error": "Player not found in lobby"}, 404

        # Update last activity
        lobby["last_activity"] = time.time()

        # Broadcast player update
        broadcast_lobby_update(lobby_code, {"players": lobby["players"]})

    return {"success": True, "avatar": avatar}, 200


# Broadcasting functions that use delayed imports to avoid circular references
def broadcast_lobby_update(lobby_code, data):
    """Broadcast a lobby update to all clients in the room."""
    from api.socket_server import (
        broadcast_lobby_update as socket_broadcast_lobby_update,
    )

    socket_broadcast_lobby_update(lobby_code, data)


def broadcast_question(lobby_code, question, question_index):
    """Broadcast a new question to all clients in the room."""
    from api.socket_server import broadcast_question as socket_broadcast_question

    socket_broadcast_question(lobby_code, question, question_index)


def broadcast_player_answered(lobby_code, player_id, player_name, question_index):
    """Broadcast that a player has answered to all clients in the room."""
    from api.socket_server import (
        broadcast_player_answered as socket_broadcast_player_answered,
    )

    socket_broadcast_player_answered(lobby_code, player_id, player_name, question_index)


def broadcast_all_answers_in(lobby_code):
    """Broadcast that all players have answered to all clients in the room."""
    from api.socket_server import (
        broadcast_all_answers_in as socket_broadcast_all_answers_in,
    )

    socket_broadcast_all_answers_in(lobby_code)


def broadcast_scoreboard(lobby_code, scoreboard_data):
    """Broadcast scoreboard data to all clients in the room."""
    from api.socket_server import broadcast_scoreboard as socket_broadcast_scoreboard

    socket_broadcast_scoreboard(lobby_code, scoreboard_data)


def broadcast_game_over(lobby_code, final_results):
    """Broadcast game over and final results to all clients in the room."""
    from api.socket_server import broadcast_game_over as socket_broadcast_game_over

    socket_broadcast_game_over(lobby_code, final_results)

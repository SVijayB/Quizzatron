"""Module for managing multiplayer quiz game functionality."""

import uuid
import random
import time
import threading
import logging
from flask import jsonify
from api.services.quiz_gen_service import generate_quiz

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
        "game_started": False,
        "game_over": False,
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
    }

    with lobbies_lock:
        active_lobbies[lobby_code] = lobby

    return lobby


def join_existing_lobby(lobby_code, player_name, player_avatar):
    """
    Add a player to an existing lobby.

    Args:
        lobby_code (str): The code of the lobby to join
        player_name (str): The name of the joining player
        player_avatar (str): The avatar of the joining player

    Returns:
        tuple: A tuple containing player ID and status code, or error message and status code
    """
    with lobbies_lock:
        # Check if lobby exists
        if lobby_code not in active_lobbies:
            return {"error": "Lobby not found"}, 404

        lobby = active_lobbies[lobby_code]

        # Check if game already started
        if lobby["game_started"]:
            return {"error": "Game has already started"}, 403

        # Check if name is already taken
        if any(player["name"] == player_name for player in lobby["players"]):
            return {"error": "Name already taken"}, 409

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

    return {"player_id": player_id}, 200


def update_player_ready_status(lobby_code, player_name, ready_status):
    """
    Update a player's ready status in a lobby.

    Args:
        lobby_code (str): The code of the lobby
        player_name (str): The name of the player to update
        ready_status (bool): The new ready status

    Returns:
        tuple: A tuple containing success message and status code, or error message and status code
    """
    with lobbies_lock:
        # Check if lobby exists
        if lobby_code not in active_lobbies:
            return {"error": "Lobby not found"}, 404

        lobby = active_lobbies[lobby_code]

        # Find player and update ready status
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
    with lobbies_lock:
        # Check if lobby exists
        if lobby_code not in active_lobbies:
            return {"error": "Lobby not found"}, 404

        lobby = active_lobbies[lobby_code]

        # Update settings
        lobby["settings"].update(new_settings)

        # Update last activity
        lobby["last_activity"] = time.time()

    return {"success": True}, 200


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
        }

        # Remove None values to prevent errors
        quiz_params = {k: v for k, v in quiz_params.items() if v is not None}

        try:
            # Generate the quiz using the existing service
            logging.info("⏳ Generating multiplayer quiz with params: %s", quiz_params)

            # Call generate_quiz which returns a response
            response = generate_quiz(**quiz_params)

            # The response from generate_quiz is actually a Flask Response object
            # We need to convert it to the expected JSON format
            try:
                import json

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
                            "❌ Invalid questions format: %s", type(questions_list)
                        )
                        return {"error": "Failed to generate valid quiz questions"}, 500

                    # Update player total questions count
                    for player in lobby["players"]:
                        player["totalQuestions"] = len(questions_list)

                    # Store the questions in the lobby - save the entire parsed_data
                    # This keeps the original structure for compatibility
                    lobby["questions"] = parsed_data

                    # Mark the game as started
                    lobby["game_started"] = True
                    logging.info(
                        "✅ Multiplayer game started successfully with %d questions",
                        len(questions_list),
                    )
                else:
                    logging.error("❌ Unexpected response format: %s", parsed_data)
                    return {
                        "error": "Unexpected response format from quiz generator"
                    }, 500

            except Exception as e:
                logging.error("❌ Failed to parse response data: %s", str(e))
                return {"error": f"Failed to process quiz: {str(e)}"}, 500

            # Update last activity timestamp
            lobby["last_activity"] = time.time()

        except Exception as e:
            logging.error("❌ Failed to generate multiplayer quiz: %s", str(e))
            return {"error": f"Failed to generate quiz: {str(e)}"}, 500

    return {"success": True}, 200


def leave_lobby(lobby_code, player_name):
    """
    Remove a player from a lobby or delete the lobby if the host leaves.

    Args:
        lobby_code (str): The code of the lobby
        player_name (str): The name of the player leaving

    Returns:
        tuple: A tuple containing success message and status code, or error message and status code
    """
    with lobbies_lock:
        # Check if lobby exists
        if lobby_code not in active_lobbies:
            return {"error": "Lobby not found"}, 404

        lobby = active_lobbies[lobby_code]

        # Find player index
        player_index = None
        for i, player in enumerate(lobby["players"]):
            if player["name"] == player_name:
                player_index = i
                break

        if player_index is None:
            return {"error": "Player not found in lobby"}, 404

        # Check if player is host
        if lobby["players"][player_index]["isHost"]:
            # If host leaves, remove the entire lobby
            del active_lobbies[lobby_code]
        else:
            # Otherwise just remove the player
            lobby["players"].pop(player_index)

            # If no players left, remove the lobby
            if not lobby["players"]:
                del active_lobbies[lobby_code]
            else:
                # Update last activity
                lobby["last_activity"] = time.time()

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

        # Return lobby info without questions
        return {
            "lobby_code": lobby["lobby_code"],
            "game_started": lobby["game_started"],
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
        if not lobby["game_started"]:
            return {"error": "Game has not started yet"}, 400

        # Return game info with questions
        return {
            "lobby_code": lobby["lobby_code"],
            "game_started": lobby["game_started"],
            "game_over": lobby["game_over"],
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
        player_name (str): The name of the player submitting an answer
        question_index (int): The index of the question being answered
        answer (str): The player's answer
        time_taken (float): The time taken to answer
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
        if not lobby["game_started"]:
            return {"error": "Game has not started yet"}, 400

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
        for player in lobby["players"]:
            if player["name"] == player_name:
                try:
                    # Get the current question - accessing from the first element of the array
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
                    player["score"] += score
                    if is_correct:
                        player["correctAnswers"] += 1

                    player_found = True

                    # Check if game is over for this player
                    if player["currentQuestion"] >= len(questions_list):
                        # Check if all players have finished
                        all_finished = True
                        for p in lobby["players"]:
                            if p["currentQuestion"] < len(questions_list):
                                all_finished = False
                                break

                        if all_finished:
                            lobby["game_over"] = True

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
        if not lobby["game_over"]:
            return {"error": "Game is not over yet"}, 400

        # Update last activity
        lobby["last_activity"] = time.time()

        # Return results
        return {"lobby_code": lobby["lobby_code"], "players": lobby["players"]}, 200

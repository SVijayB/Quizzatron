"""Utility functions for multiplayer game management."""

import json
import logging
import time
import uuid
from api.services.quiz_gen_service import generate_quiz
from api.services.triviaqa_api import get_triviaqa
from api.utils.category_aggregator import get_categories
from api.utils.multiplayer_lobby import (
    active_lobbies,
    lobbies_lock,
    GAME_STATE,
    generate_lobby_code,
)
from api.utils.multiplayer_broadcast import broadcast_lobby_update, broadcast_question


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
            "model": "gemini/gemini-2.5-flash",
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

        # Broadcast lobby update via WebSocket
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
    # Only log essential settings info - not every update
    important_setting_changes = {}
    for key in ["numQuestions", "difficulty", "topic"]:
        if key in new_settings:
            important_setting_changes[key] = new_settings[key]

    if important_setting_changes:
        logging.debug(
            f"Updating key settings for lobby {lobby_code}: {important_setting_changes}"
        )

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

        # Update settings without excessive logging
        for key, value in new_settings.items():
            lobby["settings"][key] = value

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

        # Log important game start information
        logging.info(
            f"Starting multiplayer game in lobby {lobby_code} with settings: "
            + f"{settings['numQuestions']} questions, "
            + f"difficulty: {settings['difficulty']}, "
            + f"topic: {settings['topic'] or 'random'}, "
            + f"players: {len(lobby['players'])}"
        )

        # Check if the topic is a predefined category (DB/API) or a custom topic
        known_categories = get_categories()
        topic = settings.get("topic")
        is_predefined = topic and topic in known_categories

        try:
            if is_predefined:
                # ── Predefined category: fetch from OpenTDB API or MongoDB ──
                logging.info(
                    "📚 Multiplayer: Using predefined category '%s' from DB/API",
                    topic,
                )
                difficulty = (
                    settings["difficulty"]
                    if settings["difficulty"] != "mixed"
                    else "medium"
                )
                trivia_result = get_triviaqa(
                    topic, settings["numQuestions"], difficulty
                )

                # get_triviaqa returns {"questions": [...]} dict, a string error, or None
                if isinstance(trivia_result, dict) and "questions" in trivia_result:
                    questions_list = trivia_result["questions"]
                elif isinstance(trivia_result, list):
                    questions_list = trivia_result
                else:
                    logging.error(
                        "Failed to fetch predefined quiz questions for '%s': %s",
                        topic,
                        trivia_result,
                    )
                    return {"error": "Failed to fetch quiz questions for this category"}, 500

                if not questions_list:
                    logging.error(
                        "Empty questions list for predefined category '%s'", topic
                    )
                    return {"error": "No questions available for this category"}, 500

                # Update player total questions count
                for player in lobby["players"]:
                    player["totalQuestions"] = len(questions_list)

                # Store questions in the same [questions, status] format
                lobby["questions"] = [questions_list, 200]

                # Change game state to first question
                lobby["game_state"] = GAME_STATE["QUESTION"]
                lobby["current_question_idx"] = 0
                lobby["all_answers_received"] = False
                lobby["game_started"] = True
                lobby["game_over"] = False

                logging.info(
                    "Game started successfully in lobby %s with %d questions (predefined)",
                    lobby_code,
                    len(questions_list),
                )

                # Broadcast the first question
                first_question = questions_list[0]
                broadcast_question(lobby_code, first_question, 0)

            else:
                # ── Custom topic: generate via LLM ──
                quiz_params = {
                    "num_questions": settings["numQuestions"],
                    "difficulty": (
                        settings["difficulty"]
                        if settings["difficulty"] != "mixed"
                        else "medium"
                    ),
                    "model": settings["model"],
                    "topic": topic,
                    "image": settings.get("includeImages", False),
                }

                # Remove None values to prevent errors
                quiz_params = {k: v for k, v in quiz_params.items() if v is not None}

                # Generate the quiz using the existing service
                response = generate_quiz(**quiz_params)

                # The response from generate_quiz can be either:
                # - A Flask Response object (success case via jsonify)
                # - A tuple of (Response, status_code) (error cases)
                try:
                    # Handle tuple vs Response return
                    if isinstance(response, tuple):
                        flask_response, status_code = response
                        if status_code != 200:
                            error_data = json.loads(flask_response.get_data(as_text=True))
                            logging.error(
                                f"Quiz generation failed with status {status_code}: {error_data}"
                            )
                            return {"error": error_data.get("error", "Failed to generate quiz")}, status_code
                        response_data = flask_response.get_data(as_text=True)
                    else:
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
                                f"Failed to generate valid quiz questions: {type(questions_list)}"
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
                            f"Game started successfully in lobby {lobby_code} with {len(questions_list)} questions"
                        )

                        # Start the game by broadcasting the first question
                        first_question = questions_list[0]
                        broadcast_question(lobby_code, first_question, 0)

                    else:
                        logging.error(
                            f"Unexpected response format from quiz generator: {parsed_data}"
                        )
                        return {
                            "error": "Unexpected response format from quiz generator"
                        }, 500

                except Exception as e:
                    logging.error(f"Failed to parse response data: {str(e)}")
                    return {"error": f"Failed to process quiz: {str(e)}"}, 500

            # Update last activity timestamp
            lobby["last_activity"] = time.time()

        except Exception as e:
            logging.error(f"Failed to generate multiplayer quiz: {str(e)}")
            return {"error": f"Failed to generate quiz: {str(e)}"}, 500

    return {"success": True}, 200

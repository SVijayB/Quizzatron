"""Utility functions for multiplayer player management."""

import logging
import time
from api.utils.multiplayer_lobby import active_lobbies, lobbies_lock, GAME_STATE
from api.utils.multiplayer_broadcast import (
    broadcast_player_answered,
    broadcast_all_answers_in,
    broadcast_scoreboard,
    broadcast_game_over,
    broadcast_lobby_update,
    broadcast_question,
)


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

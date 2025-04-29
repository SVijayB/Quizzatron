"""Tests for multiplayer_player.py module."""

import pytest
from unittest.mock import patch, MagicMock
import time
from api.utils.multiplayer_player import (
    leave_lobby,
    get_lobby_info,
    get_game_state,
    submit_player_answer,
    advance_to_next_question,
    get_game_results,
    update_player_avatar,
)
from api.utils.multiplayer_lobby import GAME_STATE


# Mock data for testing
@pytest.fixture
def mock_lobby():
    """Create a mock lobby for testing."""
    return {
        "lobby_code": "TEST123",
        "game_state": GAME_STATE["LOBBY"],
        "players": [
            {
                "id": "player1",
                "name": "Player1",
                "isHost": True,
                "avatar": "👑",
                "score": 0,
                "correctAnswers": 0,
                "currentQuestion": 0,
                "totalQuestions": 5,
                "answers": [],
                "session_id": "session1",
            },
            {
                "id": "player2",
                "name": "Player2",
                "isHost": False,
                "avatar": "🎮",
                "score": 0,
                "correctAnswers": 0,
                "currentQuestion": 0,
                "totalQuestions": 5,
                "answers": [],
                "session_id": "session2",
            },
        ],
        "settings": {"category": "General", "difficulty": "medium"},
        "current_question_idx": 0,
        "all_answers_received": False,
        "waiting_for_next_question": False,
        "last_activity": time.time(),
        "questions": [
            [
                {
                    "question": "What is 2+2?",
                    "correct_answer": "4",
                    "incorrect_answers": ["3", "5", "6"],
                },
                {
                    "question": "What is the capital of France?",
                    "correct_answer": "Paris",
                    "incorrect_answers": ["London", "Berlin", "Rome"],
                },
            ],
            200,  # status code
        ],
    }


@pytest.fixture
def mock_active_lobbies(mock_lobby):
    """Create mock active lobbies dictionary."""
    return {"TEST123": mock_lobby}


@patch("api.utils.multiplayer_player.active_lobbies", {})
@patch("api.utils.multiplayer_player.lobbies_lock")
def test_leave_lobby_host_in_lobby(mock_lock, mock_active_lobbies, mock_lobby):
    """Test leaving a lobby as the host when game hasn't started."""
    with patch("api.utils.multiplayer_player.active_lobbies", {"TEST123": mock_lobby}):
        with patch("api.socket_server.socketio") as mock_socketio:
            result, code = leave_lobby("TEST123", "Player1")

            # The host left during lobby state, so the lobby should be removed
            assert result == {"success": True}
            assert code == 200
            mock_socketio.emit.assert_called()


@patch("api.utils.multiplayer_player.active_lobbies", {})
@patch("api.utils.multiplayer_player.lobbies_lock")
def test_leave_lobby_non_host(mock_lock, mock_active_lobbies, mock_lobby):
    """Test leaving a lobby as a non-host player."""
    with patch("api.utils.multiplayer_player.active_lobbies", {"TEST123": mock_lobby}):
        with patch("api.socket_server.socketio") as mock_socketio:
            result, code = leave_lobby("TEST123", "Player2")

            assert result == {"success": True}
            assert code == 200
            assert len(mock_lobby["players"]) == 1  # Player2 should be removed
            mock_socketio.emit.assert_called()


@patch("api.utils.multiplayer_player.active_lobbies", {})
@patch("api.utils.multiplayer_player.lobbies_lock")
def test_leave_lobby_not_found(mock_lock):
    """Test leaving a lobby that doesn't exist."""
    result, code = leave_lobby("NONEXISTENT", "Player1")
    assert result == {"error": "Lobby not found"}
    assert code == 404


@patch("api.utils.multiplayer_player.active_lobbies", {})
@patch("api.utils.multiplayer_player.lobbies_lock")
def test_get_lobby_info(mock_lock, mock_active_lobbies, mock_lobby):
    """Test getting lobby information."""
    with patch("api.utils.multiplayer_player.active_lobbies", {"TEST123": mock_lobby}):
        result, code = get_lobby_info("TEST123")

        assert code == 200
        assert result["lobby_code"] == "TEST123"
        assert "players" in result
        assert "settings" in result
        assert result["game_started"] is False


@patch("api.utils.multiplayer_player.active_lobbies", {})
@patch("api.utils.multiplayer_player.lobbies_lock")
def test_get_game_state_not_started(mock_lock, mock_active_lobbies, mock_lobby):
    """Test getting game state when game hasn't started."""
    with patch("api.utils.multiplayer_player.active_lobbies", {"TEST123": mock_lobby}):
        result, code = get_game_state("TEST123")

        assert code == 400
        assert "error" in result


@patch("api.utils.multiplayer_player.active_lobbies", {})
@patch("api.utils.multiplayer_player.lobbies_lock")
def test_get_game_state_in_progress(mock_lock, mock_active_lobbies, mock_lobby):
    """Test getting game state when game is in progress."""
    mock_lobby["game_state"] = GAME_STATE["QUESTION"]  # Game is started

    with patch("api.utils.multiplayer_player.active_lobbies", {"TEST123": mock_lobby}):
        result, code = get_game_state("TEST123")

        assert code == 200
        assert result["lobby_code"] == "TEST123"
        assert result["game_started"] is True
        assert "questions" in result


@patch("api.utils.multiplayer_player.active_lobbies", {})
@patch("api.utils.multiplayer_player.lobbies_lock")
def test_submit_player_answer(mock_lock, mock_active_lobbies, mock_lobby):
    """Test submitting a player's answer."""
    mock_lobby["game_state"] = GAME_STATE["QUESTION"]  # Game is started

    with patch("api.utils.multiplayer_player.active_lobbies", {"TEST123": mock_lobby}):
        with patch(
            "api.utils.multiplayer_player.broadcast_player_answered"
        ) as mock_broadcast:
            result, code = submit_player_answer(
                "TEST123", "Player1", 0, "4", 3.5, True, 100
            )

            assert code == 200
            assert result["success"] is True
            mock_broadcast.assert_called_once()

            # Check player's score and answers were updated
            player = mock_lobby["players"][0]
            assert player["score"] == 100
            assert len(player["answers"]) == 1
            assert player["correctAnswers"] == 1


@patch("api.utils.multiplayer_player.active_lobbies", {})
@patch("api.utils.multiplayer_player.lobbies_lock")
def test_advance_to_next_question(mock_lock, mock_active_lobbies, mock_lobby):
    """Test advancing to the next question."""
    mock_lobby["game_state"] = GAME_STATE["QUESTION"]  # Game is started

    with patch("api.utils.multiplayer_player.active_lobbies", {"TEST123": mock_lobby}):
        with patch("api.utils.multiplayer_player.broadcast_question") as mock_broadcast:
            result, code = advance_to_next_question("TEST123")

            assert code == 200
            assert result["success"] is True
            assert "question_index" in result
            mock_broadcast.assert_called_once()
            assert mock_lobby["current_question_idx"] == 1  # Advanced from 0 to 1


@patch("api.utils.multiplayer_player.active_lobbies", {})
@patch("api.utils.multiplayer_player.lobbies_lock")
def test_get_game_results_not_over(mock_lock, mock_active_lobbies, mock_lobby):
    """Test getting game results when game isn't over."""
    mock_lobby["game_state"] = GAME_STATE["QUESTION"]  # Game is in progress

    with patch("api.utils.multiplayer_player.active_lobbies", {"TEST123": mock_lobby}):
        result, code = get_game_results("TEST123")

        assert code == 400
        assert "error" in result


@patch("api.utils.multiplayer_player.active_lobbies", {})
@patch("api.utils.multiplayer_player.lobbies_lock")
def test_get_game_results_over(mock_lock, mock_active_lobbies, mock_lobby):
    """Test getting game results when game is over."""
    mock_lobby["game_state"] = GAME_STATE["GAME_OVER"]  # Game is over
    mock_lobby["final_results"] = [
        {"name": "Player1", "score": 500, "correctAnswers": 5},
        {"name": "Player2", "score": 300, "correctAnswers": 3},
    ]

    with patch("api.utils.multiplayer_player.active_lobbies", {"TEST123": mock_lobby}):
        result, code = get_game_results("TEST123")

        assert code == 200
        assert "players" in result
        assert len(result["players"]) == 2


@patch("api.utils.multiplayer_player.active_lobbies", {})
@patch("api.utils.multiplayer_player.lobbies_lock")
def test_update_player_avatar(mock_lock, mock_active_lobbies, mock_lobby):
    """Test updating a player's avatar."""
    with patch("api.utils.multiplayer_player.active_lobbies", {"TEST123": mock_lobby}):
        with patch(
            "api.utils.multiplayer_player.broadcast_lobby_update"
        ) as mock_broadcast:
            result, code = update_player_avatar("TEST123", "Player1", "🚀")

            assert code == 200
            assert result["success"] is True
            assert result["avatar"] == "🚀"
            assert mock_lobby["players"][0]["avatar"] == "🚀"
            mock_broadcast.assert_called_once()

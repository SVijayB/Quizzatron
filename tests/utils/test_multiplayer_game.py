"""Tests for multiplayer_game.py module."""

import pytest
from unittest.mock import patch, MagicMock
import time
from api.utils.multiplayer_lobby import GAME_STATE
from api.utils.multiplayer_game import create_new_lobby, join_existing_lobby, start_game, update_lobby_settings


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
            }
        ],
        "settings": {"category": "General", "difficulty": "medium"},
        "current_question_idx": 0,
        "all_answers_received": False,
        "waiting_for_next_question": False,
        "last_activity": time.time(),
    }


@pytest.fixture
def mock_quiz_data():
    """Create mock quiz data for testing."""
    return [
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
    ]


@patch("api.utils.multiplayer_game.active_lobbies", {})
@patch("api.utils.multiplayer_game.lobbies_lock")
def test_create_lobby(mock_lock):
    """Test creating a new lobby."""
    with patch("api.utils.multiplayer_game.generate_lobby_code") as mock_gen_code:
        mock_gen_code.return_value = "TEST123"

        result, code = create_new_lobby("Player1", "👑")

        assert code == 200
        assert result["lobby_code"] == "TEST123"
        assert "host_id" in result


@patch("api.utils.multiplayer_game.active_lobbies", {})
@patch("api.utils.multiplayer_game.lobbies_lock")
def test_join_lobby_success(mock_lock, mock_lobby):
    """Test joining an existing lobby successfully."""
    with patch("api.utils.multiplayer_game.active_lobbies", {"TEST123": mock_lobby}):
        with patch(
            "api.utils.multiplayer_game.broadcast_lobby_update"
        ) as mock_broadcast:
            result, code = join_existing_lobby("TEST123", "Player2", "🎮")
            
            assert code == 200
            assert "player_id" in result
            assert len(mock_lobby["players"]) == 2
            assert mock_lobby["players"][1]["name"] == "Player2"
            assert mock_lobby["players"][1]["isHost"] is False
            mock_broadcast.assert_called_once()


@patch("api.utils.multiplayer_game.active_lobbies", {})
@patch("api.utils.multiplayer_game.lobbies_lock")
def test_join_lobby_not_found(mock_lock):
    """Test joining a non-existent lobby."""
    result, code = join_existing_lobby("NONEXISTENT", "Player1")

    assert code == 404
    assert "error" in result


@patch("api.utils.multiplayer_game.active_lobbies", {})
@patch("api.utils.multiplayer_game.lobbies_lock")
def test_join_lobby_already_started(mock_lock, mock_lobby):
    """Test joining a lobby where game has already started."""
    mock_lobby["game_state"] = GAME_STATE["QUESTION"]  # Game is started

    with patch("api.utils.multiplayer_game.active_lobbies", {"TEST123": mock_lobby}):
        result, code = join_existing_lobby("TEST123", "Player2")

        assert code == 400
        assert "error" in result
        assert "already started" in result["error"]


@patch("api.utils.multiplayer_game.active_lobbies", {})
@patch("api.utils.multiplayer_game.lobbies_lock")
def test_join_lobby_duplicate_name(mock_lock, mock_lobby):
    """Test joining a lobby with duplicate player name."""
    with patch("api.utils.multiplayer_game.active_lobbies", {"TEST123": mock_lobby}):
        result, code = join_existing_lobby("TEST123", "Player1")  # Same as existing player

        assert code == 400
        assert "error" in result
        assert "already in use" in result["error"]


@patch("api.utils.multiplayer_game.active_lobbies", {})
@patch("api.utils.multiplayer_game.lobbies_lock")
def test_start_game_success(mock_lock, mock_lobby, mock_quiz_data):
    """Test starting a game successfully."""
    with patch("api.utils.multiplayer_game.active_lobbies", {"TEST123": mock_lobby}):
        with patch("api.utils.multiplayer_game.get_questions") as mock_get_questions:
            with patch(
                "api.utils.multiplayer_game.broadcast_question"
            ) as mock_broadcast:
                mock_get_questions.return_value = mock_quiz_data

                result, code = start_game("TEST123")

                assert code == 200
                assert result["success"] is True
                assert mock_lobby["game_state"] == GAME_STATE["QUESTION"]
                assert mock_lobby["current_question_idx"] == 0
                assert mock_lobby["questions"] == mock_quiz_data
                mock_get_questions.assert_called_once()
                mock_broadcast.assert_called_once()


@patch("api.utils.multiplayer_game.active_lobbies", {})
@patch("api.utils.multiplayer_game.lobbies_lock")
def test_start_game_not_found(mock_lock):
    """Test starting a game for a non-existent lobby."""
    result, code = start_game("NONEXISTENT")

    assert code == 404
    assert "error" in result


@patch("api.utils.multiplayer_game.active_lobbies", {})
@patch("api.utils.multiplayer_game.lobbies_lock")
def test_start_game_already_started(mock_lock, mock_lobby):
    """Test starting a game that has already started."""
    mock_lobby["game_state"] = GAME_STATE["QUESTION"]  # Game is started

    with patch("api.utils.multiplayer_game.active_lobbies", {"TEST123": mock_lobby}):
        result, code = start_game("TEST123")

        assert code == 400
        assert "error" in result
        assert "already started" in result["error"]


@patch("api.utils.multiplayer_game.active_lobbies", {})
@patch("api.utils.multiplayer_game.lobbies_lock")
def test_start_game_question_failure(mock_lock, mock_lobby):
    """Test starting a game when question retrieval fails."""
    with patch("api.utils.multiplayer_game.active_lobbies", {"TEST123": mock_lobby}):
        with patch("api.utils.multiplayer_game.get_questions") as mock_get_questions:
            mock_get_questions.return_value = (
                {"error": "Failed to get questions"},
                500,
            )

            result, code = start_game("TEST123")

            assert code == 500
            assert "error" in result
            assert (
                mock_lobby["game_state"] == GAME_STATE["LOBBY"]
            )  # Still in lobby state

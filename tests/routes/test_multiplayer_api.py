"""Tests for multiplayer_api.py routes."""

import pytest
import json
from unittest.mock import patch, MagicMock


@pytest.fixture
def mock_response():
    """Create a mock response for service functions."""
    return {"success": True}, 200


@pytest.fixture
def mock_lobby_data():
    """Create mock lobby data."""
    return {
        "lobby_code": "TEST123",
        "players": [
            {"name": "Player1", "isHost": True, "score": 100},
            {"name": "Player2", "isHost": False, "score": 50},
        ],
        "settings": {"category": "General", "difficulty": "medium"},
    }


def test_create_lobby(test_client):
    """Test creating a lobby."""
    with patch("api.routes.multiplayer_api.create_lobby") as mock_create_lobby:
        mock_create_lobby.return_value = (
            {"lobby_code": "TEST123", "success": True},
            200,
        )

        response = test_client.post(
            "/api/multiplayer/create",
            json={"host_name": "Player1", "settings": {"category": "General"}},
        )

        assert response.status_code == 200
        data = json.loads(response.data)
        assert "lobby_code" in data
        assert data["success"] is True
        mock_create_lobby.assert_called_once()


def test_join_lobby(test_client):
    """Test joining a lobby."""
    with patch("api.routes.multiplayer_api.join_lobby") as mock_join_lobby:
        mock_join_lobby.return_value = ({"success": True}, 200)

        response = test_client.post(
            "/api/multiplayer/join",
            json={"player_name": "Player2", "lobby_code": "TEST123"},
        )

        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["success"] is True
        mock_join_lobby.assert_called_once()


def test_leave_lobby(test_client):
    """Test leaving a lobby."""
    with patch("api.routes.multiplayer_api.leave_lobby") as mock_leave_lobby:
        mock_leave_lobby.return_value = ({"success": True}, 200)

        response = test_client.post(
            "/api/multiplayer/leave",
            json={"player_name": "Player1", "lobby_code": "TEST123"},
        )

        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["success"] is True
        mock_leave_lobby.assert_called_once()


def test_get_lobby_info(test_client):
    """Test getting lobby information."""
    with patch("api.routes.multiplayer_api.get_lobby_info") as mock_get_lobby:
        mock_get_lobby.return_value = ({"lobby_code": "TEST123", "players": []}, 200)

        response = test_client.get("/api/multiplayer/lobby/TEST123")

        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["lobby_code"] == "TEST123"
        mock_get_lobby.assert_called_once_with("TEST123")


def test_start_game(test_client):
    """Test starting a game."""
    with patch("api.routes.multiplayer_api.start_game") as mock_start_game:
        mock_start_game.return_value = ({"success": True}, 200)

        response = test_client.post(
            "/api/multiplayer/start", json={"lobby_code": "TEST123"}
        )

        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["success"] is True
        mock_start_game.assert_called_once()


def test_get_game_state(test_client):
    """Test getting game state."""
    with patch("api.routes.multiplayer_api.get_game_state") as mock_get_state:
        mock_get_state.return_value = (
            {"game_started": True, "current_question_idx": 0},
            200,
        )

        response = test_client.get("/api/multiplayer/game/TEST123")

        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["game_started"] is True
        assert data["current_question_idx"] == 0
        mock_get_state.assert_called_once_with("TEST123")


def test_submit_answer(test_client):
    """Test submitting an answer."""
    with patch("api.routes.multiplayer_api.submit_player_answer") as mock_submit:
        mock_submit.return_value = ({"success": True}, 200)

        response = test_client.post(
            "/api/multiplayer/answer",
            json={
                "lobby_code": "TEST123",
                "player_name": "Player1",
                "question_index": 0,
                "answer": "Paris",
                "time_taken": 3.5,
                "is_correct": True,
                "score": 100,
            },
        )

        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["success"] is True
        mock_submit.assert_called_once()


def test_next_question(test_client):
    """Test advancing to next question."""
    with patch("api.routes.multiplayer_api.advance_to_next_question") as mock_next:
        mock_next.return_value = ({"success": True, "question_index": 1}, 200)

        response = test_client.post(
            "/api/multiplayer/next", json={"lobby_code": "TEST123"}
        )

        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["success"] is True
        assert data["question_index"] == 1
        mock_next.assert_called_once()


def test_get_results(test_client):
    """Test getting game results."""
    with patch("api.routes.multiplayer_api.get_game_results") as mock_results:
        mock_results.return_value = (
            {
                "lobby_code": "TEST123",
                "players": [
                    {"name": "Player1", "score": 500},
                    {"name": "Player2", "score": 300},
                ],
            },
            200,
        )

        response = test_client.get("/api/multiplayer/results/TEST123")

        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["lobby_code"] == "TEST123"
        assert len(data["players"]) == 2
        mock_results.assert_called_once_with("TEST123")


def test_update_avatar(test_client):
    """Test updating player avatar."""
    with patch("api.routes.multiplayer_api.update_player_avatar") as mock_update:
        mock_update.return_value = ({"success": True, "avatar": "🚀"}, 200)

        response = test_client.post(
            "/api/multiplayer/avatar",
            json={"lobby_code": "TEST123", "player_name": "Player1", "avatar": "🚀"},
        )

        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["success"] is True
        assert data["avatar"] == "🚀"
        mock_update.assert_called_once()


def test_error_handling(test_client):
    """Test error handling in the routes."""
    with patch("api.routes.multiplayer_api.create_lobby") as mock_create_lobby:
        mock_create_lobby.return_value = ({"error": "Invalid data"}, 400)

        response = test_client.post(
            "/api/multiplayer/create", json={"settings": {}}  # Missing host_name
        )

        assert response.status_code == 400
        data = json.loads(response.data)
        assert "error" in data

"""Tests for socket_server.py."""

import pytest
from unittest.mock import MagicMock, patch
from flask import Flask
from flask_socketio import SocketIO
from api.socket_server import (
    SocketServer,
    broadcast_lobby_update,
    broadcast_question,
    broadcast_player_answered,
    broadcast_all_answers_in,
    broadcast_scoreboard,
    broadcast_game_over,
)


@pytest.fixture
def mock_socketio():
    """Create a mock SocketIO instance."""
    return MagicMock(spec=SocketIO)


@pytest.fixture
def flask_app():
    """Create a Flask app for testing."""
    return Flask(__name__)


def test_init_socketio(flask_app):
    """Test initializing SocketIO."""
    with patch("api.socket_server.SocketServer.setup_socket_handlers") as mock_setup:
        socketio = SocketServer.init_socketio(flask_app)
        assert socketio is not None
        mock_setup.assert_called_once_with(socketio)


@patch("api.socket_server.SocketServer.get_instance")
def test_broadcast_lobby_update(mock_get_instance):
    """Test broadcasting lobby updates."""
    mock_socketio = MagicMock()
    mock_get_instance.return_value = mock_socketio

    lobby_code = "ABC123"
    data = {"players": [{"name": "Player1"}]}

    broadcast_lobby_update(lobby_code, data)
    mock_socketio.emit.assert_called_once_with("lobby_update", data, room=lobby_code)


@patch("api.socket_server.SocketServer.get_instance")
def test_broadcast_question(mock_get_instance):
    """Test broadcasting a question."""
    mock_socketio = MagicMock()
    mock_get_instance.return_value = mock_socketio

    lobby_code = "ABC123"
    question = {"question": "What is 2+2?", "answers": ["3", "4", "5"]}
    question_index = 0

    broadcast_question(lobby_code, question, question_index)
    mock_socketio.emit.assert_called_once_with(
        "new_question", {"question": question, "index": question_index}, room=lobby_code
    )


@patch("api.socket_server.SocketServer.get_instance")
def test_broadcast_player_answered(mock_get_instance):
    """Test broadcasting when a player answers a question."""
    mock_socketio = MagicMock()
    mock_get_instance.return_value = mock_socketio

    lobby_code = "ABC123"
    player_id = "player1"
    player_name = "John"
    question_index = 0

    broadcast_player_answered(lobby_code, player_id, player_name, question_index)
    mock_socketio.emit.assert_called_once()


@patch("api.socket_server.SocketServer.get_instance")
def test_broadcast_all_answers_in(mock_get_instance):
    """Test broadcasting when all answers are in."""
    mock_socketio = MagicMock()
    mock_get_instance.return_value = mock_socketio

    lobby_code = "ABC123"

    broadcast_all_answers_in(lobby_code)
    mock_socketio.emit.assert_called_once_with("all_answers_in", {}, room=lobby_code)


@patch("api.socket_server.SocketServer.get_instance")
def test_broadcast_scoreboard(mock_get_instance):
    """Test broadcasting the scoreboard."""
    mock_socketio = MagicMock()
    mock_get_instance.return_value = mock_socketio

    lobby_code = "ABC123"
    scoreboard_data = [{"name": "Player1", "score": 100}]

    broadcast_scoreboard(lobby_code, scoreboard_data)
    mock_socketio.emit.assert_called_once_with(
        "scoreboard", {"players": scoreboard_data}, room=lobby_code
    )


@patch("api.socket_server.SocketServer.get_instance")
def test_broadcast_game_over(mock_get_instance):
    """Test broadcasting game over."""
    mock_socketio = MagicMock()
    mock_get_instance.return_value = mock_socketio

    lobby_code = "ABC123"
    final_results = [{"name": "Player1", "score": 100}]

    broadcast_game_over(lobby_code, final_results)
    mock_socketio.emit.assert_called_once_with(
        "game_over", {"results": final_results}, room=lobby_code
    )


@patch("api.socket_server.SocketServer.get_instance")
def test_broadcasts_with_no_socketio(mock_get_instance):
    """Test broadcast functions when socketio is not initialized."""
    mock_get_instance.return_value = None

    # These should not raise exceptions even if socketio is None
    broadcast_lobby_update("ABC123", {})
    broadcast_question("ABC123", {}, 0)
    broadcast_player_answered("ABC123", "player1", "John", 0)
    broadcast_all_answers_in("ABC123")
    broadcast_scoreboard("ABC123", [])
    broadcast_game_over("ABC123", [])


@patch("api.socket_server.SocketServer.get_instance", return_value=None)
def test_broadcasts_with_socketio_none():
    """Test broadcast functions when socketio is explicitly None."""
    # These should not raise exceptions even if socketio is None
    broadcast_lobby_update("ABC123", {})
    broadcast_question("ABC123", {}, 0)
    broadcast_player_answered("ABC123", "player1", "John", 0)
    broadcast_all_answers_in("ABC123")
    broadcast_scoreboard("ABC123", [])
    broadcast_game_over("ABC123", [])

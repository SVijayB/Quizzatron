"""Unit tests for the TriviaQA API routes."""

from unittest.mock import patch
import pytest
from flask import Flask
from api.routes.triviaqa_api import triviaqa_bp


@pytest.fixture(name="client")
def fixture_client():
    """Create a test client for the Flask application."""
    app = Flask(__name__)
    app.register_blueprint(triviaqa_bp)
    app.config["TESTING"] = True
    with app.test_client() as test_client:
        yield test_client


@patch("api.routes.triviaqa_api.check_connection", return_value=True)
def test_questions_route_success(_, client):
    """Test GET /questions when the connection is successful."""
    response = client.get("/questions/")
    assert response.status_code == 200
    data = response.get_json()
    assert "message" in data
    assert "Categories module is ready to go!" in data["message"]


@patch("api.routes.triviaqa_api.check_connection", return_value=False)
def test_questions_route_failure(_, client):
    """Test GET /questions when the connection fails."""
    response = client.get("/questions/")
    assert response.status_code == 500
    data = response.get_json()
    assert "message" in data
    assert "Failed to connect to the triviaqa API or MongoDB." in data["message"]


@patch("api.routes.triviaqa_api.get_triviaqa")
def test_get_questions_route(mock_get_triviaqa, client):
    """Test GET /questions/get with query parameters."""
    mock_get_triviaqa.return_value = [
        {"question": "What is the capital of France?", "answer": "Paris"}
    ]

    response = client.get("/questions/get?topic=geography&num_questions=1&difficulty=easy")
    assert response.status_code == 200
    data = response.get_json()

    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["question"] == "What is the capital of France?"
    assert data[0]["answer"] == "Paris"


@patch("api.routes.triviaqa_api.get_triviaqa", return_value=[])
def test_get_questions_route_no_results(_, client):
    """Test GET /questions/get when no questions are returned."""
    response = client.get("/questions/get?topic=random&num_questions=5&difficulty=hard")
    assert response.status_code == 200
    data = response.get_json()

    assert isinstance(data, list)
    assert len(data) == 0  # Ensure empty response is handled properly


@patch("api.routes.triviaqa_api.get_triviaqa", return_value=[])
def test_get_questions_route_missing_params(_, client):
    """Test GET /questions/get with missing parameters."""
    response = client.get("/questions/get")
    assert response.status_code == 200  # Assuming empty response is valid
    data = response.get_json()

    assert isinstance(data, list)
    assert len(data) == 0  # Should return an empty list if parameters are missing

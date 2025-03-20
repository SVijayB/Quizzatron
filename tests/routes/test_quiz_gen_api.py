"""
Unit tests for the Quiz Generation API module.
"""

from unittest.mock import patch
import pytest
from flask import Flask
from api.routes.quiz_gen_api import core_quiz_gen_bp


@pytest.fixture(name="client")
def fixture_client():
    """Create a test client for the Flask application."""
    app = Flask(__name__)
    app.register_blueprint(core_quiz_gen_bp)
    app.config["TESTING"] = True
    with app.test_client() as test_client:
        yield test_client


def test_generate_quiz_missing_parameters(client):
    """Test quiz generation with missing parameters."""
    response = client.get("/quiz/generate")
    assert response.status_code == 400
    data = response.get_json()
    assert "error" in data


def test_generate_quiz_with_all_parameters(client):
    """Test quiz generation with all parameters provided."""
    response = client.get(
        "/quiz/generate?model=gemini&difficulty=easy&topic=animals&num_questions=3&image=true"
    )
    assert response.status_code == 200
    data = response.get_json()
    assert "error" not in data


@patch("api.routes.quiz_gen_api.generate_quiz")
def test_generate_quiz_post(mock_generate_quiz, client, tmpdir):
    """Test POST request to /quiz/generate with a PDF file."""
    # Mock quiz generation response
    mock_generate_quiz.return_value = {"quiz": "Generated quiz data"}

    # Create a temporary test file
    pdf_path = tmpdir.join("test.pdf")
    pdf_path.write("Fake PDF content")

    # Open the file as if it were uploaded
    with open(pdf_path, "rb") as pdf_file:
        data = {
            "model": "deepseek",
            "difficulty": "medium",
            "topic": "Math",
            "num_questions": "5",
            "image": "false",
            "pdf": (pdf_file, "test.pdf"),
        }
        response = client.post("/quiz/generate", data=data, content_type="multipart/form-data")

    # Assertions
    assert response.status_code == 200
    assert mock_generate_quiz.called
    assert response.json == {"quiz": "Generated quiz data"}


@patch("api.routes.quiz_gen_api.generate_quiz")
def test_generate_quiz_post_missing_parameters(mock_generate_quiz, client):
    """Test POST request to /quiz/generate with missing parameters."""
    data = {"model": "gemini"}  # Missing difficulty and topic/pdf
    response = client.post("/quiz/generate", data=data)

    assert response.status_code == 400
    assert response.json == {"error": "Missing required parameters."}
    mock_generate_quiz.assert_not_called()

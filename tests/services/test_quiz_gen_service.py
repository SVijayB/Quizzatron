"""Tests for quiz generation service module."""

import json
import pytest
from unittest.mock import patch
from flask import Flask
from pydantic import ValidationError
from api.models.schemas import QuizResponse
from api.services.quiz_gen_service import generate_quiz


@pytest.fixture(name="test_app")
def fixture_test_app():
    """Create a Flask test app for context."""
    app = Flask(__name__)
    with app.app_context():
        yield app


@pytest.fixture(name="valid_quiz_response")
def fixture_valid_quiz_response():
    """Create a valid QuizResponse for mocking."""
    return QuizResponse.model_validate({
        "questions": [{
            "index": 1,
            "question": "What is AI?",
            "options": ["A) A", "B) B", "C) C", "D) D"],
            "correct_answer": "A",
            "difficulty": "easy",
            "image": False,
        }]
    })


def test_invalid_difficulty(test_app):
    """Test when difficulty is not a valid option."""
    with test_app.app_context():
        response, status_code = generate_quiz(topic="science", difficulty="nightmare")

    assert status_code == 400
    data = response.get_json()
    assert "error" in data
    assert data["error"] == "Invalid parameters"


def test_invalid_num_questions_type(test_app):
    """Test when num_questions is not an integer."""
    with test_app.app_context():
        response, status_code = generate_quiz(topic="science", num_questions="abc")

    assert status_code == 400
    data = response.get_json()
    assert data["error"] == "Invalid parameters"


def test_invalid_num_questions_negative(test_app):
    """Test when num_questions is negative."""
    with test_app.app_context():
        response, status_code = generate_quiz(topic="science", num_questions=-5)

    assert status_code == 400
    data = response.get_json()
    assert data["error"] == "Invalid parameters"


def test_invalid_pdf_format(test_app):
    """Test when an invalid PDF file is provided."""
    with test_app.app_context():
        response, status_code = generate_quiz(topic="history", pdf="document.txt")

    assert status_code == 400
    data = response.get_json()
    assert data["error"] == "Invalid parameters"


def test_invalid_model(test_app):
    """Test when an invalid model is specified."""
    with test_app.app_context():
        response, status_code = generate_quiz(
            topic="math", model="invalid/model"
        )

    assert status_code == 400
    data = response.get_json()
    assert "Invalid model" in data["error"]


@patch("api.services.quiz_gen_service._generate_with_retry")
@patch("api.services.quiz_gen_service.process_images")
def test_successful_quiz_generation(mock_process, mock_generate, test_app, valid_quiz_response):
    """Test successful quiz generation end-to-end."""
    mock_generate.return_value = valid_quiz_response
    mock_process.return_value = [{"question": "What is AI?", "image": "False"}]

    with test_app.app_context():
        response = generate_quiz(topic="math", num_questions=5)

    # generate_quiz returns jsonify result which is a Response object
    mock_generate.assert_called_once()
    mock_process.assert_called_once_with(valid_quiz_response)


@patch("api.services.quiz_gen_service._generate_with_retry")
def test_model_output_validation_failure(mock_generate, test_app):
    """Test retry mechanism when model output validation fails after all retries."""
    mock_generate.side_effect = ValidationError.from_exception_data(
        title="QuizResponse",
        line_errors=[{
            "type": "missing",
            "loc": ("questions",),
            "msg": "Field required",
            "input": {},
        }],
    )

    with test_app.app_context():
        response, status_code = generate_quiz(topic="math", num_questions=5)

    assert status_code == 500
    assert response.get_json() == {
        "error": "Invalid model output after multiple attempts."
    }


@patch("api.services.quiz_gen_service._generate_with_retry")
def test_json_decode_failure(mock_generate, test_app):
    """Test when model returns non-JSON after all retries."""
    mock_generate.side_effect = json.JSONDecodeError("Expecting value", "doc", 0)

    with test_app.app_context():
        response, status_code = generate_quiz(topic="math", num_questions=5)

    assert status_code == 500
    assert response.get_json() == {
        "error": "Invalid model output after multiple attempts."
    }


@patch("api.services.quiz_gen_service._generate_with_retry")
def test_pdf_extraction_failure(mock_generate, test_app):
    """Test when PDF text extraction fails."""
    mock_generate.side_effect = ValueError("Failed to extract text from the provided PDF.")

    with test_app.app_context():
        response, status_code = generate_quiz(topic=None, pdf="test.pdf", num_questions=5)

    assert status_code == 400
    assert "Failed to extract" in response.get_json()["error"]

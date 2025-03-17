"""Tests for quiz generation service module."""

import pytest
from flask import Flask
from api.services.quiz_gen_service import generate_quiz


@pytest.fixture(name="test_app")
def fixture_test_app():
    """Create a Flask test app for context."""
    app = Flask(__name__)
    with app.app_context():
        yield app


@pytest.fixture(name="mock_generate_questions")
def fixture_mock_generate_questions(mocker):
    """Mock generate_questions function."""
    return mocker.patch(
        "api.services.quiz_gen_service.generate_questions", return_value="{}"
    )


@pytest.fixture(name="mock_validate_model_output")
def fixture_mock_validate_model_output(mocker):
    """Mock validate_model_output function."""
    return mocker.patch(
        "api.services.quiz_gen_service.validate_model_output", return_value=True
    )


@pytest.fixture(name="mock_parse_questions")
def fixture_mock_parse_questions(mocker):
    """Mock parse_questions function."""
    return mocker.patch(
        "api.services.quiz_gen_service.parse_questions",
        return_value=[{"question": "Sample?"}],
    )


def test_invalid_num_questions_type(test_app):
    """Test when num_questions is not an integer."""
    with test_app.app_context():
        response, status_code = generate_quiz(topic="science", num_questions="abc")

    assert status_code == 400
    assert response.get_json() == {"error": "num_questions must be an integer."}


def test_invalid_num_questions_negative(test_app):
    """Test when num_questions is negative."""
    with test_app.app_context():
        response, status_code = generate_quiz(topic="science", num_questions=-5)

    assert status_code == 400
    assert response.get_json() == {"error": "num_questions must be a positive integer."}


def test_invalid_pdf_format(test_app):
    """Test when an invalid PDF file is provided."""
    with test_app.app_context():
        response, status_code = generate_quiz(topic="history", pdf="document.txt")

    assert status_code == 400
    assert response.get_json() == {"error": "Invalid file format."}


def test_model_output_validation_failure(test_app, mock_validate_model_output):
    """Test retry mechanism when model output validation fails."""
    mock_validate_model_output.return_value = False

    with test_app.app_context():
        response, status_code = generate_quiz(topic="math", num_questions=5)

    assert status_code == 500
    assert response.get_json() == {
        "error": "Invalid model output after multiple attempts."
    }

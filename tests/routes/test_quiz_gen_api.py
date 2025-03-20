"""Tests for the quiz generation API endpoints."""

import pytest
from flask import Flask
from api.routes.quiz_gen_api import core_quiz_gen_bp


@pytest.fixture(name="client")
def fixture_client():
    """Create a test client for the Flask application."""
    app = Flask(__name__)
    app.register_blueprint(core_quiz_gen_bp)
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


def test_generate_quiz_with_pdf(client):
    """Test quiz generation using a PDF file."""
    response = client.get(
        r"/quiz/generate?model=gemini&difficulty=medium&num_questions=5&pdf=assets/greek_myth.pdf"
    )
    assert response.status_code == 200
    data = response.get_json()
    assert "error" not in data


def test_generate_quiz_invalid_model(client):
    """Test quiz generation with an invalid model."""
    response = client.get(
        "/quiz/generate?model=invalid_model&difficulty=medium&topic=Python%20Programming"
    )
    assert response.status_code == 400
    data = response.get_json()
    assert "error" in data


def test_generate_quiz_invalid_difficulty(client):
    """Test quiz generation with an invalid difficulty level."""
    response = client.get(
        "/quiz/generate?model=gemini&difficulty=invalid&topic=Python%20Programming"
    )
    assert response.status_code == 400
    data = response.get_json()
    assert "error" in data


def test_generate_quiz_missing_model(client):
    """Test quiz generation with a missing model parameter."""
    response = client.get("/quiz/generate?difficulty=medium&topic=Python%20Programming")
    assert response.status_code == 400
    data = response.get_json()
    assert "error" in data


def test_generate_quiz_invalid_image_parameter(client):
    """Test quiz generation with an invalid image parameter."""
    response = client.get(
        "/quiz/generate?model=gemini&difficulty=medium&topic=Python%20Programming&image=invalid"
    )
    assert response.status_code == 400
    data = response.get_json()
    assert "error" in data

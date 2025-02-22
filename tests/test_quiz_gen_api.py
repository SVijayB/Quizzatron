import pytest
from flask import Flask
from api.routes.quiz_gen_api import core_quiz_gen_bp


@pytest.fixture
def client():
    app = Flask(__name__)
    app.register_blueprint(core_quiz_gen_bp)
    with app.test_client() as client:
        yield client


def test_generate_quiz_missing_parameters(client):
    response = client.get("/quiz/generate")
    assert response.status_code == 400
    data = response.get_json()
    assert "error" in data


def test_generate_quiz_with_all_parameters(client):
    response = client.get(
        "/quiz/generate?model=gemini&difficulty=easy&topic=animals&num_questions=3&image=true"
    )
    assert response.status_code == 200
    data = response.get_json()
    assert "error" not in data


def test_generate_quiz_with_pdf(client):
    response = client.get(
        r"/quiz/generate?model=gemini&difficulty=medium&num_questions=5&pdf=assets/greek_myth.pdf"
    )
    assert response.status_code == 200
    data = response.get_json()
    assert "error" not in data


def test_generate_quiz_invalid_model(client):
    response = client.get(
        "/quiz/generate?model=invalid_model&difficulty=medium&topic=Python%20Programming"
    )
    assert response.status_code == 400
    data = response.get_json()
    assert "error" in data


def test_generate_quiz_invalid_difficulty(client):
    response = client.get(
        "/quiz/generate?model=gemini&difficulty=invalid&topic=Python%20Programming"
    )
    assert response.status_code == 400
    data = response.get_json()
    assert "error" in data


def test_generate_quiz_missing_model(client):
    response = client.get("/quiz/generate?difficulty=medium&topic=Python%20Programming")
    assert response.status_code == 400
    data = response.get_json()
    assert "error" in data


def test_generate_quiz_invalid_image_parameter(client):
    response = client.get(
        "/quiz/generate?model=gemini&difficulty=medium&topic=Python%20Programming&image=invalid"
    )
    assert response.status_code == 400
    data = response.get_json()
    assert "error" in data

import pytest
from flask import Flask
from api.app import create_app


@pytest.fixture
def app():
    app = create_app()
    app.config.update(
        {
            "TESTING": True,
        }
    )
    yield app


@pytest.fixture
def client(app):
    return app.test_client()


def test_favicon(client):
    response = client.get("/favicon.ico")
    assert response.status_code == 200
    assert response.mimetype == "image/vnd.microsoft.icon"


def test_404(client):
    response = client.get("/nonexistent")
    assert response.status_code == 404
    assert b"ERROR 404: CANNOT GET /nonexistent" in response.data


def test_api_blueprint(client):
    response = client.get("/api/quiz")
    assert response.status_code == 200

"""Tests for the Flask application."""

import pytest
from api.app import create_app


@pytest.fixture(name="app")
def fixture_app():
    """Create and configure a test Flask app."""
    test_app = create_app("testing")
    test_app.config.update({"TESTING": True})
    yield test_app


@pytest.fixture(name="client")
def fixture_client(app):
    """Create a test client for the app."""
    return app.test_client()


def test_favicon(client):
    """Test the favicon endpoint."""
    response = client.get("/favicon.ico")
    assert response.status_code == 200
    assert response.mimetype == "image/vnd.microsoft.icon"


def test_404(client):
    """Test the 404 error handler."""
    response = client.get("/nonexistent")
    assert response.status_code == 404
    assert b"ERROR 404: CANNOT GET /nonexistent" in response.data


def test_api_blueprint(client):
    """Test the API blueprint."""
    response = client.get("/api/quiz")
    assert response.status_code == 200

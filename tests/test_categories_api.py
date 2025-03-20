"""
Unit tests for the Categories API module.
"""

import pytest
from flask import Flask
from api.routes.categories_api import categories_bp


@pytest.fixture(name="client")
def fixture_client():
    """Create a test client for the Flask application."""
    app = Flask(__name__)
    app.register_blueprint(categories_bp)
    app.config["TESTING"] = True
    with app.test_client() as test_client:
        yield test_client


def test_categories_route(client):
    """Test GET /categories/ endpoint to check if the welcome message is returned."""
    response = client.get("/categories/")
    assert response.status_code == 200  # Ensure response is successful

    data = response.get_json()
    assert "message" in data
    assert (
        data["message"]
        == "Categories module is ready to go! Hit the /categories/get endpoint! 🚀"
    )

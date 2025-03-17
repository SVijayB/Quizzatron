"""Pytest configuration and fixtures for API testing."""

import pytest
from api.app import create_app


@pytest.fixture
def test_client():
    """Create and configure a test client for the Flask application."""
    app = create_app("testing")
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client

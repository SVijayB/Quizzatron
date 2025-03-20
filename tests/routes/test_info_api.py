"""
Unit tests for the Info API module.
"""

import pytest
from flask import Flask
from api.routes.info_api import info_bp


@pytest.fixture(name="app")
def fixture_app():
    """Create a Flask app fixture."""
    test_app = Flask(__name__)
    test_app.register_blueprint(info_bp)
    return test_app


@pytest.fixture(name="client")
def fixture_client(app):
    """Create a Flask test client fixture."""
    return app.test_client()


def test_dev_info_route(client):
    """Test the /dev-info/ route for correct response and data structure."""
    response = client.get('/dev-info/')
    assert response.status_code == 200

    data = response.get_json()
    assert isinstance(data, list)
    assert len(data) == 4  # Assuming there are 4 developers in the list

    # Check if the base_url is correctly formed
    base_url = 'http://localhost/static/dev_imgs'  # Adjust if test server uses a different host
    for dev in data:
        assert dev['image'].startswith(base_url)

    # Check specific developer info
    assert data[0]['name'] == "Vijay Balaji S"
    assert data[1]['name'] == "Aravindh Manavalan"
    assert data[2]['name'] == "Akshay Ravi"
    assert data[3]['name'] == "Hariharan sureshkumar"

    # Check if all required fields are present
    required_fields = ['name', 'desc', 'email', 'linkedin', 'image']
    for dev in data:
        assert all(field in dev for field in required_fields)

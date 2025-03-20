"""Unit tests for image extraction utilities."""

import pytest
from flask import Flask
from api.utils.extract_img import download_images, cleanup_temp_folder


@pytest.fixture(name="app")
def fixture_app():
    """Create a Flask app fixture."""
    test_app = Flask(__name__)
    test_app.config["TESTING"] = True
    return test_app


@pytest.fixture(name="client")
def fixture_client(app):
    """Create a Flask test client fixture."""
    return app.test_client()


@pytest.fixture(name="mock_glob")
def fixture_mock_glob(mocker):
    """Mock glob to return test image files."""
    return mocker.patch("glob.glob")


@pytest.fixture(name="mock_os_remove")
def fixture_mock_os_remove(mocker):
    """Mock os.remove to prevent actual file deletions."""
    return mocker.patch("os.remove")


@pytest.fixture(name="mock_os_rename")
def fixture_mock_os_rename(mocker):
    """Mock os.rename to prevent actual renaming."""
    return mocker.patch("os.rename")


def test_cleanup_temp_folder(mock_glob, mock_os_remove):
    """Test cleanup_temp_folder function to ensure it removes files."""
    mock_glob.return_value = ["api/static/temp/test1.jpg", "api/static/temp/test2.jpg"]

    cleanup_temp_folder()

    mock_os_remove.assert_any_call("api/static/temp/test1.jpg")
    mock_os_remove.assert_any_call("api/static/temp/test2.jpg")


def test_download_images_no_results(mock_glob):
    """Test download_images when no images are found."""
    mock_glob.return_value = []
    result = download_images("nonexistent query")
    assert result is None

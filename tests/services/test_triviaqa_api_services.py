"""Unit tests for the TriviaQA API services."""

from unittest.mock import patch, MagicMock
import pytest
from api.services.triviaqa_api import check_connection, get_triviaqa


@pytest.fixture(name="mock_mongo_client")
def fixture_mock_mongo_client():
    """Mock MongoClient for unit tests."""
    with patch("api.services.triviaqa_api.MongoClient") as mock_client:
        yield mock_client


@pytest.fixture(name="mock_requests_get")
def fixture_mock_requests_get():
    """Mock requests.get to simulate OpenTDB API responses."""
    with patch("api.services.triviaqa_api.requests.get") as mock_get:
        yield mock_get


def test_check_connection_success(mock_mongo_client, mock_requests_get):
    """Test successful API and MongoDB connection."""
    # Mock API response
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_requests_get.return_value = mock_response

    # Mock MongoDB response
    mock_mongo_instance = MagicMock()
    mock_mongo_instance.admin.command.return_value = {"ok": 1}
    mock_mongo_client.return_value = mock_mongo_instance

    assert check_connection() is True


@patch("api.services.triviaqa_api.get_categories")
@patch("api.services.triviaqa_api.get_questions_from_api")
@patch("api.services.triviaqa_api.format_question_api_output")
def test_get_triviaqa_api(
    mock_format_output, mock_get_questions_from_api, mock_get_categories
):
    """Test get_triviaqa() when fetching from API."""
    mock_get_categories.return_value = {"Science": 17}  # Mocked category ID
    mock_get_questions_from_api.return_value = {
        "results": [{"question": "What is AI?"}]
    }
    mock_format_output.return_value = [{"question": "What is AI?"}]

    result = get_triviaqa("Science", 5, "medium")

    assert result == [{"question": "What is AI?"}]
    mock_get_questions_from_api.assert_called_once_with(
        category="17", difficulty="medium", num_questions="5"
    )


@patch("api.services.triviaqa_api.get_categories")
@patch("api.services.triviaqa_api.get_mongodb_data")
def test_get_triviaqa_mongo(mock_get_mongodb_data, mock_get_categories):
    """Test get_triviaqa() when fetching from MongoDB."""
    mock_get_categories.return_value = {
        "History": "history_collection"
    }  # Mocked category name
    mock_get_mongodb_data.return_value = [{"question": "Who discovered America?"}]

    result = get_triviaqa("History", 3, "easy")

    assert result == [{"question": "Who discovered America?"}]
    mock_get_mongodb_data.assert_called_once()


@patch("api.services.triviaqa_api.get_categories")
def test_get_triviaqa_invalid_category(mock_get_categories, capsys):
    """Test get_triviaqa() when category is invalid."""
    mock_get_categories.return_value = {
        "Science": 17
    }  # Science exists, but we request 'Invalid'

    result = get_triviaqa("Invalid", 5, "medium")

    assert result is None
    captured = capsys.readouterr()
    assert "Category 'Invalid' not found" in captured.out

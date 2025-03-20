"""
Unit tests for the MongoDB data utility functions.
"""

from unittest.mock import MagicMock
import pytest
from api.utils.mongodb_data import get_mongodb_data


@pytest.fixture(name="mock_mongo_client")
def fixture_mock_mongo_client():
    """Create a mock MongoDB client."""
    mock_client = MagicMock()
    mock_db = mock_client["trivia-qa"]

    # Mock the collection existence check
    mock_db.list_collection_names.return_value = ["Math", "Science", "History"]

    # Mock the collection
    mock_collection = MagicMock()
    mock_db.__getitem__.return_value = mock_collection

    # Mock data to be returned from aggregation
    mock_collection.aggregate.return_value = iter([
        {
            "question": "What is 2 + 2?",
            "options": ["1", "2", "3", "4"],
            "correct_answer": "4"
        },
        {
            "question": "What is the capital of France?",
            "options": ["Berlin", "Madrid", "Paris", "Rome"],
            "correct_answer": "Paris"
        }
    ])

    return mock_client


def test_get_mongodb_data_valid_collection(mock_mongo_client):
    """Test retrieving questions from a valid MongoDB collection."""
    result = get_mongodb_data(mock_mongo_client, "Math", num_questions=2, difficulty="medium")

    assert result is not None
    assert "questions" in result
    assert len(result["questions"]) == 2
    assert result["questions"][0]["index"] == 1
    assert result["questions"][1]["index"] == 2
    assert result["questions"][0]["correct_answer"] in ["A", "B", "C", "D"]
    assert result["questions"][1]["correct_answer"] in ["A", "B", "C", "D"]
    assert result["questions"][0]["difficulty"] == "medium"


def test_get_mongodb_data_no_collection(mock_mongo_client):
    """Test case when the requested collection does not exist."""
    result = get_mongodb_data(mock_mongo_client, "UnknownTopic", num_questions=2, difficulty="hard")

    assert result is None


def test_get_mongodb_data_empty_collection(mock_mongo_client):
    """Test when the collection exists but contains no data."""
    mock_mongo_client["trivia-qa"]["Math"].aggregate.return_value = iter([])

    result = get_mongodb_data(mock_mongo_client, "Math", num_questions=3, difficulty="easy")

    assert result == {"questions": []}  # Should return an empty questions list

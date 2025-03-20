"""
Unit tests for the OpenTDB data utility functions.
"""

from unittest.mock import patch, MagicMock
import pytest
from api.utils.opentdb_data import get_questions_from_api, format_question_api_output


@patch("api.utils.opentdb_data.requests.get")
def test_get_questions_from_api_success(mock_requests):
    """Test get_questions_from_api() with a successful API response."""
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "response_code": 0,
        "results": [
            {
                "question": "What is 2+2?",
                "incorrect_answers": ["3", "5", "6"],
                "correct_answer": "4",
            },
        ],
    }
    mock_response.raise_for_status = MagicMock()
    mock_requests.return_value = mock_response

    response = get_questions_from_api(
        category="9", difficulty="easy", num_questions="5"
    )

    assert response is not None
    assert "results" in response
    assert response["results"][0]["question"] == "What is 2+2?"


def test_get_questions_from_api_invalid_input():
    """Test get_questions_from_api() with invalid inputs."""
    with pytest.raises(TypeError):
        get_questions_from_api(category=9, difficulty="easy", num_questions="5")
    with pytest.raises(TypeError):
        get_questions_from_api(category="9", difficulty=5, num_questions="5")
    with pytest.raises(TypeError):
        get_questions_from_api(category="9", difficulty="easy", num_questions=5)


def test_format_question_api_output_success():
    """Test format_question_api_output() with a valid API response."""
    api_response = {
        "results": [
            {
                "question": "What is 2+2?",
                "incorrect_answers": ["3", "5", "6"],
                "correct_answer": "4",
                "difficulty": "easy",
            }
        ]
    }

    formatted_output = format_question_api_output(api_response)

    assert formatted_output is not None
    assert "questions" in formatted_output
    assert len(formatted_output["questions"]) == 1
    assert formatted_output["questions"][0]["question"] == "What is 2+2?"
    assert formatted_output["questions"][0]["difficulty"] == "easy"
    assert len(formatted_output["questions"][0]["options"]) == 4


def test_format_question_api_output_invalid_input():
    """Test format_question_api_output() with invalid inputs."""
    with pytest.raises(TypeError):
        format_question_api_output(["invalid"])

    with pytest.raises(TypeError):
        format_question_api_output("invalid string")


def test_format_question_api_output_edge_case():
    """Test format_question_api_output() with an empty results list."""
    api_response = {"results": []}

    formatted_output = format_question_api_output(api_response)

    assert formatted_output is not None
    assert "questions" in formatted_output
    assert len(formatted_output["questions"]) == 0

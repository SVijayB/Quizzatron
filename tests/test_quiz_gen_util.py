"""Tests for quiz question generation and parsing."""

import json
from api.utils.quiz_gen import parse_questions


def test_parse_questions_invalid_json():
    """Test parsing when the response is not valid JSON."""
    invalid_json = "not a valid json"
    result = parse_questions(invalid_json)

    assert result == invalid_json


def test_parse_questions_without_images():
    """Test parsing when images are not provided."""
    response_text = json.dumps(
        {"questions": [{"question": "What is AI?", "image": ""}]}
    )
    result = parse_questions(response_text)

    assert result[0]["image"] == "False"

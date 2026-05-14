"""Tests for Pydantic schemas used in quiz generation."""

import json
import pytest
from pydantic import ValidationError
from api.models.schemas import (
    QuizQuestion,
    QuizResponse,
    QuizRequest,
    Difficulty,
    CorrectAnswer,
)


# --- Fixtures ---

VALID_QUESTION = {
    "index": 1,
    "question": "What is the capital of France?",
    "options": ["A) Paris", "B) London", "C) Berlin", "D) Madrid"],
    "correct_answer": "A",
    "difficulty": "easy",
    "image": False,
}

VALID_RESPONSE_JSON = json.dumps({"questions": [VALID_QUESTION]})


# --- QuizQuestion Tests ---


def test_valid_question():
    """Test that a valid question passes validation."""
    q = QuizQuestion(**VALID_QUESTION)
    assert q.question == "What is the capital of France?"
    assert q.correct_answer == CorrectAnswer.A
    assert q.difficulty == Difficulty.EASY
    assert q.image is False


def test_image_string_false_coerced():
    """Test that image='false' string is coerced to boolean False."""
    data = {**VALID_QUESTION, "image": "false"}
    q = QuizQuestion(**data)
    assert q.image is False


def test_image_string_False_coerced():
    """Test that image='False' string is coerced to boolean False."""
    data = {**VALID_QUESTION, "image": "False"}
    q = QuizQuestion(**data)
    assert q.image is False


def test_image_string_description_kept():
    """Test that a real image description string is preserved."""
    data = {**VALID_QUESTION, "image": "National flag of Japan"}
    q = QuizQuestion(**data)
    assert q.image == "National flag of Japan"


def test_invalid_correct_answer():
    """Test that an invalid correct answer raises ValidationError."""
    data = {**VALID_QUESTION, "correct_answer": "E"}
    with pytest.raises(ValidationError):
        QuizQuestion(**data)


def test_invalid_difficulty():
    """Test that an invalid difficulty raises ValidationError."""
    data = {**VALID_QUESTION, "difficulty": "nightmare"}
    with pytest.raises(ValidationError):
        QuizQuestion(**data)


def test_invalid_options_length():
    """Test that fewer than 4 options raises ValidationError."""
    data = {**VALID_QUESTION, "options": ["A) Paris", "B) London", "C) Berlin"]}
    with pytest.raises(ValidationError):
        QuizQuestion(**data)


def test_invalid_index_type():
    """Test that a non-integer index raises ValidationError."""
    data = {**VALID_QUESTION, "index": "one"}
    with pytest.raises(ValidationError):
        QuizQuestion(**data)


def test_invalid_index_zero():
    """Test that index=0 raises ValidationError (must be >= 1)."""
    data = {**VALID_QUESTION, "index": 0}
    with pytest.raises(ValidationError):
        QuizQuestion(**data)


def test_missing_required_field():
    """Test that a missing required field raises ValidationError."""
    data = {k: v for k, v in VALID_QUESTION.items() if k != "question"}
    with pytest.raises(ValidationError):
        QuizQuestion(**data)


def test_invalid_image_type():
    """Test that an invalid image type (int) raises ValidationError."""
    data = {**VALID_QUESTION, "image": 123}
    with pytest.raises(ValidationError):
        QuizQuestion(**data)


def test_empty_question_string():
    """Test that an empty question string raises ValidationError."""
    data = {**VALID_QUESTION, "question": ""}
    with pytest.raises(ValidationError):
        QuizQuestion(**data)


def test_difficulty_type_int():
    """Test that a numeric difficulty raises ValidationError."""
    data = {**VALID_QUESTION, "difficulty": 1}
    with pytest.raises(ValidationError):
        QuizQuestion(**data)


# --- QuizResponse Tests ---


def test_valid_response():
    """Test that a valid JSON string is parsed into a QuizResponse."""
    resp = QuizResponse.model_validate_json(VALID_RESPONSE_JSON)
    assert len(resp.questions) == 1
    assert resp.questions[0].question == "What is the capital of France?"


def test_empty_questions_list():
    """Test that an empty questions list raises ValidationError."""
    with pytest.raises(ValidationError):
        QuizResponse.model_validate_json('{"questions": []}')


def test_missing_questions_key():
    """Test that a missing 'questions' key raises ValidationError."""
    with pytest.raises(ValidationError):
        QuizResponse.model_validate_json('{"quiz": []}')


def test_invalid_json_string():
    """Test that invalid JSON raises ValidationError."""
    with pytest.raises(ValidationError):
        QuizResponse.model_validate_json("not valid json at all")


def test_response_with_json_fences():
    """Test that JSON wrapped in markdown fences still needs to be clean JSON."""
    fenced = '```json\n{"questions": []}\n```'
    with pytest.raises(ValidationError):
        QuizResponse.model_validate_json(fenced)


def test_multiple_questions():
    """Test response with multiple questions."""
    q2 = {**VALID_QUESTION, "index": 2, "question": "What is 2+2?", "correct_answer": "B"}
    data = json.dumps({"questions": [VALID_QUESTION, q2]})
    resp = QuizResponse.model_validate_json(data)
    assert len(resp.questions) == 2


# --- QuizRequest Tests ---


def test_valid_request_defaults():
    """Test that a minimal valid request uses defaults."""
    req = QuizRequest(topic="Science")
    assert req.difficulty == Difficulty.MEDIUM
    assert req.num_questions == 5
    assert req.image is False
    assert req.model == "gemini/gemini-2.5-flash"


def test_request_image_string_coercion():
    """Test that image='true' string is coerced to True."""
    req = QuizRequest(topic="Science", image="true")
    assert req.image is True


def test_request_image_string_false_coercion():
    """Test that image='false' string is coerced to False."""
    req = QuizRequest(topic="Science", image="false")
    assert req.image is False


def test_request_invalid_difficulty():
    """Test that an invalid difficulty raises ValidationError."""
    with pytest.raises(ValidationError):
        QuizRequest(topic="Science", difficulty="nightmare")


def test_request_invalid_num_questions_type():
    """Test that a non-numeric num_questions raises ValidationError."""
    with pytest.raises(ValidationError):
        QuizRequest(topic="Science", num_questions="abc")


def test_request_negative_num_questions():
    """Test that a negative num_questions raises ValidationError."""
    with pytest.raises(ValidationError):
        QuizRequest(topic="Science", num_questions=-5)


def test_request_invalid_pdf_extension():
    """Test that a non-.pdf file raises ValidationError."""
    with pytest.raises(ValidationError):
        QuizRequest(topic="History", pdf="document.txt")


def test_request_valid_pdf():
    """Test that a valid .pdf path passes validation."""
    req = QuizRequest(topic="History", pdf="notes.pdf")
    assert req.pdf == "notes.pdf"

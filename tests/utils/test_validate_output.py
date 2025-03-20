"""Tests for validating the output of the model."""

from api.utils.validate_output import validate_model_output

BASE_MODEL_OUTPUT = """
{
    "questions": [
        {
            "index": 1,
            "question": "What is the capital of France?",
            "options": ["A. Paris", "B. London", "C. Berlin", "D. Madrid"],
            "correct_answer": "A",
            "difficulty": "easy",
            "image": false
        }
    ]
}
"""


def test_valid_model_output():
    """Test that valid model output passes validation."""
    assert validate_model_output(
        BASE_MODEL_OUTPUT
    ) == BASE_MODEL_OUTPUT.strip().replace("\n", "")


def test_invalid_json_format():
    """Test that invalid JSON format fails validation."""
    invalid_json = BASE_MODEL_OUTPUT[:-2]
    assert not validate_model_output(invalid_json)


def test_missing_questions_key():
    """Test that missing 'questions' key fails validation."""
    model_output = BASE_MODEL_OUTPUT.replace('"questions"', '"quiz"')
    assert not validate_model_output(model_output)


def test_missing_required_keys():
    """Test that missing required keys fails validation."""
    model_output = BASE_MODEL_OUTPUT.replace('"image": false', "")
    assert not validate_model_output(model_output)


def test_invalid_index_type():
    """Test that invalid index type fails validation."""
    model_output = BASE_MODEL_OUTPUT.replace('"index": 1', '"index": "one"')
    assert not validate_model_output(model_output)


def test_invalid_options_length():
    """Test that invalid options length fails validation."""
    model_output = BASE_MODEL_OUTPUT.replace(
        '["A. Paris", "B. London", "C. Berlin", "D. Madrid"]',
        '["A. Paris", "B. London", "C. Berlin"]',
    )
    assert not validate_model_output(model_output)


def test_invalid_correct_answer():
    """Test that invalid correct answer fails validation."""
    model_output = BASE_MODEL_OUTPUT.replace(
        '"correct_answer": "A"', '"correct_answer": "E"'
    )
    assert not validate_model_output(model_output)


def test_invalid_difficulty_type():
    """Test that invalid difficulty type fails validation."""
    model_output = BASE_MODEL_OUTPUT.replace('"difficulty": "easy"', '"difficulty": 1')
    assert not validate_model_output(model_output)


def test_invalid_image_type():
    """Test that invalid image type fails validation."""
    model_output = BASE_MODEL_OUTPUT.replace('"image": false', '"image": 123')
    assert not validate_model_output(model_output)


def test_image_as_string_true():
    """Test that image as a string ('true') passes validation."""
    model_output = BASE_MODEL_OUTPUT.replace('"image": false', '"image": "true"')
    assert validate_model_output(model_output) == model_output.strip().replace("\n", "")


def test_missing_multiple_required_keys():
    """Test that missing multiple required keys fails validation."""
    model_output = BASE_MODEL_OUTPUT.replace('"index": 1,', "").replace(
        '"question": "What is the capital of France?",', ""
    )
    assert not validate_model_output(model_output)


def test_empty_questions_list():
    """Test that an empty 'questions' list fails validation."""
    model_output = '{"questions": []}'
    assert not validate_model_output(model_output)


def test_invalid_question_type():
    """Test that invalid question type fails validation."""
    model_output = BASE_MODEL_OUTPUT.replace(
        '"question": "What is the capital of France?"', '"question": 123'
    )
    assert not validate_model_output(model_output)


def test_image_string_false():
    """Test that image as a string 'false' is converted to boolean False."""
    model_output = BASE_MODEL_OUTPUT.replace('"image": false', '"image": "false"')
    assert validate_model_output(model_output) == model_output.strip().replace("\n", "")


def test_unexpected_exception():
    """Test that an unexpected exception is handled properly."""
    assert not validate_model_output(12345)  # Not a string

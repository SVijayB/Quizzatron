import pytest
from api.utils.validate_output import validate_model_output

base_model_output = """
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
    assert validate_model_output(
        base_model_output
    ) == base_model_output.strip().replace("\n", "")


def test_invalid_json_format():
    invalid_json = base_model_output[:-2]
    assert not validate_model_output(invalid_json)


def test_missing_questions_key():
    model_output = base_model_output.replace('"questions"', '"quiz"')
    assert not validate_model_output(model_output)


def test_missing_required_keys():
    model_output = base_model_output.replace('"image": false', "")
    assert not validate_model_output(model_output)


def test_invalid_index_type():
    model_output = base_model_output.replace('"index": 1', '"index": "one"')
    assert not validate_model_output(model_output)


def test_invalid_options_length():
    model_output = base_model_output.replace(
        '["A. Paris", "B. London", "C. Berlin", "D. Madrid"]',
        '["A. Paris", "B. London", "C. Berlin"]',
    )
    assert not validate_model_output(model_output)


def test_invalid_correct_answer():
    model_output = base_model_output.replace(
        '"correct_answer": "A"', '"correct_answer": "E"'
    )
    assert not validate_model_output(model_output)


def test_invalid_difficulty_type():
    model_output = base_model_output.replace('"difficulty": "easy"', '"difficulty": 1')
    assert not validate_model_output(model_output)


def test_invalid_image_type():
    model_output = base_model_output.replace('"image": false', '"image": 123')
    assert not validate_model_output(model_output)


def test_image_as_string_true():
    model_output = base_model_output.replace('"image": false', '"image": "true"')
    assert validate_model_output(model_output) == model_output.strip().replace("\n", "")

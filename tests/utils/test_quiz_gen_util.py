"""Tests for quiz question generation and image processing."""

import json
from unittest.mock import patch, MagicMock, mock_open
from api.models.schemas import QuizResponse
from api.utils.quiz_gen import extract_text_from_pdf, process_images


VALID_QUIZ_RESPONSE = QuizResponse.model_validate({
    "questions": [
        {
            "index": 1,
            "question": "What is AI?",
            "options": ["A) Option1", "B) Option2", "C) Option3", "D) Option4"],
            "correct_answer": "A",
            "difficulty": "easy",
            "image": "AI robot illustration",
        },
        {
            "index": 2,
            "question": "What is ML?",
            "options": ["A) Option1", "B) Option2", "C) Option3", "D) Option4"],
            "correct_answer": "B",
            "difficulty": "easy",
            "image": False,
        },
    ]
})


@patch("builtins.open", new_callable=mock_open, read_data="Sample PDF text")
@patch("api.utils.quiz_gen.pypdf.PdfReader")
def test_extract_text_from_pdf(mock_pdf_reader, _mock_file):
    """Test PDF text extraction."""
    mock_reader_instance = MagicMock()
    mock_reader_instance.pages = [MagicMock(extract_text=lambda: "Sample PDF text")]
    mock_pdf_reader.return_value = mock_reader_instance

    text = extract_text_from_pdf("test.pdf")
    assert text == "Sample PDF text"


@patch("builtins.open", new_callable=mock_open, read_data="Sample PDF text")
@patch("api.utils.quiz_gen.pypdf.PdfReader")
def test_extract_text_from_empty_pdf(mock_pdf_reader, _mock_file):
    """Test PDF extraction when no text is found."""
    mock_reader_instance = MagicMock()
    mock_reader_instance.pages = [MagicMock(extract_text=lambda: None)]
    mock_pdf_reader.return_value = mock_reader_instance

    text = extract_text_from_pdf("empty.pdf")
    assert text is None


@patch("api.utils.quiz_gen.download_images", return_value="path/to/image.jpg")
def test_process_images_with_image_descriptions(mock_download):
    """Test that image descriptions are resolved to downloaded image paths."""
    result = process_images(VALID_QUIZ_RESPONSE)

    assert result[0]["image"] == "path/to/image.jpg"
    mock_download.assert_called_once_with("AI robot illustration")


@patch("api.utils.quiz_gen.download_images")
def test_process_images_without_images(mock_download):
    """Test that questions without images get image set to 'False'."""
    result = process_images(VALID_QUIZ_RESPONSE)

    assert result[1]["image"] == "False"
    # download_images should only be called for the first question
    assert mock_download.call_count == 1


def test_process_images_all_false():
    """Test processing when all questions have image=False."""
    response = QuizResponse.model_validate({
        "questions": [
            {
                "index": 1,
                "question": "What is AI?",
                "options": ["A) A", "B) B", "C) C", "D) D"],
                "correct_answer": "A",
                "difficulty": "easy",
                "image": False,
            }
        ]
    })
    result = process_images(response)
    assert result[0]["image"] == "False"


@patch("builtins.open", new_callable=mock_open, read_data="Sample prompt text")
@patch("api.utils.quiz_gen.litellm.completion")
def test_generate_questions_returns_quiz_response(mock_completion, _mock_open_file):
    """Test that generate_questions returns a validated QuizResponse."""
    from api.utils.quiz_gen import generate_questions

    mock_response = MagicMock()
    mock_response.choices = [
        MagicMock(message=MagicMock(content=json.dumps({
            "questions": [{
                "index": 1,
                "question": "Test?",
                "options": ["A) 1", "B) 2", "C) 3", "D) 4"],
                "correct_answer": "A",
                "difficulty": "easy",
                "image": False,
            }]
        })))
    ]
    mock_completion.return_value = mock_response

    result = generate_questions("Topic", 1, "easy", "gemini/gemini-2.5-flash", False, None)
    assert isinstance(result, QuizResponse)
    assert len(result.questions) == 1


def test_generate_questions_invalid_model():
    """Test that an invalid model raises ValueError."""
    import pytest
    from api.utils.quiz_gen import generate_questions

    with pytest.raises(ValueError, match="not configured"):
        generate_questions("Topic", 1, "easy", "invalid/model", False, None)

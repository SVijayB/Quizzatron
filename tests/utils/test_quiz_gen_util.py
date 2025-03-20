"""Tests for quiz question generation and parsing."""

import json
from unittest.mock import patch, MagicMock, mock_open
from api.utils.quiz_gen import extract_text_from_pdf, generate_questions, parse_questions


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


@patch("builtins.open", new_callable=mock_open, read_data="Sample PDF text")
@patch("api.utils.quiz_gen.pypdf.PdfReader")
def test_extract_text_from_pdf(mock_pdf_reader, _mock_file):
    """Test PDF text extraction."""
    mock_reader_instance = MagicMock()
    mock_reader_instance.pages = [MagicMock(extract_text=lambda: "Sample PDF text")]
    mock_pdf_reader.return_value = mock_reader_instance

    text = extract_text_from_pdf("test.pdf")
    assert text == "Sample PDF text"  # ✅ Hits extract_text_from_pdf


@patch("builtins.open", new_callable=mock_open, read_data="Sample prompt text")
@patch("api.utils.quiz_gen.ollama.chat")
def test_generate_questions_deepseek(mock_ollama_chat, _mock_open_file):
    """Test quiz generation with DeepSeek model."""
    mock_ollama_chat.return_value = {"message": {"content": "Generated Question"}}

    response = generate_questions("SomeTopic", 5, "easy", "deepseek", False, None)

    assert response == "Generated Question"  # ✅ Hits deepseek model branch


@patch("builtins.open", new_callable=mock_open, read_data="Sample prompt text")
@patch("api.utils.quiz_gen.client.models.generate_content")
def test_generate_questions_gemini(mock_gemini_generate, _mock_open_file):
    """Test quiz generation with Gemini model."""
    mock_gemini_generate.return_value = MagicMock(text="Generated Question")

    response = generate_questions("SomeTopic", 5, "easy", "gemini", False, None)

    assert response == "Generated Question"  # ✅ Hits gemini model branch


@patch("api.utils.quiz_gen.json.loads")
@patch("api.utils.quiz_gen.download_images", return_value="path/to/image.jpg")
def test_parse_questions_with_images(_mock_download_images, mock_json_loads):
    """Test parsing questions when images are present."""
    mock_json_loads.return_value = {
        "questions": [
            {"question": "What is AI?", "image": "http://image.url"},
            {"question": "What is ML?", "image": ""},
        ]
    }

    parsed_questions = parse_questions(json.dumps(mock_json_loads.return_value))

    assert parsed_questions[0]["image"] == "path/to/image.jpg"  # ✅ Hits image download logic
    assert parsed_questions[1]["image"] == "False"  # ✅ Hits case where no image is provided

"""Module for generating quiz questions using various AI models and parsing the results."""

import logging
import os
from dotenv import load_dotenv
import pypdf
import tiktoken
import litellm

from api.models.schemas import QuizResponse
from api.utils.extract_img import download_images

load_dotenv()
litellm.suppress_debug_info = True
litellm.set_verbose = False

AVAILABLE_MODELS = {
    "gemini/gemini-2.5-flash": {
        "key_env": "GOOGLE_API_KEY",
        "name": "Gemini 2.5 Flash"
    },
    "gemini/gemma-4-31b-it": {
        "key_env": "GOOGLE_API_KEY",
        "name": "Gemma 4 31B IT"
    },
    "openai/deepseek-ai/deepseek-v3.2": {
        "key_env": "NVIDIA_KEY",
        "api_base": "https://integrate.api.nvidia.com/v1",
        "name": "DeepSeek v3.2"
    },
    "mistral/mistral-large-2411": {
        "key_env": "MISTRAL_KEY",
        "name": "Mistral Large"
    }
}


def extract_text_from_pdf(pdf_path):
    """Extract text content from a PDF file."""
    with open(pdf_path, "rb") as file:
        reader = pypdf.PdfReader(file)
        text = "\n".join(
            [page.extract_text() for page in reader.pages if page.extract_text()]
        )
    return text if text else None


def _truncate_to_token_limit(text, max_tokens=80000):
    """Truncate text to a maximum number of tokens using tiktoken.
    
    Args:
        text (str): The raw text to truncate.
        max_tokens (int): The maximum allowed tokens (default 80k).
        
    Returns:
        str: The truncated text.
    """
    try:
        # cl100k_base is the standard tokenizer for modern OpenAI models and a good generic approximation
        encoding = tiktoken.get_encoding("cl100k_base")
        tokens = encoding.encode(text)
        
        if len(tokens) <= max_tokens:
            return text
            
        logging.warning("PDF exceeds %d tokens. Truncating.", max_tokens)
        truncated_tokens = tokens[:max_tokens]
        return encoding.decode(truncated_tokens)
    except Exception as e:
        logging.error("Tokenization failed: %s. Falling back to character slicing.", e)
        # Fallback: assume average of 4 chars per token
        char_limit = max_tokens * 4
        return text[:char_limit]


# pylint: disable=too-many-arguments,too-many-positional-arguments
def generate_questions(topic, num_questions, difficulty, model, image, pdf):
    """Generate quiz questions and return a validated QuizResponse.

    Args:
        topic: The quiz topic or PDF-extracted text.
        num_questions: Number of questions to generate.
        difficulty: Difficulty level (easy, medium, hard).
        model: LiteLLM model identifier.
        image: Whether to include image-based questions.
        pdf: Optional path to a PDF file for topic extraction.

    Returns:
        QuizResponse: A validated Pydantic model of quiz questions.

    Raises:
        ValueError: If the PDF text extraction fails.
        pydantic.ValidationError: If the LLM response doesn't match the schema.
    """
    if pdf:
        pdf_text = extract_text_from_pdf(pdf)
        if pdf_text:
            truncated_text = _truncate_to_token_limit(pdf_text, max_tokens=80000)
            topic = f"the following reference document:\n<document>\n{truncated_text}\n</document>"
        else:
            raise ValueError("Failed to extract text from the provided PDF.")

    with open("assets/prompt.txt", "r", encoding="utf-8") as file:
        prompt = file.read().format(
            topic=topic, num_questions=num_questions, difficulty=difficulty, image=image
        )

    messages = [{"role": "user", "content": prompt}]

    if model not in AVAILABLE_MODELS:
        raise ValueError(f"Model {model} is not configured.")

    model_config = AVAILABLE_MODELS[model]

    kwargs = {
        "model": model,
        "messages": messages,
        "api_key": os.getenv(model_config.get("key_env", "")),
        "response_format": {"type": "json_object"},
    }

    if "api_base" in model_config:
        kwargs["api_base"] = model_config["api_base"]

    response = litellm.completion(**kwargs)
    raw_text = response.choices[0].message.content.strip()

    # Pydantic validates the schema; raises ValidationError on bad data
    return QuizResponse.model_validate_json(raw_text)


def process_images(quiz_response):
    """Download images for questions that have image descriptions.

    Args:
        quiz_response: A validated QuizResponse model.

    Returns:
        list[dict]: List of question dicts with image paths resolved.
    """
    questions = [q.model_dump() for q in quiz_response.questions]
    for question in questions:
        if isinstance(question["image"], str) and question["image"]:
            image_path = download_images(question["image"])
            question["image"] = image_path if image_path else "False"
        else:
            question["image"] = "False"
    logging.info("✅ Quiz generation completed successfully.")
    return questions
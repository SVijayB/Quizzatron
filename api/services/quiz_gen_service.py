"""Module for generating quizzes based on user input."""

import json
import logging
from flask import jsonify
import litellm
from pydantic import ValidationError
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
)

from api.models.schemas import QuizRequest, Difficulty
from api.utils.quiz_gen import generate_questions, process_images, AVAILABLE_MODELS

logger = logging.getLogger(__name__)


# Transient errors worth retrying with backoff
_RETRYABLE_ERRORS = (
    ValidationError,
    json.JSONDecodeError,
    litellm.RateLimitError,
    litellm.ServiceUnavailableError,
)


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    retry=retry_if_exception_type(_RETRYABLE_ERRORS),
    before_sleep=before_sleep_log(logger, logging.WARNING),
)
def _generate_with_retry(topic, num_questions, difficulty, model, image, pdf):
    """Call generate_questions with automatic retry on transient failures.

    Retries up to 3 times with exponential backoff (2s → 4s → 8s).
    Retries on:
        - ValidationError / JSONDecodeError: LLM returned bad data
        - RateLimitError / ServiceUnavailableError: transient capacity issues
    All other exceptions (auth failures, etc.) propagate immediately.
    """
    return generate_questions(topic, num_questions, difficulty, model, image, pdf)


def generate_quiz(
    topic=None,
    pdf=None,
    model="gemini/gemini-2.5-flash",
    difficulty="medium",
    num_questions=5,
    image=False,
):
    """
    Generate a quiz based on the given parameters.

    Args:
        topic (str, optional): The topic of the quiz. Defaults to None.
        pdf (str, optional): Path to a PDF file for quiz generation. Defaults to None.
        model (str, optional): The AI model to use. Defaults to "gemini/gemini-2.5-flash".
        difficulty (str, optional): The difficulty level of the quiz. Defaults to "medium".
        num_questions (int, optional): Number of questions to generate. Defaults to 5.
        image (bool, optional): Whether to include image-based questions. Defaults to False.

    Returns:
        tuple: A tuple containing a JSON response and an HTTP status code.
    """
    # Validate input using Pydantic
    try:
        req = QuizRequest(
            topic=topic,
            pdf=pdf,
            model=model,
            difficulty=difficulty,
            num_questions=num_questions,
            image=image,
        )
    except ValidationError as e:
        errors = e.errors()
        messages = [f"{err['loc'][-1]}: {err['msg']}" for err in errors]
        return jsonify({"error": "Invalid parameters", "details": messages}), 400

    if req.model not in AVAILABLE_MODELS:
        return jsonify({
            "error": f"Invalid model. Choose one: {list(AVAILABLE_MODELS.keys())}."
        }), 400

    logging.info("🔍 Input parameters validated. Payload is ready.")
    logging.info("⏳ Generating quiz questions on %s.", req.topic)

    try:
        quiz_response = _generate_with_retry(
            req.topic,
            req.num_questions,
            req.difficulty.value,
            req.model,
            req.image,
            req.pdf,
        )
        logging.info("💫 Model output validated successfully.")
        questions = process_images(quiz_response)
        return jsonify(questions, 200)

    except (litellm.RateLimitError, litellm.ServiceUnavailableError) as e:
        logging.error(
            "❌ Model service unavailable after %d retries: %s",
            3, str(e)
        )
        return (
            jsonify({"error": "Model service is temporarily unavailable. Please try again later."}),
            429,
        )
    except ValidationError:
        logging.error("❌ Model output validation failed after maximum retries.")
        return (
            jsonify({"error": "Invalid model output after multiple attempts."}),
            500,
        )
    except json.JSONDecodeError:
        logging.error("❌ Model returned non-JSON response after maximum retries.")
        return (
            jsonify({"error": "Invalid model output after multiple attempts."}),
            500,
        )
    except ValueError as e:
        logging.error("❌ Quiz generation failed: %s", str(e))
        return jsonify({"error": str(e)}), 400
    except Exception as e:  # pylint: disable=broad-except
        logging.error("❌ Unexpected error during quiz generation: %s", str(e))
        return jsonify({"error": "An unexpected error occurred."}), 500

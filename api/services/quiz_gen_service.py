"""This module contains the service function to generate quiz questions."""

import logging
from flask import jsonify
from api.utils.quiz_gen import generate_questions, parse_questions
from api.utils.validate_output import validate_model_output


def generate_quiz(
    topic=None,
    pdf=None,
    model="gemini",
    difficulty="medium",
    num_questions=5,
    image=False,
):
    """
    Generate a quiz based on the provided parameters.
    """

    def log_and_return_error(message, *args):
        logging.error(message, *args)
        return jsonify({"error": message % args}), 400

    if difficulty.lower() not in ["easy", "medium", "hard"]:
        return log_and_return_error(
            "Invalid difficulty. Choose one: [easy, medium, hard]"
        )

    if model.lower() not in ["deepseek", "gemini"]:
        return log_and_return_error("Invalid model. Choose one: [deepseek, gemini].")

    if num_questions is not None:
        try:
            num_questions = int(num_questions)
            if num_questions <= 0:
                return log_and_return_error("num_questions must be a positive integer.")
        except ValueError:
            return log_and_return_error("num_questions must be an integer.")

    if image is not None:
        image = image.lower() == "true"

    if pdf is not None and not pdf.lower().endswith(".pdf"):
        return log_and_return_error("Invalid file format.")

    logging.info("🔍 Input parameters validated. Payload is ready.")
    logging.info("⏳ Generating quiz questions... Please wait.")

    max_retries = 3
    try:
        for attempt in range(max_retries):
            response_text = generate_questions(
                topic, num_questions, difficulty, model, image, pdf
            )
            response_text = validate_model_output(response_text)
            if response_text is not False:
                logging.info("💫 Model output validated successfully.")
                break
            logging.warning(
                "⚠️ Model output validation failed. Retrying... (%d/%d)",
                attempt + 1,
                max_retries,
            )
        else:
            logging.error("❌ Model output validation failed after maximum retries.")
            return (
                jsonify({"error": "Invalid model output after multiple attempts."}),
                500,
            )

    except (TypeError, ValueError, KeyError) as e:
        logging.exception("❌ Quiz generation failed: %s", e)
        return jsonify({"error": "Quiz generation failed."}), 500

    questions = parse_questions(response_text)
    return jsonify(questions), 200

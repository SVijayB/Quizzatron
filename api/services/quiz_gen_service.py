"""Module for generating quizzes based on user input."""

import logging
from flask import jsonify
from api.utils.quiz_gen import generate_questions, parse_questions
from api.utils.validate_output import validate_model_output


# pylint: disable=too-many-arguments, too-many-positional-arguments, too-many-return-statements
def generate_quiz(
    topic=None,
    pdf=None,
    model="gemini",
    difficulty="medium",
    num_questions=5,
    image=False,
):
    """
    Generate a quiz based on the given parameters.

    Args:
        topic (str, optional): The topic of the quiz. Defaults to None.
        pdf (str, optional): Path to a PDF file for quiz generation. Defaults to None.
        model (str, optional): The AI model to use. Defaults to "gemini".
        difficulty (str, optional): The difficulty level of the quiz. Defaults to "medium".
        num_questions (int, optional): Number of questions to generate. Defaults to 5.
        image (bool, optional): Whether to include image-based questions. Defaults to False.

    Returns:
        tuple: A tuple containing a JSON response and an HTTP status code.
    """
    if difficulty.lower() not in ["easy", "medium", "hard"]:
        return (
            jsonify({"error": "Invalid difficulty. Choose one: [easy, medium, hard]"}),
            400,
        )

    if model.lower() not in ["deepseek", "gemini"]:
        return jsonify({"error": "Invalid model. Choose one: [deepseek, gemini]."}), 400

    if num_questions is not None:
        try:
            num_questions = int(num_questions)
            if num_questions <= 0:
                return (  # not hit
                    jsonify({"error": "num_questions must be a positive integer."}),
                    400,
                )
        except ValueError:  # not hit
            return (
                jsonify({"error": "num_questions must be an integer."}),
                400,
            )  # not hit

    if isinstance(image, str):  # Ensure `image` is a string before calling `.lower()`
        if image.lower() not in ["true", "false"]:
            return jsonify({"error": "image must be 'true' or 'false'."}), 400
        image = image.lower() == "true"

    if pdf is not None and not pdf.lower().endswith(".pdf"):
        return jsonify({"error": "Invalid file format."}), 400  # not hit

    logging.info("🔍 Input parameters validated. Payload is ready.")
    logging.info("⏳ Generating quiz questions on %s.", topic)

    max_retries = 3
    for attempt in range(max_retries):
        try:
            response_text = generate_questions(
                topic, num_questions, difficulty, model, image, pdf
            )
            validated_response = validate_model_output(response_text)
            if validated_response:
                logging.info("💫 Model output validated successfully.")
                questions = parse_questions(validated_response)
                return jsonify(questions, 200)
            logging.warning(  # not hit
                "⚠️ Model output validation failed. Retrying... (%d/%d)",
                attempt + 1,
                max_retries,
            )
        except Exception as error:  # pylint: disable=broad-except #not hit
            logging.error("❌ Quiz generation failed: %s", str(error))  # not hit

    logging.error("❌ Model output validation failed after maximum retries.")  # not hit
    return (
        jsonify({"error": "Invalid model output after multiple attempts."}),
        500,
    )  # not hit

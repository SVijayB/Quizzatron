from api.utils.quiz_gen import generate_questions, parse_questions
from flask import jsonify
import logging


def generate_quiz(
    topic=None,
    pdf=None,
    model="gemini",
    difficulty="medium",
    num_questions=5,
    image=False,
):

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
                return (
                    jsonify({"error": "num_questions must be a positive integer."}),
                    400,
                )
        except ValueError:
            return jsonify({"error": "num_questions must be an integer."}), 400

    if image is not None:
        if image.lower() not in ["true", "false"]:
            return jsonify({"error": "image must be 'true' or 'false'."}), 400
        if image.lower() == "true":
            image = True
        else:
            image = False

    if pdf is not None:
        if not pdf.lower().endswith((".pdf")):
            return (
                jsonify({"error": "Invalid file format. "}),
                400,
            )

    logging.info("🔍 Input parameters validated. Payload is ready.")
    logging.info("⏳ Generating quiz questions... Please wait.")
    try:
        response_text = generate_questions(
            topic, num_questions, difficulty, model, image, pdf
        )
    except Exception as e:
        logging.error(f"❌ Quiz generation failed: {e}")
        return jsonify({"error": "Quiz generation failed."}), 500
    questions = parse_questions(response_text)
    return jsonify(questions, 200)

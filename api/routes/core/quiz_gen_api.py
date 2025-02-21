from flask import Flask, jsonify, request, Blueprint
from utils.quiz_gen import generate_questions, parse_questions
import logging

core_quiz_gen_bp = Blueprint("core_quiz_gen_api", __name__, url_prefix="/quiz")


@core_quiz_gen_bp.route("/", methods=["GET"])
def ranking_function():
    return jsonify(
        {
            "message": "Quiz generating module is ready to go! Hit the /quiz/generate endpoint! 🚀"
        }
    )


@core_quiz_gen_bp.route("/generate", methods=["GET"])
def generate_quiz():
    model = request.args.get("model")
    topic = request.args.get("topic")
    difficulty = request.args.get("difficulty")
    num_questions = request.args.get("num_questions")
    image = request.args.get("image")

    if not model or not topic or not difficulty:
        return jsonify(
            {
                "error": "Please provide all required parameters: model, topic, difficulty"
            }
        )

    logging.info("⏳ Generating quiz questions... Please wait.")
    response_text = generate_questions(topic, num_questions, difficulty, model, image)
    questions = parse_questions(response_text)
    return jsonify(questions)

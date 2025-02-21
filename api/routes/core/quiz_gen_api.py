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
    pdf = request.args.get("pdf")

    if (not model or not difficulty) or (not topic and not pdf):
        return jsonify(
            {
                "error": "Please provide all required parameters: model, difficulty, topic or pdf. Optional parameters: num_questions, image.",
                "model": "deepseek or gemini",
                "difficulty": "easy, medium, or hard",
                "topic": "Topic for quiz questions",
                "num_questions": "Number of questions (default is 5)",
                "image": "Include images in questions (true or false)",
                "pdf": "Path to PDF file for topic extraction",
                "example1": "/quiz/generate?model=deepseek&difficulty=medium&topic=Python%20Programming&num_questions=5&image=true",
                "example2": "/quiz/generate?model=gemini&difficulty=hard&pdf=path/to/your.pdf&num_questions=10&image=false",
                "example3": "/quiz/generate?model=deepseek&difficulty=easy&topic=History&num_questions=3&image=true",
            }
        )

    logging.info("⏳ Generating quiz questions... Please wait.")
    response_text = generate_questions(
        topic, num_questions, difficulty, model, image, pdf
    )
    questions = parse_questions(response_text)
    return jsonify(questions)

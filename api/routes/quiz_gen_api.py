"""Module for handling quiz generation API routes."""

from flask import jsonify, request, Blueprint
from api.services.quiz_gen_service import generate_quiz

core_quiz_gen_bp = Blueprint("core_quiz_gen_api", __name__, url_prefix="/quiz")


@core_quiz_gen_bp.route("/", methods=["GET"])
def quiz():
    """Return a welcome message for the quiz generation module."""
    return jsonify(
        {
            "message": "Quiz generating module is ready to go! Hit the /quiz/generate endpoint! 🚀"
        }
    )


@core_quiz_gen_bp.route("/generate", methods=["GET"])
def generate():
    """Generate a quiz based on provided parameters."""
    model = request.args.get("model")
    topic = request.args.get("topic")
    difficulty = request.args.get("difficulty")
    num_questions = request.args.get("num_questions")
    image = request.args.get("image")
    pdf = request.args.get("pdf")

    if (not model or not difficulty) or (not topic and not pdf):
        return (
            jsonify(
                {
                    "error": "Please provide all required parameters: model, difficulty, "
                    "topic or pdf. Optional parameters: num_questions, image.",
                    "model": "deepseek or gemini",
                    "difficulty": "easy, medium, or hard",
                    "topic": "Topic for quiz questions",
                    "num_questions": "Number of questions (default is 5)",
                    "image": "Include images in questions (true or false)",
                    "pdf": "Path to PDF file for topic extraction",
                    "example1": "/quiz/generate?model=deepseek&difficulty=medium&topic=Coding"
                    "&num_questions=5&image=true",
                    "example2": "/quiz/generate?model=gemini&difficulty=hard&pdf=path/to/your.pdf"
                    "&num_questions=10&image=false",
                    "example3": "/quiz/generate?model=deepseek&difficulty=easy&topic=History"
                    "&num_questions=3&image=true",
                }
            ),
            400,
        )

    result = generate_quiz(
        model=model,
        topic=topic,
        difficulty=difficulty,
        num_questions=num_questions,
        image=image,
        pdf=pdf,
    )

    return result

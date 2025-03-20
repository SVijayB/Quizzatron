"""Module for handling quiz generation API routes."""

import os
from flask import jsonify, request, Blueprint
from werkzeug.utils import secure_filename
from api.services.quiz_gen_service import generate_quiz

core_quiz_gen_bp = Blueprint("core_quiz_gen_api", __name__, url_prefix="/quiz")

UPLOAD_FOLDER = "uploads"
ALLOWED_EXTENSIONS = {"pdf"}
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@core_quiz_gen_bp.route("/", methods=["GET"])
def quiz():
    """Return a welcome message for the quiz generation module."""
    return jsonify(
        {
            "message": "Quiz generating module is ready to go! Hit the /quiz/generate endpoint! 🚀"
        }
    )


@core_quiz_gen_bp.route("/generate", methods=["GET", "POST"])
def generate():
    """Generate a quiz based on provided parameters or a PDF file."""
    if request.method == "GET":
        model = request.args.get("model")
        topic = request.args.get("topic")
        difficulty = request.args.get("difficulty")
        num_questions = request.args.get("num_questions", default=5, type=int)
        image = request.args.get("image", default="false").lower() == "true"
        pdf = request.args.get("pdf")

        if not model or not difficulty or (not topic and not pdf):
            return (
                jsonify(
                    {
                        "error": "Missing required parameters. Provide model, difficulty, and either topic or pdf.",
                        "model": "deepseek or gemini",
                        "difficulty": "easy, medium, or hard",
                        "topic": "Topic for quiz questions",
                        "num_questions": "Number of questions (default is 5)",
                        "image": "Include images in questions (true or false)",
                        "pdf": "Path to PDF file for topic extraction",
                        "example1": "/quiz/generate?model=deepseek&difficulty=medium&topic=Coding&num_questions=5&image=true",
                        "example2": "/quiz/generate?model=gemini&difficulty=hard&pdf=path/to/your.pdf&num_questions=10&image=false",
                        "example3": "/quiz/generate?model=deepseek&difficulty=easy&topic=History&num_questions=3&image=true",
                    }
                ),
                400,
            )

    elif request.method == "POST":
        model = request.form.get("model")
        topic = request.form.get("topic")
        difficulty = request.form.get("difficulty")
        num_questions = int(request.form.get("num_questions", 5))
        image = request.form.get("image", "false").lower() == "true"
        pdf_file = request.files.get("pdf")

        if not model or not difficulty or (not topic and not pdf_file):
            return jsonify({"error": "Missing required parameters."}), 400

        pdf = None
        if pdf_file and allowed_file(pdf_file.filename):
            filename = secure_filename(pdf_file.filename)
            pdf = os.path.join(UPLOAD_FOLDER, filename)
            pdf_file.save(pdf)

    result = generate_quiz(
        model=model,
        topic=topic,
        difficulty=difficulty,
        num_questions=num_questions,
        image=image,
        pdf=pdf,
    )
    return result

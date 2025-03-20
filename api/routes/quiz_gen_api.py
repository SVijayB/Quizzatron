"""Module for handling quiz generation API routes."""

import os
from flask import jsonify, request, Blueprint
from werkzeug.utils import secure_filename
from api.services.quiz_gen_service import generate_quiz

# Blueprint for quiz generation API
core_quiz_gen_bp = Blueprint("core_quiz_gen_api", __name__, url_prefix="/quiz")

# Constants for file upload
UPLOAD_FOLDER = "uploads"
ALLOWED_EXTENSIONS = {"pdf"}

# Create upload folder if it doesn't exist
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)


def allowed_file(filename):
    """Check if the uploaded file has an allowed extension."""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@core_quiz_gen_bp.route("/", methods=["GET"])
def quiz():
    """Return a welcome message for the quiz generation module."""
    return jsonify(
        {
            "message": (
                "Quiz generating module is ready to go! "
                "Hit the /quiz/generate endpoint! 🚀"
            )
        }
    )


@core_quiz_gen_bp.route("/generate", methods=["GET", "POST"])
def generate():
    """
    Generate a quiz based on provided parameters or a PDF file.

    GET:
        - model: str, AI model to use (e.g., 'deepseek' or 'gemini').
        - topic: str, topic for quiz questions.
        - difficulty: str, difficulty level ('easy', 'medium', 'hard').
        - num_questions: int, number of questions (default is 5).
        - image: bool, whether to include images in questions.
        - pdf: str, path to PDF file for topic extraction.

    POST:
        - model: str, AI model to use.
        - topic: str, topic for quiz questions.
        - difficulty: str, difficulty level.
        - num_questions: int, number of questions.
        - image: bool, whether to include images in questions.
        - pdf_file: FileStorage, uploaded PDF file.

    Returns:
        JSON response with generated quiz or error message.
    """
    model = None
    topic = None
    difficulty = None
    num_questions = 5
    image = False
    pdf = None

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
                        "error": (
                            "Missing required parameters. Provide model, difficulty, "
                            "and either topic or pdf."
                        ),
                        "model": "deepseek or gemini",
                        "difficulty": "easy, medium, or hard",
                        "topic": "Topic for quiz questions",
                        "num_questions": "Number of questions (default is 5)",
                        "image": "Include images in questions (true or false)",
                        "pdf": "Path to PDF file for topic extraction",
                        "example1": (
                            "/quiz/generate?model=deepseek&difficulty=medium&topic=Coding&num_ques"
                            "tions=5&image=true"
                        ),
                        "example2": (
                            "/quiz/generate?model=gemini&difficulty=hard&pdf=path/to/your.pdf&num_q"
                            "uestions=10"
                            "&image=false"
                        ),
                        "example3": (
                            "/quiz/generate?model=deepseek&difficulty=easy&topic=History&num_ques"
                            "tions=3&image=true"
                        ),
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

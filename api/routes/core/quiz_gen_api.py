from flask import Flask, jsonify, request, Blueprint
from routes.core.quiz_gen_fn import generate_questions, parse_questions

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
    if not model or not topic or not difficulty:
        return jsonify(
            {
                "error": "Please provide all required parameters: model, topic, difficulty"
            }
        )

    print("Generating quiz questions... Please wait.")
    response_text = generate_questions(topic, num_questions, difficulty, model)
    questions = parse_questions(response_text, model, difficulty)
    return jsonify(questions)

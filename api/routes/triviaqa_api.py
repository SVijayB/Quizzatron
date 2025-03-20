from flask import jsonify, Blueprint, request
from api.services.triviaqa_api import check_connection, get_triviaqa

triviaqa_bp = Blueprint("triviaqa_api", __name__, url_prefix="/questions")


@triviaqa_bp.route("/", methods=["GET"])
def questions_route():
    """Test if connection to the triviaqa API and MongoDB is working."""
    if check_connection():
        return jsonify(
            {
                "message": "Categories module is ready to go! Hit the /questions endpoint! 🚀"
            }
        )
    else:
        return (
            jsonify({"message": "Failed to connect to the triviaqa API or MongoDB."}),
            500,
        )


@triviaqa_bp.route("/get", methods=["GET"])
def get_questions_route():
    topic = request.args.get("topic")
    num_questions = request.args.get("num_questions")
    difficulty = request.args.get("difficulty")

    questions = get_triviaqa(topic, num_questions, difficulty)
    return jsonify(questions)

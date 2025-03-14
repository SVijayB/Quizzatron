"""This module initializes the API blueprint and registers the core_quiz_gen_bp blueprint to it."""

from flask import Blueprint, jsonify
from api.routes.quiz_gen_api import core_quiz_gen_bp

api_blueprint = Blueprint("API", __name__, url_prefix="/api/")
api_blueprint.register_blueprint(core_quiz_gen_bp)


@api_blueprint.route("/", methods=["GET"])
def get_data():
    """Return a simple message to show the API is up and running."""
    return jsonify({"message": "Quizzatron API is up and running!🚀"})

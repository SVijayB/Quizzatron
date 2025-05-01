"""Blueprint module for the API routes of the application."""

from flask import Blueprint, jsonify
from api.routes.quiz_gen_api import core_quiz_gen_bp
from api.routes.categories_api import categories_bp
from api.routes.triviaqa_api import triviaqa_bp
from api.routes.info_api import info_bp
from api.routes.multiplayer_api import multiplayer_bp

api_blueprint = Blueprint("API", __name__, url_prefix="/api/")
api_blueprint.register_blueprint(core_quiz_gen_bp)
api_blueprint.register_blueprint(categories_bp)
api_blueprint.register_blueprint(triviaqa_bp)
api_blueprint.register_blueprint(info_bp)
api_blueprint.register_blueprint(multiplayer_bp)


@api_blueprint.route("/", methods=["GET"])
def get_data():
    """Return a simple JSON response to indicate the API is running."""
    return jsonify({"message": "Quizzatron API is up and running!🚀"})

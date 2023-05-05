from flask import Blueprint
from src.routes.core import core_api

api_blueprint = Blueprint("API", __name__, url_prefix="/api/")
api_blueprint.register_blueprint(core_api.core_bp)


@api_blueprint.route("/", methods=["GET"])
def get_data():
    return "<h1>API is live!</h1>"

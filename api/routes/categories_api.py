"""Module for Categories API route"""

from flask import jsonify, Blueprint
from api.utils.category_aggregator import get_categories

categories_bp = Blueprint("categories_api", __name__, url_prefix="/categories")


@categories_bp.route("/", methods=["GET"])
def categories_route():
    """Return a welcome message for the categories module."""
    return jsonify(
        {
            "message": "Categories module is ready to go! Hit the /categories/get endpoint! 🚀"
        }
    )


@categories_bp.route("/get", methods=["GET"])
def get_categories_route():
    """Get all of the parameters from MongoDB and return them as a JSON object."""
    categories = get_categories()
    return jsonify(categories)

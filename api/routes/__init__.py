"""Blueprint registration. Everything is mounted under ``/api``."""

from flask import Blueprint

from api.routes.category_routes import categories_bp
from api.routes.meta_routes import meta_bp
from api.routes.multiplayer_routes import multiplayer_bp
from api.routes.quiz_routes import quiz_bp

api_blueprint = Blueprint("api", __name__, url_prefix="/api")

api_blueprint.register_blueprint(meta_bp)
api_blueprint.register_blueprint(quiz_bp)
api_blueprint.register_blueprint(categories_bp)
api_blueprint.register_blueprint(multiplayer_bp)

__all__ = ["api_blueprint"]

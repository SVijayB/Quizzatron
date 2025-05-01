"""Flask application factory for creating and configuring the API."""

import os
import sys
import logging
import logging.config

from flask import Flask, request, render_template, send_from_directory
from flask_cors import CORS

from api.routes import api_blueprint
from api.socket_server import SocketServer
from api.routes.multiplayer_api import SocketIOHandler


def setup_logging():
    """Configure logging handlers and formatters."""
    file_handler = logging.FileHandler("app.log", mode="a", encoding="utf-8")
    stream_handler = logging.StreamHandler(sys.stdout)

    formatter = logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")
    file_handler.setFormatter(formatter)
    stream_handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    root_logger.addHandler(file_handler)
    root_logger.addHandler(stream_handler)


def create_app(env):
    """Factory function to create and configure the Flask application.

    Args:
        env (str): Application environment (e.g., DEVELOPMENT, PRODUCTION)

    Returns:
        Flask: Configured Flask application instance
    """
    setup_logging()
    app = Flask(__name__, instance_relative_config=True)
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")
    app.config["ENV"] = env
    app.url_map.strict_slashes = False

    # Configure CORS
    api_cors_config = {
        "origins": "*",
        "supports_credentials": True,
        "allow_headers": "*",
    }
    CORS(app, resources={"/*": api_cors_config})

    @app.route("/", methods=["GET"])
    def index():
        """Serve the main index page."""
        return render_template("index.html")

    @app.route("/favicon.ico")
    def favicon():
        """Serve the favicon."""
        return send_from_directory(
            os.path.join(app.root_path, "../assets"),
            "favicon.ico",
            mimetype="image/vnd.microsoft.icon",
        )

    @app.errorhandler(404)
    def page_not_found(_error):
        """Handle 404 errors by logging and returning an error response.

        Args:
            _error: Unused error object (required by Flask errorhandler)
        """
        app.logger.error("Page not found: %s", request.path)
        return f"ERROR 404: CANNOT GET {request.path}", 404

    # Register blueprints
    app.register_blueprint(api_blueprint)
    app.json.sort_keys = False

    # Initialize SocketIO using the new class-based approach
    socketio = SocketServer.init_socketio(app)

    # Initialize the socket handlers for multiplayer API
    SocketIOHandler.init_socketio(socketio)

    return app, socketio

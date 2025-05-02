"""Flask application factory for creating and configuring the API."""

import os
import sys
import logging
import logging.config

from flask import Flask, request, render_template, send_from_directory
from flask_cors import CORS

from api.routes import api_blueprint
from api.socket_server import init_socketio


def setup_logging():
    """Configure logging handlers and formatters."""
    # Create both file and console handlers
    file_handler = logging.FileHandler("app.log", mode="a", encoding="utf-8")
    console_handler = logging.StreamHandler(sys.stdout)

    # Create a formatter that includes timestamp for both handlers
    formatter = logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)

    # Filter to exclude socketio ping/pong messages
    class SocketIOFilter(logging.Filter):
        def filter(self, record):
            if record.getMessage().startswith(
                "Sending packet PING"
            ) or record.getMessage().startswith("Received packet PONG"):
                return False
            return True

    # Add the filter to both handlers
    socket_filter = SocketIOFilter()
    file_handler.addFilter(socket_filter)
    console_handler.addFilter(socket_filter)

    # For hosting on Render, ensure important logs go to stdout (console)
    # This makes logs visible in Render's log viewer
    file_handler.setLevel(logging.INFO)
    console_handler.setLevel(
        logging.INFO
    )  # Changed from WARNING to INFO for Render visibility

    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)

    # Remove any existing handlers to avoid duplicate logs
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    # Add our configured handlers
    root_logger.addHandler(file_handler)
    root_logger.addHandler(console_handler)

    # Set specific engine loggers to higher levels to reduce noise
    logging.getLogger("engineio").setLevel(logging.WARNING)
    logging.getLogger("socketio").setLevel(logging.WARNING)
    logging.getLogger("werkzeug").setLevel(logging.WARNING)


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

    # Initialize SocketIO
    socketio = init_socketio(app)

    return app, socketio

"""
This module sets up the Flask application and configures logging, CORS, and routes.
"""

import logging.config
import logging
import sys
import os
from flask.templating import render_template
from flask_cors import CORS
from flask import Flask, request, send_from_directory
from api.routes import api_blueprint


def setup_logging():
    """Set up logging configuration."""
    file_handler = logging.FileHandler("app.log", mode="a", encoding="utf-8")
    stream_handler = logging.StreamHandler(sys.stdout)

    formatter = logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")
    file_handler.setFormatter(formatter)
    stream_handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    root_logger.addHandler(file_handler)
    root_logger.addHandler(stream_handler)


def create_app():
    """Create and configure the Flask application."""
    setup_logging()
    app = Flask(__name__, instance_relative_config=True)
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")
    app.url_map.strict_slashes = False
    api_cors_config = {
        "origins": "*",
        "supports_credentials": True,
        "allow_headers": "*",
    }
    CORS(app, resources={"/*": api_cors_config})

    @app.route("/", methods=["GET"])
    def index():
        """Render the index page."""
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
    def page_not_found(e):
        """Handle 404 errors."""
        app.logger.error("Page not found: %s", request.path)
        return f"ERROR 404: CANNOT GET {request.path}", 404

    app.register_blueprint(api_blueprint)
    app.json.sort_keys = False

    return app

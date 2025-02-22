from flask.templating import render_template
from flask_cors import CORS, cross_origin
from flask import Flask, request, jsonify, send_from_directory
from api.routes import api_blueprint
import logging.config
import logging
import sys
import os


def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
    )


def create_app():
    setup_logging()
    app = Flask(__name__, instance_relative_config=True)
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")
    app.url_map.strict_slashes = False
    api_cors_config = {
        "origins": [
            "*",
            "http://localhost:3000",
        ]
    }
    CORS(app, resources={"/*": api_cors_config})

    @app.route("/", methods=["GET"])
    def index():
        return render_template("index.html")

    @app.route("/favicon.ico")
    def favicon():
        return send_from_directory(
            os.path.join(app.root_path, "../assets"),
            "favicon.ico",
            mimetype="image/vnd.microsoft.icon",
        )

    @app.errorhandler(404)
    def page_not_found(e):
        app.logger.error("Page not found: %s", request.path)  # Log the 404 error
        return "ERROR 404: CANNOT GET {}".format(request.path)

    app.register_blueprint(api_blueprint)
    app.json.sort_keys = False

    return app

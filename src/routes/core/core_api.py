from dotenv import load_dotenv
from flask import Flask, request, Blueprint
from src.routes.core.openai_api import quiz_generator

core_bp = Blueprint("core", __name__, url_prefix="/core")
load_dotenv()


@core_bp.route("/generate-mcq", methods=["GET", "POST"])
def extract():
    if request.method == "GET":
        return {"status": "success", "message": "Quiz Generator API is live!"}
    elif request.method == "POST":
        topic = request.form.get("topic")
        game_mode = request.form.get("game_mode")
        level = request.form.get("level")
        data = quiz_generator(topic, game_mode, level)
    return data

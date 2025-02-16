from flask import Flask, jsonify, request, Blueprint

core_quiz_gen_bp = Blueprint("core_quiz_gen_api", __name__, url_prefix="/generate-quiz")


@core_quiz_gen_bp.route("/", methods=["GET"])
def ranking_function():
    return jsonify({"message": "Quiz generating module is ready to go! 🚀"})

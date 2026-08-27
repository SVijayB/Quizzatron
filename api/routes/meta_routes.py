"""Health and project metadata."""

from __future__ import annotations

from flask import Blueprint, jsonify

from api.content.trivia import get_mongo_client
from api.core.config import get_settings
from api.llm.registry import available_models, default_model_key
from api.multiplayer.store import store

meta_bp = Blueprint("meta", __name__)

_TEAM = (
    {
        "name": "Vijay Balaji S",
        "role": "Backend and API",
        "linkedin": "https://www.linkedin.com/in/svijayb/",
        "image": "/static/dev_imgs/vijay.jpeg",
    },
    {
        "name": "Aravindh Manavalan",
        "role": "Data and infrastructure",
        "linkedin": "https://www.linkedin.com/in/aravindh-manavalan/",
        "image": "/static/dev_imgs/aravindh.jpeg",
    },
    {
        "name": "Akshay Ravi",
        "role": "Frontend",
        "linkedin": "https://www.linkedin.com/in/akshayravi13/",
        "image": "/static/dev_imgs/akshay.jpeg",
    },
    {
        "name": "Hariharan Sureshkumar",
        "role": "Testing and docs",
        "linkedin": "https://www.linkedin.com/in/hariharan-sureshkumar-4994a2254/",
        "image": "/static/dev_imgs/hari.jpeg",
    },
)


@meta_bp.get("")
@meta_bp.get("/")
def root():
    """Basic liveness response."""
    return jsonify({"name": "Quizzatron API", "version": 2, "status": "ok"})


@meta_bp.get("/health")
def health():
    """Readiness detail, including which dependencies are reachable."""
    settings = get_settings()
    models = available_models()
    return jsonify(
        {
            "status": "ok",
            "environment": settings.environment,
            "models": {
                "available": [spec.key for spec in models],
                "default": default_model_key(),
            },
            "mongo": get_mongo_client() is not None,
            "lobbies": store.count(),
        }
    )


@meta_bp.get("/dev-info")
@meta_bp.get("/dev-info/")
def dev_info():
    """Project team, for the About panel."""
    return jsonify({"team": list(_TEAM)})

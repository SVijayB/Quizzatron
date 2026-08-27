"""Flask application factory.

Changes from v1:

* The duplicate root-level ``app.py`` -- a second ``create_app`` that registered
  no blueprints at all -- is gone. There is one factory.
* CORS is an explicit origin allowlist. v1 combined ``origins: "*"`` with
  ``supports_credentials: True`` and ``allow_headers: "*"``, which is both
  invalid per the CORS spec and unsafe.
* ``SECRET_KEY`` is required outside local environments instead of silently
  defaulting to ``None``.
* ``MAX_CONTENT_LENGTH`` is set, so uploads are bounded.
* Runtime directories are created here rather than as an import side effect.
* A lobby reaper actually runs.
"""

from __future__ import annotations

import logging

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS

from api.core.config import ASSETS_DIR, ensure_runtime_dirs, get_settings
from api.core.errors import register_error_handlers
from api.core.logging_setup import setup_logging
from api.routes import api_blueprint
from api.socket_server import init_socketio

logger = logging.getLogger(__name__)


def create_app(env: str | None = None) -> tuple[Flask, object]:
    """Build the application and its Socket.IO server.

    Returns ``(app, socketio)``.
    """
    setup_logging()
    settings = get_settings()
    ensure_runtime_dirs()

    app = Flask(__name__, static_folder="static", static_url_path="/static")
    app.config.update(
        SECRET_KEY=settings.secret_key,
        ENV=env or settings.environment,
        MAX_CONTENT_LENGTH=settings.max_upload_bytes,
        JSON_SORT_KEYS=False,
    )
    app.json.sort_keys = False
    app.url_map.strict_slashes = False

    CORS(
        app,
        resources={r"/api/*": {"origins": settings.cors_origins}},
        supports_credentials=False,
        allow_headers=["Content-Type"],
        methods=["GET", "POST", "OPTIONS"],
    )

    app.register_blueprint(api_blueprint)
    register_error_handlers(app)

    @app.get("/")
    def index():
        """Point callers at the API."""
        return jsonify(
            {
                "name": "Quizzatron API",
                "version": 2,
                "docs": "/api/health",
            }
        )

    @app.get("/favicon.ico")
    def favicon():
        """Serve the favicon."""
        return send_from_directory(ASSETS_DIR, "favicon.ico", mimetype="image/vnd.microsoft.icon")

    socketio = init_socketio(app)
    _start_reaper(socketio)

    logger.info(
        "Quizzatron API ready (env=%s, origins=%s)",
        settings.environment,
        ", ".join(settings.cors_origins),
    )
    return app, socketio


def _start_reaper(socketio) -> None:
    """Run the lobby reaper in the background.

    v1 shipped two cleanup functions and called neither, so lobbies -- with every
    question payload and answer -- accumulated for the process lifetime.
    """
    from api.multiplayer.store import store

    settings = get_settings()

    def loop() -> None:
        while True:
            socketio.sleep(settings.reaper_interval_s)
            try:
                store.reap()
            except Exception:  # noqa: BLE001 - the reaper must never die
                logger.exception("Lobby reaper iteration failed")

    socketio.start_background_task(loop)

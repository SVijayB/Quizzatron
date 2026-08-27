"""WSGI entrypoint.

v1 had ``HOST = "0.0.0.0" if ENVIRONMENT == "LOCAL" else "0.0.0.0"`` -- a dead
ternary whose branches were identical, which also meant local development bound
every network interface while CORS was wide open and there was no auth. The host
now comes from settings and defaults to loopback locally.
"""

from __future__ import annotations

from dotenv import load_dotenv

load_dotenv()

# Imported after load_dotenv so settings observe the .env file.
from api.app import create_app  # noqa: E402
from api.core.config import get_settings  # noqa: E402

app, socketio = create_app()

if __name__ == "__main__":
    settings = get_settings()
    app.logger.info(
        "Serving on http://%s:%s (env=%s)",
        settings.host,
        settings.port,
        settings.environment,
    )
    socketio.run(
        app,
        host=settings.host,
        port=settings.port,
        debug=settings.is_local,
        allow_unsafe_werkzeug=settings.is_local,
    )

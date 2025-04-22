# pylint: disable=R0801
# Disable duplicate code check for this file (Need to re-import load_dotenv and os)
"""Module for running the WSGI server."""

import os

from dotenv import load_dotenv

from api.app import create_app
from api.socket_server import socketio

load_dotenv()
ENVIRONMENT = os.getenv("FLASK_ENV", "LOCAL").upper()
app, _ = create_app(ENVIRONMENT)

if __name__ == "__main__":
    HOST = "127.0.0.1" if ENVIRONMENT == "LOCAL" else "0.0.0.0"
    PORT = int(os.getenv("PORT", "5000"))

    app.logger.info("Running in %s environment on %s:%s", ENVIRONMENT, HOST, PORT)

    # Run with SocketIO instead of waitress for WebSocket support
    socketio.run(
        app,
        host=HOST,
        port=PORT,
        debug=ENVIRONMENT == "LOCAL",
        allow_unsafe_werkzeug=True,
    )

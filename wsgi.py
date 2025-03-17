"""Module for running the WSGI server."""

import os

from waitress import serve
from dotenv import load_dotenv

from api.app import create_app

load_dotenv()
ENVIRONMENT = os.getenv("FLASK_ENV", "LOCAL").upper()
app = create_app(ENVIRONMENT)

if __name__ == "__main__":
    HOST = "127.0.0.1" if ENVIRONMENT == "LOCAL" else "0.0.0.0"
    PORT = int(os.getenv("PORT", "8080"))

    app.logger.info("Running in %s environment on %s:%s", ENVIRONMENT, HOST, PORT)
    serve(app, host=HOST, port=PORT)

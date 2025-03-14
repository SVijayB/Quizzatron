import os
from api.app import create_app
from waitress import serve
from dotenv import load_dotenv

load_dotenv()
ENVIRONMENT = os.getenv("FLASK_ENV", "LOCAL").upper()
app = create_app(ENVIRONMENT)

if __name__ == "__main__":
    host = "127.0.0.1" if ENVIRONMENT == "LOCAL" else "0.0.0.0"
    port = int(os.getenv("PORT", 8080))

    app.logger.info(f"Running in {ENVIRONMENT} environment on {host}:{port}")
    serve(app, host=host, port=port)

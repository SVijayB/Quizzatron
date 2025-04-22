from flask import Flask
from flask_cors import CORS
from api.socket_server import init_socketio
from api.routes.multiplayer_api import multiplayer_bp

# ...other imports...


def create_app():
    """Create and configure the Flask application."""
    app = Flask(__name__)
    CORS(app)

    # Register blueprints
    app.register_blueprint(multiplayer_bp)
    # ...other blueprints...

    # Initialize SocketIO with the app
    socketio = init_socketio(app)

    return app, socketio


if __name__ == "__main__":
    app, socketio = create_app()
    # Run with socketio instead of app.run()
    socketio.run(app, debug=True, host="0.0.0.0", port=5000)

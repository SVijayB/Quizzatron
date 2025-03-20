"""
Launcher module for the Quizzatron application.
This module handles starting the Flask server and opening a browser window.
"""

import os
import threading
import time
import webbrowser
from waitress import serve
from .app import create_app


def open_browser(port=5000):
    """
    Open browser after a short delay to ensure server is running.

    This function is intended to be run in a separate thread.

    Args:
        port (int): The port number the server is running on
    """
    time.sleep(1.5)
    url = f"http://127.0.0.1:{port}"
    webbrowser.open(url)
    print(f"Opening Quizzatron in your browser at {url}")


def launch_application():
    """
    Launch the Quizzatron application.

    This function starts the Flask server and opens the browser.
    It supports both development and production modes.
    """
    # Print welcome message
    print("=" * 60)
    print("Welcome to Quizzatron!")
    print("AI-powered quizzing system that can generate questions on any topic")
    print("=" * 60)

    # Get port and host settings from environment variables
    port = int(os.environ.get("QUIZZATRON_PORT", 5000))
    host = os.environ.get("QUIZZATRON_HOST", "127.0.0.1")

    # Set up browser thread with the correct port
    browser_thread = threading.Thread(target=open_browser, args=(port,))
    browser_thread.daemon = True
    browser_thread.start()

    # Create the Flask application with appropriate environment
    if os.environ.get("QUIZZATRON_DEV", "").lower() == "true":
        env = "DEVELOPMENT"
    else:
        env = "PRODUCTION"

    # Create app using the factory pattern
    app = create_app(env)

    # Start server
    print(f"Starting server on {host}:{port}...")

    if env == "DEVELOPMENT":
        print("Running in development mode")
        app.run(host=host, port=port, debug=True)
    else:
        print("Running in production mode")
        serve(app, host=host, port=port, url_scheme="http")


if __name__ == "__main__":
    launch_application()

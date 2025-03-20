"""
Run script for Quizzatron application.

This script provides a direct way to run both the backend and frontend components.
It will:
1. Create and activate a virtual environment
2. Install all requirements
3. Start the Flask API server and the npm frontend
4. Open the frontend in the browser
"""

import os
import subprocess
import sys
import threading
import time
import webbrowser


def setup_virtual_environment():
    """
    Create and activate a virtual environment if one doesn't exist.

    Returns:
        bool: True if venv is set up and activated successfully, False otherwise
    """
    venv_dir = "venv"

    # Check if virtual environment already exists
    if os.path.exists(venv_dir):
        print(f"Virtual environment already exists at {venv_dir}")
    else:
        print("Creating virtual environment...")
        try:
            subprocess.check_call([sys.executable, "-m", "venv", venv_dir])
            print(f"Virtual environment created at {venv_dir}")
        except subprocess.CalledProcessError:
            print("Failed to create virtual environment. Please create it manually:")
            print(f"  {sys.executable} -m venv {venv_dir}")
            return False

    # Activate virtual environment
    # On Windows, activation is different
    if sys.platform == "win32":
        activate_script = os.path.join(venv_dir, "Scripts", "activate")
        activate_cmd = f"{activate_script} && python -c \"import sys; print('Activated virtualenv')\""
        # We need to set a flag for child processes to know they should run in the venv
        os.environ["QUIZZATRON_IN_VENV"] = "true"
    else:
        activate_script = os.path.join(venv_dir, "bin", "activate")
        # Use source to activate in bash/zsh
        activate_cmd = f"source {activate_script} && python -c \"import sys; print('Activated virtualenv')\""
        # We need to set a flag for child processes to know they should run in the venv
        os.environ["QUIZZATRON_IN_VENV"] = "true"

    print(f"Activating virtual environment using {activate_script}")

    # If this script was called without the venv
    if not os.environ.get("QUIZZATRON_IN_VENV"):
        print("Restarting script within virtual environment...")

        if sys.platform == "win32":
            # Windows needs a different approach
            venv_python = os.path.join(
                os.path.abspath(venv_dir), "Scripts", "python.exe"
            )
            current_script = os.path.abspath(__file__)

            # Launch a new process with the venv Python
            os.environ["QUIZZATRON_IN_VENV"] = "true"
            process = subprocess.Popen([venv_python, current_script], env=os.environ)
            process.wait()
            sys.exit(0)
        else:
            # On Unix-based systems
            venv_python = os.path.join(os.path.abspath(venv_dir), "bin", "python")
            current_script = os.path.abspath(__file__)

            # Launch a new process with the venv Python
            os.environ["QUIZZATRON_IN_VENV"] = "true"
            process = subprocess.Popen([venv_python, current_script], env=os.environ)
            process.wait()
            sys.exit(0)

    return True


def check_node_npm():
    """
    Check if Node.js and npm are installed, and provide installation instructions if not.

    Returns:
        bool: True if Node.js and npm are available, False otherwise
    """
    print("Checking for Node.js and npm...")

    try:
        # Try to run node --version
        node_version = subprocess.run(
            ["node", "--version"], capture_output=True, text=True
        )

        # Try to run npm --version
        npm_version = subprocess.run(
            ["npm", "--version"], capture_output=True, text=True
        )

        if node_version.returncode == 0 and npm_version.returncode == 0:
            print(
                f"Found Node.js {node_version.stdout.strip()} and npm {npm_version.stdout.strip()}"
            )
            return True

    except FileNotFoundError:
        pass

    # If we get here, either Node.js or npm is missing
    print("\n" + "=" * 60)
    print("Node.js and/or npm not found on your system.")
    print("The frontend requires Node.js and npm to run.")
    print("=" * 60)
    print("\nInstallation instructions:")

    if sys.platform == "darwin":  # macOS
        print(
            """
    macOS Installation Options:
    1. Download installer from https://nodejs.org/
    2. Using Homebrew: brew install node
    3. Using MacPorts: port install nodejs npm
        """
        )
    elif sys.platform == "win32":  # Windows
        print(
            """
    Windows Installation:
    1. Download installer from https://nodejs.org/
    2. Using Chocolatey: choco install nodejs
    3. Using Scoop: scoop install nodejs
        """
        )
    else:  # Linux
        print(
            """
    Linux Installation:
    1. Using apt (Ubuntu/Debian): sudo apt install nodejs npm
    2. Using dnf (Fedora): sudo dnf install nodejs
    3. Using pacman (Arch): sudo pacman -S nodejs npm
    4. Download from https://nodejs.org/
        """
        )

    print(
        "\nAfter installing Node.js and npm, run this script again to set up the frontend.\n"
    )
    return False


def install_requirements():
    """
    Install all dependencies for both backend and frontend.

    This ensures all required packages are available before running the app.
    """
    print("Installing backend dependencies...")
    subprocess.check_call(
        [sys.executable, "-m", "pip", "install", "-r", "requirements.txt"]
    )
    print("Backend dependencies installed successfully!")

    # Check if frontend directory exists
    if os.path.exists("frontend"):
        # Check if Node.js and npm are available
        node_available = check_node_npm()

        if not node_available:
            print("\nProceeding with backend only...")
            # Set a flag to indicate we should only run the backend
            os.environ["QUIZZATRON_BACKEND_ONLY"] = "true"
            return

        print("Installing frontend dependencies...")
        frontend_dir = os.path.abspath("frontend")
        npm_install = subprocess.run(
            ["npm", "install"], cwd=frontend_dir, capture_output=True, text=True
        )
        if npm_install.returncode != 0:
            print("Warning: Frontend dependencies installation failed.")
            print(f"npm install output: {npm_install.stderr}")
            os.environ["QUIZZATRON_BACKEND_ONLY"] = "true"
        else:
            print("Frontend dependencies installed successfully!")


def open_browser():
    """
    Open browser after a short delay to ensure server is running.

    This function is intended to be run in a separate thread.
    """
    time.sleep(3)  # Increased delay to allow both servers to start

    # Get frontend URL (updated to use localhost and port 8080 by default)
    frontend_port = int(os.environ.get("QUIZZATRON_FRONTEND_PORT", 8080))
    frontend_url = f"http://localhost:{frontend_port}"

    # Open only the frontend URL
    webbrowser.open(frontend_url)
    print(f"Opening Quizzatron frontend in your browser at {frontend_url}")


def run_frontend():
    """
    Run the frontend application using npm.
    """
    print("Starting frontend application...")
    frontend_dir = os.path.abspath("frontend")

    try:
        # Try to check if npm is available
        try:
            subprocess.run(["npm", "--version"], capture_output=True, check=True)
        except (FileNotFoundError, subprocess.CalledProcessError):
            print("Error: npm is not available. Cannot start frontend.")
            print("You need to install Node.js and npm from https://nodejs.org/")
            return

        # Run npm dev command in frontend directory
        subprocess.run(["npm", "run", "dev"], cwd=frontend_dir)
    except KeyboardInterrupt:
        print("Frontend server stopped.")
    except Exception as e:
        print(f"Error starting frontend: {e}")


def run_backend():
    """
    Run the Flask backend application.

    This function starts the Flask server using the application factory pattern.
    """
    print("Starting backend server...")

    # Import the Flask app
    sys.path.insert(0, os.path.abspath("."))  # Ensure api module can be found
    # pylint: disable=import-outside-toplevel
    from api.app import create_app

    # Create the Flask application with appropriate environment
    if os.environ.get("QUIZZATRON_DEV", "").lower() == "true":
        env = "DEVELOPMENT"
    else:
        env = "PRODUCTION"

    # Create app using the factory pattern
    app = create_app(env)

    # Get server configuration
    host = os.environ.get("QUIZZATRON_HOST", "127.0.0.1")
    port = int(os.environ.get("QUIZZATRON_PORT", 5000))

    print(f"Backend server will run on {host}:{port}")

    # Run in development or production mode
    if env == "DEVELOPMENT":
        print("Running backend in development mode")
        app.run(host=host, port=port, debug=True)
    else:
        # pylint: disable=import-outside-toplevel
        from waitress import serve

        print("Running backend in production mode")
        serve(app, host=host, port=port, url_scheme="http")


def run_app():
    """
    Run the complete Quizzatron application (backend + frontend).

    This function starts both the Flask server and the npm frontend.
    Only the frontend will be opened in the browser.
    """
    print("=" * 60)
    print("Welcome to Quizzatron!")
    print("AI-powered quizzing system that can generate questions on any topic")
    print("=" * 60)

    # Check if we should run backend only
    backend_only = os.environ.get("QUIZZATRON_BACKEND_ONLY", "").lower() == "true"

    if not backend_only:
        # Start browser after short delay (only opening frontend)
        browser_thread = threading.Thread(target=open_browser)
        browser_thread.daemon = True
        browser_thread.start()

        # Start frontend in a separate thread
        frontend_thread = threading.Thread(target=run_frontend)
        frontend_thread.daemon = True
        frontend_thread.start()
    else:
        print("Running backend only. Frontend will not be started.")

    # Run backend in main thread
    run_backend()


if __name__ == "__main__":
    # Set up virtual environment first
    setup_virtual_environment()

    # Then proceed with normal flow
    install_requirements()
    run_app()

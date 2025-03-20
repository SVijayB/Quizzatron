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
import platform
import subprocess
import sys
import threading
import time
import webbrowser


def check_python_version():
    """
    Check if the current Python version is compatible with Quizzatron.

    Returns:
        bool: True if compatible, False otherwise
    """
    python_version = platform.python_version()
    major, minor, _ = map(int, python_version.split("."))

    if (major == 3 and minor >= 10) or major > 3:
        print(f"Python version {python_version} is compatible")
        return True

    print("=" * 60)
    print(f"ERROR: Incompatible Python version: {python_version}")
    print("Quizzatron requires Python 3.10 or higher")
    print("Please upgrade your Python installation")
    print("=" * 60)
    return False


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

    # Get the appropriate activation script based on platform
    activate_script = (
        os.path.join(venv_dir, "Scripts", "activate")
        if sys.platform == "win32"
        else os.path.join(venv_dir, "bin", "activate")
    )

    # Set environment flag for venv
    os.environ["QUIZZATRON_IN_VENV"] = "true"

    print(f"Activating virtual environment using {activate_script}")

    # If not already in venv, restart the script with venv python
    if not os.environ.get("QUIZZATRON_IN_VENV"):
        print("Restarting script within virtual environment...")

        # Get the appropriate python executable based on platform
        venv_python = (
            os.path.join(os.path.abspath(venv_dir), "Scripts", "python.exe")
            if sys.platform == "win32"
            else os.path.join(os.path.abspath(venv_dir), "bin", "python")
        )

        current_script = os.path.abspath(__file__)
        os.environ["QUIZZATRON_IN_VENV"] = "true"

        # Start new process with venv python
        with subprocess.Popen([venv_python, current_script], env=os.environ) as process:
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
        # Check Node.js version
        node_version = subprocess.run(
            ["node", "--version"], capture_output=True, text=True, check=True
        )

        # Check npm version
        npm_version = subprocess.run(
            ["npm", "--version"], capture_output=True, text=True, check=True
        )

        print(
            f"Found Node.js {node_version.stdout.strip()} and npm {npm_version.stdout.strip()}"
        )
        return True

    except (FileNotFoundError, subprocess.CalledProcessError):
        print("\n" + "=" * 60)
        print("Node.js and/or npm not found on your system.")
        print("The frontend requires Node.js and npm to run.")
        print("=" * 60)
        print("\nInstallation instructions:")

        # Platform-specific installation instructions
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
        else:  # Linux and other platforms
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

    # Install Python dependencies
    subprocess.check_call(
        [sys.executable, "-m", "pip", "install", "-r", "requirements.txt"]
    )
    print("Backend dependencies installed successfully!")

    # Check and install frontend dependencies if directory exists
    if os.path.exists("frontend"):
        node_available = check_node_npm()

        if not node_available:
            print("\nProceeding with backend only...")
            os.environ["QUIZZATRON_BACKEND_ONLY"] = "true"
            return

        print("Installing frontend dependencies...")
        frontend_dir = os.path.abspath("frontend")

        try:
            # Install frontend dependencies
            npm_install = subprocess.run(
                ["npm", "install"],
                cwd=frontend_dir,
                capture_output=True,
                text=True,
                check=True,
            )

            if npm_install.returncode != 0:  # This should not happen with check=True
                print("Warning: Frontend dependencies installation failed.")
                print(f"npm install output: {npm_install.stderr}")
                os.environ["QUIZZATRON_BACKEND_ONLY"] = "true"
            else:
                print("Frontend dependencies installed successfully!")

        except subprocess.CalledProcessError as error:
            print(f"Error installing frontend dependencies: {error}")
            os.environ["QUIZZATRON_BACKEND_ONLY"] = "true"


def open_browser():
    """
    Open browser after a short delay to ensure server is running.

    This function is intended to be run in a separate thread.
    """
    time.sleep(3)  # Give servers time to start

    # Get frontend URL with default port 8080
    frontend_port = int(os.environ.get("QUIZZATRON_FRONTEND_PORT", 8080))
    frontend_url = f"http://localhost:{frontend_port}"

    # Open the frontend URL in browser
    webbrowser.open(frontend_url)
    print(f"Opening Quizzatron frontend in your browser at {frontend_url}")


def run_frontend():
    """
    Run the frontend application using npm.
    """
    print("Starting frontend application...")
    frontend_dir = os.path.abspath("frontend")

    try:
        # Verify npm is available
        subprocess.run(["npm", "--version"], capture_output=True, check=True)

        # Start the frontend development server
        subprocess.run(["npm", "run", "dev"], cwd=frontend_dir, check=True)

    except (FileNotFoundError, subprocess.CalledProcessError):
        print("Error: npm is not available. Cannot start frontend.")
        print("You need to install Node.js and npm from https://nodejs.org/")

    except KeyboardInterrupt:
        print("Frontend server stopped.")

    except (OSError, IOError, subprocess.SubprocessError) as error:
        # Catching specific exceptions instead of broad Exception
        print(f"Error starting frontend: {error}")


def run_backend():
    """
    Run the Flask backend application.

    This function starts the Flask server using the application factory pattern.
    """
    print("Starting backend server...")

    # Add current directory to Python path
    sys.path.insert(0, os.path.abspath("."))

    # Import app factory function (import here to ensure path is set correctly)
    # pylint: disable=import-outside-toplevel
    from api.app import create_app

    # Determine environment mode
    env = (
        "DEVELOPMENT"
        if os.environ.get("QUIZZATRON_DEV", "").lower() == "true"
        else "PRODUCTION"
    )

    # Create the Flask app
    app = create_app(env)

    # Get host and port settings
    host = os.environ.get("QUIZZATRON_HOST", "127.0.0.1")
    port = int(os.environ.get("QUIZZATRON_PORT", 5000))

    print(f"Backend server will run on {host}:{port}")

    # Run in appropriate mode
    if env == "DEVELOPMENT":
        print("Running backend in development mode")
        app.run(host=host, port=port, debug=True)
        return

    # Production mode using waitress
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
        # Start browser in a separate thread
        browser_thread = threading.Thread(target=open_browser, daemon=True)
        browser_thread.start()

        # Start frontend in a separate thread
        frontend_thread = threading.Thread(target=run_frontend, daemon=True)
        frontend_thread.start()
    else:
        print("Running backend only. Frontend will not be started.")

    # Run backend in main thread
    run_backend()


if __name__ == "__main__":
    if check_python_version():
        setup_virtual_environment()
        install_requirements()
        run_app()
    else:
        sys.exit(1)

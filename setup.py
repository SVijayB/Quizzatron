"""
Setup script for the Quizzatron application.
"""

from setuptools import setup, find_packages

# Read the requirements from requirements.txt
with open("requirements.txt", encoding="utf-8") as f:
    requirements = f.read().splitlines()

# Long description broken into multiple lines to keep line length under 100
long_desc = (
    "Quizzatron is an AI-powered quizzing system that can generate questions on any topic - "
    "SATs, movies, national flags, or whatever you choose! The application supports custom "
    "inputs like PDFs or images and can also generate quizzes autonomously using DeepSeek. "
    "It provides an engaging learning experience with minimal human input."
)

setup(
    name="quizzatron",
    version="1.0.0",
    description="AI-powered quizzing system that can generate questions on any topic",
    long_description=long_desc,
    long_description_content_type="text/markdown",
    author="",  # Add your name here
    author_email="",  # Add your email here
    url="https://github.com/yourusername/quizzatron",  # Update with your GitHub URL
    packages=find_packages(),
    include_package_data=True,
    classifiers=[
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "License :: OSI Approved :: MIT License",  # Change license if needed
        "Operating System :: OS Independent",
    ],
    python_requires=">=3.10",
    install_requires=requirements,
    # Command line scripts
    entry_points={
        "console_scripts": [
            "quizzatron=api.launcher:launch_application",
        ],
    },
    package_data={
        "api": [
            "templates/*",
            "static/**/*",
        ],
    },
)

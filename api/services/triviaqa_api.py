"""Module for handling TriviaQA API and MongoDB interactions."""

import os
import logging
from dotenv import load_dotenv
import requests
from pymongo import MongoClient
from api.utils.category_aggregator import get_categories
from api.utils.opentdb_data import get_questions_from_api, format_question_api_output
from api.utils.mongodb_data import get_mongodb_data

load_dotenv()
CONNECTION_STRING = os.getenv("MONGO_CONNECTION_STRING")


def check_connection():
    """Check the connection to the TriviaQA API and MongoDB."""
    try:
        api_url = "https://opentdb.com/api_category.php"
        response = requests.get(api_url, timeout=5)
        response.raise_for_status()

        client = MongoClient(CONNECTION_STRING)
        client.admin.command("ping")
        return True
    except (requests.RequestException, MongoClient.ServerSelectionTimeoutError) as e:
        logging.error("Failed to connect to the triviaqa API or MongoDB: %s", str(e))
        return False


def get_triviaqa(topic, num_questions, difficulty):
    """
    Retrieve trivia questions based on the given parameters.

    Args:
        topic (str): The topic or category of the questions.
        num_questions (int): The number of questions to retrieve.
        difficulty (str): The difficulty level of the questions.

    Returns:
        list: A list of trivia questions, or None if the category is not found.
    """
    categories = get_categories()
    category = categories.get(topic)
    if isinstance(category, int):
        # If the category is a number (ID), use the get_questions_from_api function
        api_question_json = get_questions_from_api(
            category=str(category),
            difficulty=difficulty,
            num_questions=str(num_questions),
        )
        return format_question_api_output(api_question_json)

    if isinstance(category, str):
        client = MongoClient(CONNECTION_STRING)
        result = get_mongodb_data(client, topic, num_questions, difficulty)
        if result:
            return result
        return f"Collection '{topic}' does not exist in database 'trivia-qa'."

    print(f"Category '{topic}' not found")
    return None

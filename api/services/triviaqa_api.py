import logging
from flask import jsonify
import requests
from pymongo import MongoClient
from api.utils.category_aggregator import get_categories
from api.utils.opentdb_data import get_questions_from_api, format_question_api_output


def check_connection():
    try:
        api_url = "https://opentdb.com/api_category.php"
        response = requests.get(api_url, timeout=5)  # Set timeout to 5 seconds
        response.raise_for_status()

        connection_string = os.getenv("MONGO_CONNECTION_STRING")
        client = MongoClient(connection_string)
        client.admin.command("ping")
        return True
    except:
        logging.error("Failed to connect to the triviaqa API or MongoDB.")
        return False


def get_triviaqa(topic, num_questions, difficulty):
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

    elif isinstance(category, str):
        # If the category is a string (like "trivia-qa"), we need to handle it differently
        # This part would depend on how you want to handle these categories
        print(f"Category '{topic}' needs to be handled separately")
        return None
    else:
        print(f"Category '{topic}' not found")
        return None

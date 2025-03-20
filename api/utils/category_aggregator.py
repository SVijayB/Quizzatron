import logging
import requests
from flask import jsonify
import os
from pymongo import MongoClient


def get_categories():
    # Get categories from the Open Trivia Database API
    try: 
        api_url = "https://opentdb.com/api_category.php"
        response = requests.get(api_url, timeout=5)  # Set timeout to 5 seconds
        response.raise_for_status()  # Raise an error for bad responses (4xx, 5xx)
        api_data = response.json()  # Convert to JSON

        connection_string = os.getenv("MONGO_CONNECTION_STRING")
        client = MongoClient(connection_string)
        db = client["trivia-qa"]
        collection_names = db.list_collection_names()

        categories = {}
        for category in api_data["trivia_categories"]:
            categories[category["name"]] = category["id"]
        for collection_name in collection_names:
            categories[collection_name] = "trivia-qa"

        return categories

    except requests.exceptions.RequestException as error:
        logging.warning("❌ API Request Failed:", error)
        raise

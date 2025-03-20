"""Utility module for aggregating trivia categories from Open Trivia Database API and MongoDB."""

import logging
import os
import requests
from pymongo import MongoClient


def get_categories():
    """
    Retrieve trivia categories from the Open Trivia Database API and MongoDB.

    Returns:
        dict: A dictionary mapping category names to their IDs or collection names.
    """
    try:
        # Fetch categories from Open Trivia Database API
        api_url = "https://opentdb.com/api_category.php"
        response = requests.get(api_url, timeout=5)
        response.raise_for_status()
        api_data = response.json()

        # Connect to MongoDB and fetch collection names
        connection_string = os.getenv("MONGO_CONNECTION_STRING")
        client = MongoClient(connection_string)
        db = client["trivia-qa"]
        collection_names = db.list_collection_names()

        # Aggregate categories from API and MongoDB
        categories = {}
        for category in api_data["trivia_categories"]:
            categories[category["name"]] = category["id"]
        for collection_name in collection_names:
            categories[collection_name] = "trivia-qa"

        return categories

    except requests.exceptions.RequestException as error:
        logging.warning("API Request Failed: %s", str(error))
        raise

"""
This script interacts with the Open Trivia Database API and MongoDB to fetch,
store, and format trivia questions and categories for the Quizzatron application.
"""

import pymongo as pm
import urllib
import requests
import json
import random
from typing import Optional, Dict, Any

# URL to fetch categories from Open Trivia Database API
CATEGORIES_URL = "https://opentdb.com/api_category.php"

# MongoDB connection URL
MONGO_URL = (
    "mongodb+srv://aravindh:"
    + urllib.parse.quote_plus("Jumpforce@1")
    + "@quizzatron.isdnz.mongodb.net/?retryWrites=true&w=majority&appName=Quizzatron"
)


def create_session_token() -> None:
    """
    Placeholder function to create a session token.
    This function can be implemented to interact with the Open Trivia Database API
    to generate a session token for managing user sessions.
    """
    pass


def cat_list_from_db() -> Optional[str]:
    """
    Connect to MongoDB and list trivia categories stored in the database.

    Returns:
        Optional[str]: A JSON string containing category names and their IDs, or None if an error occurs.
    """
    try:
        # Connect to MongoDB
        client = pm.MongoClient(MONGO_URL)
        client.admin.command("ping")  # Check if the server is reachable
        print("✅ Successfully connected to MongoDB!")
    except Exception as e:
        print("❌ Connection failed:", e)
        return None

    try:
        # Access the database and collection
        db = client["opent_db"]
        collection = db["categories"]

        # Fetch categories from the database
        json_categories = collection.find_one()

        # Extract category names and IDs
        q_names = {
            list(x.values())[1]: list(x.values())[0]
            for x in json_categories["trivia_categories"]
        }

        # Convert the dictionary to a JSON string
        json_string = json.dumps(q_names)
        print(json_string)
        return json_string
    except Exception as e:
        print("❌ Cannot find JSON categories in the database:", e)
        return None


def get_questions_from_api(
    category: str = "9", difficulty: str = "easy", num_questions: str = "5"
):
    """
    Fetch trivia questions from the Open Trivia Database API.

    Args:
        category (str): The category ID for the questions.
        difficulty (str): The difficulty level ("easy", "medium", or "hard").
        num_questions (str): The number of questions to fetch (max 50).

    Returns:
        Optional[Dict[str, Any]]: A dictionary containing the API response with trivia questions, or None if an error occurs.

    Raises:
        TypeError: If the input arguments are not of the expected types.
    """
    if not isinstance(category, str):
        raise TypeError("category must be a string")
    if not isinstance(difficulty, str):
        raise TypeError("difficulty must be a string")
    if not isinstance(num_questions, str):
        raise TypeError("num_questions must be a string")

    question_type = "multiple"  # Hardcoded to "multiple" for this use case
    question_url = (
        f"https://opentdb.com/api.php?amount={num_questions}&category={category}"
        f"&difficulty={difficulty}&type={question_type}"
    )

    try:
        # Send a GET request to the API
        response = requests.get(question_url, timeout=5)
        response.raise_for_status()  # Raise an error for bad responses (4xx, 5xx)

        # Parse the JSON response
        q_data = response.json()
        print("✅ Data received:", q_data)
        return q_data
    except requests.exceptions.RequestException as e:
        print("❌ API Request Failed:", e)
        return None


def format_question_api_output(api_question_json: Dict[str, Any]):
    """
    Format the output of trivia questions fetched from the API.

    Args:
        api_question_json (Dict[str, Any]): The JSON response from the API containing trivia questions.

    Returns:
        Optional[str]: A formatted JSON string with questions and their options, or None if an error occurs.

    Raises:
        TypeError: If the input is not a dictionary.
    """
    if not isinstance(api_question_json, dict):
        raise TypeError("api_question_json must be a dictionary")

    try:
        # Mapping letters to options
        option_letters = ["A", "B", "C", "D"]

        # Initialize the output structure
        output_json = {"questions": []}

        # Process each question in the API response
        for index, item in enumerate(api_question_json["results"], start=1):
            # Combine correct and incorrect answers
            all_answers = item["incorrect_answers"] + [item["correct_answer"]]
            random.shuffle(all_answers)  # Shuffle answers to randomize order

            # Create options with letter labels
            options_dict = {option_letters[i]: all_answers[i] for i in range(4)}

            # Find the correct answer's letter
            correct_letter = next(
                letter
                for letter, answer in options_dict.items()
                if answer == item["correct_answer"]
            )

            # Format the question entry
            question_entry = {
                "index": index,
                "question": item["question"],
                "options": [f"{key}) {value}" for key, value in options_dict.items()],
                "correct_answer": correct_letter,
                "difficulty": item["difficulty"],
                "image": False,  # Placeholder for image support
            }

            # Append the formatted question to the output
            output_json["questions"].append(question_entry)

        # Convert the output to a JSON string
        formatted_json = json.dumps(output_json, indent=4)

        # Replace single curly braces with double curly braces for compatibility
        formatted_json = formatted_json.replace("{", "{{").replace("}", "}}")
        print("✅ Question formatted for Quizzatron:", formatted_json)
        return formatted_json
    except Exception as e:
        print("❌ Error formatting question data from API:", e)
        return None


# Example usage of the functions
if __name__ == "__main__":
    # List categories from the database
    cat_list_from_db()

    # Fetch and format questions from the API
    api_response = get_questions_from_api()
    if api_response:
        format_question_api_output(api_response)

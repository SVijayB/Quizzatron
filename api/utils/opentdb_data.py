"""Utility module for fetching and formatting trivia questions from the Open Trivia Database API."""

import logging
import random
import html
from typing import Dict, Any, Optional
import requests


def get_questions_from_api(
    category: str = "9", difficulty: str = "easy", num_questions: str = "5"
) -> Optional[Dict[str, Any]]:
    """
    Fetch trivia questions from the Open Trivia Database API.

    Args:
        category (str): The category ID for the questions. Defaults to "9".
        difficulty (str): The difficulty level of the questions. Defaults to "easy".
        num_questions (str): The number of questions to fetch. Defaults to "5".

    Returns:
        Optional[Dict[str, Any]]: A dictionary containing the fetched questions, or 
        None if an error occurs.

    Raises:
        TypeError: If any of the input parameters are not strings.
    """
    if not all(
        isinstance(param, str) for param in [category, difficulty, num_questions]
    ):
        raise TypeError("All parameters must be strings")

    question_type = "multiple"  # Hardcoded to "multiple" for this use case
    question_url = (
        f"https://opentdb.com/api.php?amount={num_questions}&category={category}"
        f"&difficulty={difficulty}&type={question_type}"
    )

    try:
        response = requests.get(question_url, timeout=5)
        response.raise_for_status()

        # Convert response to JSON
        q_data = response.json()

        # Decode HTML entities in questions and options
        for question in q_data.get("results", []):
            question["question"] = html.unescape(question["question"])
            question["correct_answer"] = html.unescape(question["correct_answer"])
            question["incorrect_answers"] = [
                html.unescape(ans) for ans in question["incorrect_answers"]
            ]

        logging.info("Data received from the API")
        return q_data
    except requests.exceptions.RequestException as e:
        logging.warning("API Request Failed: %s", str(e))
        return None


def format_question_api_output(
    api_question_json: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    """
    Format the output of trivia questions fetched from the API.

    Args:
        api_question_json (Dict[str, Any]): The JSON response from the API containing trivia
        questions.

    Returns:
        Optional[Dict[str, Any]]: A formatted dictionary with questions and their options, or
        None if an error occurs.

    Raises:
        TypeError: If the input is not a dictionary.
    """
    if not isinstance(api_question_json, dict):
        raise TypeError("api_question_json must be a dictionary")

    try:
        option_letters = ["A", "B", "C", "D"]
        output_json = {"questions": []}

        for index, item in enumerate(api_question_json["results"], start=1):
            all_answers = item["incorrect_answers"] + [item["correct_answer"]]
            random.shuffle(all_answers)

            options_dict = {
                option_letters[i]: all_answers[i] for i in range(len(all_answers))
            }
            correct_letter = next(
                letter
                for letter, answer in options_dict.items()
                if answer == item["correct_answer"]
            )

            question_entry = {
                "index": index,
                "question": item["question"],
                "options": [f"{key}) {value}" for key, value in options_dict.items()],
                "correct_answer": correct_letter,
                "difficulty": item["difficulty"],
                "image": False,  # Placeholder for image support
            }

            output_json["questions"].append(question_entry)
        return output_json
    except KeyError as e:
        logging.error("Missing key in API response: %s", str(e))
        return None

import logging
import requests
from typing import Dict, Any
import random
import html


def get_questions_from_api(
    category: str = "9", difficulty: str = "easy", num_questions: str = "5"
):
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

        logging.info("✅ Data received from the API")
        return q_data
    except requests.exceptions.RequestException as e:
        logging.warning("❌ API Request Failed:", e)
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
        return output_json
    except Exception as e:
        print("❌ Error formatting question data from API:", e)
        return None

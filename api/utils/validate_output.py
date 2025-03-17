"""Module for validating the output of AI models used in quiz generation."""

import json
import logging


# pylint: disable=too-many-return-statements, too-many-branches
def validate_model_output(model_output):
    """
    Validate the output from the AI model to ensure it meets the required format.

    Args:
        model_output (str): The output string from the AI model.

    Returns:
        str or bool: The validated model output if valid, False otherwise.
    """
    try:
        if isinstance(model_output, str):
            model_output = model_output.strip()

            if model_output.startswith("```json"):
                model_output = model_output[7:].strip()
            if model_output.endswith("```"):
                model_output = model_output[:-3].strip()
        model_output = model_output.replace("\n", "").strip()

        try:
            data = json.loads(model_output)
        except json.JSONDecodeError as json_error:
            logging.error("JSON parsing error: %s", json_error)
            return False

        if not isinstance(data, dict) or "questions" not in data:
            logging.error(
                "Invalid format: 'questions' key is missing or data is not a dictionary"
            )
            return False

        questions = data["questions"]

        if not isinstance(questions, list) or not questions:
            logging.error("Invalid format: 'questions' must be a non-empty list")
            return False

        for question in questions:
            required_keys = {
                "index",
                "question",
                "options",
                "correct_answer",
                "difficulty",
                "image",
            }

            if not required_keys.issubset(question.keys()):
                missing_keys = required_keys - question.keys()
                logging.error(
                    "Invalid question format: Missing keys - %s", missing_keys
                )
                return False

            if not isinstance(question["index"], int):
                logging.error(
                    "Invalid index: Expected int, got %s", type(question["index"])
                )
                return False

            if not isinstance(question["question"], str):
                logging.error(
                    "Invalid question: Expected str, got %s", type(question["question"])
                )
                return False

            if (
                not isinstance(question["options"], list)
                or len(question["options"]) != 4
            ):
                logging.error(
                    "Invalid options: Expected list of 4, got %s", question["options"]
                )
                return False

            if question["correct_answer"] not in ["A", "B", "C", "D"]:
                logging.error(
                    "Invalid correct_answer: Expected 'A', 'B', 'C', or 'D', got %s",
                    question["correct_answer"],
                )
                return False

            if not isinstance(question["difficulty"], str):
                logging.error(
                    "Invalid difficulty: Expected str, got %s",
                    type(question["difficulty"]),
                )
                return False

            if (
                isinstance(question["image"], str)
                and question["image"].lower() == "false"
            ):
                question["image"] = False
            elif not isinstance(question["image"], (bool, str)):
                logging.error(
                    "Invalid image field: Expected str or bool, got %s",
                    type(question["image"]),
                )
                return False

        return model_output
    except Exception as error:  # pylint: disable=broad-except
        logging.exception("Unexpected validation error: %s", error)
        return False

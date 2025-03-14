"""This file contains the function to validate the model output."""

import json
import logging


def validate_model_output(model_output):
    """
    Validate the model output and return the output if valid, otherwise return False."""
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
        except json.JSONDecodeError as e:
            logging.error("JSON parsing error: %s", e)
            return False

        if not isinstance(data, dict) or "questions" not in data:
            logging.error(
                "Invalid format: 'questions' key is missing or data is not a dictionary"
            )
            return False

        questions = data["questions"]

        if not isinstance(questions, list) or len(questions) == 0:
            logging.error("Invalid format: 'questions' must be a non-empty list")
            return False

        for q in questions:
            required_keys = {
                "index",
                "question",
                "options",
                "correct_answer",
                "difficulty",
                "image",
            }

            if not required_keys.issubset(q.keys()):
                missing_keys = required_keys - q.keys()
                logging.error(
                    "Invalid question format: Missing keys - %s", missing_keys
                )
                return False

            if not isinstance(q["index"], int):
                logging.error("Invalid index: Expected int, got %s", type(q["index"]))
                return False

            if not isinstance(q["question"], str):
                logging.error(
                    "Invalid question: Expected str, got %s", type(q["question"])
                )
                return False

            if not isinstance(q["options"], list) or len(q["options"]) != 4:
                logging.error(
                    "Invalid options: Expected list of 4, got %s", q["options"]
                )
                return False

            if q["correct_answer"] not in ["A", "B", "C", "D"]:
                logging.error(
                    "Invalid correct_answer: Expected 'A', 'B', 'C', or 'D', got %s",
                    q["correct_answer"],
                )
                return False

            if not isinstance(q["difficulty"], str):
                logging.error(
                    "Invalid difficulty: Expected str, got %s", type(q["difficulty"])
                )
                return False

            if isinstance(q["image"], str) and q["image"].lower() == "false":
                q["image"] = False
            elif not isinstance(q["image"], (bool, str)):
                logging.error(
                    "Invalid image field: Expected str or bool, got %s",
                    type(q["image"]),
                )
                return False

        return model_output
    except Exception as e:
        logging.exception("Unexpected validation error: %s", e)
        return False

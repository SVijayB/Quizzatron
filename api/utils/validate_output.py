import json
import logging


def validate_model_output(model_output):
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
            logging.error(f"JSON parsing error: {e}")
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
                logging.error(f"Invalid question format: Missing keys - {missing_keys}")
                return False

            if not isinstance(q["index"], int):
                logging.error(f"Invalid index: Expected int, got {type(q['index'])}")
                return False

            if not isinstance(q["question"], str):
                logging.error(
                    f"Invalid question: Expected str, got {type(q['question'])}"
                )
                return False

            if not isinstance(q["options"], list) or len(q["options"]) != 4:
                logging.error(
                    f"Invalid options: Expected list of 4, got {q['options']}"
                )
                return False

            if q["correct_answer"] not in ["A", "B", "C", "D"]:
                logging.error(
                    f"Invalid correct_answer: Expected 'A', 'B', 'C', or 'D', got {q['correct_answer']}"
                )
                return False

            if not isinstance(q["difficulty"], str):
                logging.error(
                    f"Invalid difficulty: Expected str, got {type(q['difficulty'])}"
                )
                return False

            if isinstance(q["image"], str) and q["image"].lower() == "false":
                q["image"] = False
            elif not isinstance(q["image"], (bool, str)):
                logging.error(
                    f"Invalid image field: Expected str or bool, got {type(q['image'])}"
                )
                return False

        return model_output
    except Exception as e:
        logging.exception(f"Unexpected validation error: {e}")
        return False

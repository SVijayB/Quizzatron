import json
import logging


def validate_model_output(model_output):
    try:
        data = (
            json.loads(model_output) if isinstance(model_output, str) else model_output
        )
        if not isinstance(data, dict) or "questions" not in data:
            return False

        questions = data["questions"]
        if not isinstance(questions, list) or len(questions) == 0:
            return False

        for q in questions:
            if not all(
                key in q
                for key in [
                    "index",
                    "question",
                    "options",
                    "correct_answer",
                    "difficulty",
                    "image",
                ]
            ):
                return False

            if not isinstance(q["options"], list) or len(q["options"]) != 4:
                return False

            if q["correct_answer"] not in ["A", "B", "C", "D"]:
                return False

            if isinstance(q["image"], str) and q["image"].lower() == "false":
                q["image"] = False
            elif isinstance(q["image"], bool):
                q["image"] = False

        return True
    except Exception as e:
        logging.error(f"Validation error: {e}")
        return False

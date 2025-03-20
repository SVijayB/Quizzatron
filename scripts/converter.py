"""Module for converting quiz files to JSON format."""

import os
import string
import json
import re
import html
from typing import List, Dict

ALPHABET = list(string.ascii_uppercase)


def contains_unicode_nonsense(text: str) -> bool:
    """Check if a string contains unwanted encoded characters or HTML entities."""
    decoded_text = html.unescape(text)  # Decode HTML entities like &quot;
    return text != decoded_text or bool(re.search(r"\\u[0-9a-fA-F]{4}", text))


def process_question(lines: List[str], file_basename: str) -> Dict:
    """Process a single question from the given lines."""
    question = {"category": file_basename, "options": []}
    for line in lines:
        line = line.strip()
        if line.startswith("#Q "):
            question["question"] = html.unescape(line[3:])
        elif line[0] in ALPHABET:
            question["options"].append(html.unescape(line[2:]))
        elif line.startswith("^ "):
            question["correct_answer"] = html.unescape(line[2:])
    return question if len(question["options"]) == 4 else None


def convert_quiz_files_to_json(input_directory: str) -> List[str]:
    """
    Convert all quiz files in the specified directory to JSON format.

    Args:
        input_directory (str): Path to the directory containing quiz files

    Returns:
        list: List of output JSON files created
    """
    if not os.path.isdir(input_directory):
        print(f"Error: The directory '{input_directory}' does not exist.")
        return []

    output_directory = os.path.join(os.path.dirname(input_directory), "json_files")
    os.makedirs(output_directory, exist_ok=True)
    print(f"Output directory: {output_directory}")

    output_files = []
    files = [f for f in os.listdir(input_directory) if os.path.isfile(os.path.join(input_directory, f))]

    for file in files:
        file_path = os.path.join(input_directory, file)
        print(f"Processing file: {file_path}")

        try:
            with open(file_path, "r", encoding="ISO-8859-1") as f:
                content = f.read()

            questions = []
            question_blocks = content.split("\n\n")
            for index, block in enumerate(question_blocks, start=1):
                question = process_question(block.split("\n"), os.path.basename(file))
                if question:
                    question["index"] = index
                    questions.append(question)
                else:
                    print(f"Skipping question {index} due to insufficient options.")

            output_file = os.path.join(output_directory, f"{file}.json")
            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(questions, f, indent=4)

            print(f"Successfully converted {file_path} to {output_file}")
            output_files.append(output_file)

        except IOError as e:
            print(f"Error reading or writing file {file_path}: {str(e)}")
        except json.JSONDecodeError as e:
            print(f"Error encoding JSON for file {file_path}: {str(e)}")
        except Exception as e:
            print(f"Unexpected error processing file {file_path}: {str(e)}")

    return output_files


if __name__ == "__main__":
    user_directory = input("Enter the directory path containing quiz files: ").strip()
    converted_files = convert_quiz_files_to_json(user_directory)

    if converted_files:
        print(f"All files processed. Created {len(converted_files)} JSON files.")
    else:
        print("No files were processed.")

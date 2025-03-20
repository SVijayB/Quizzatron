import os
import string
import json
import re
import html

ALPHABET = list(string.ascii_uppercase)


def contains_unicode_nonsense(text):
    """Check if a string contains unwanted encoded characters or HTML entities."""
    decoded_text = html.unescape(text)  # Decode HTML entities like &quot;
    return text != decoded_text or bool(re.search(r"\\u[0-9a-fA-F]{4}", text))


def convert_quiz_files_to_json(directory):
    """
    Convert all quiz files in the specified directory to JSON format.

    Args:
        directory (str): Path to the directory containing quiz files

    Returns:
        list: List of output JSON files created
    """
    # Check if directory exists
    if not os.path.isdir(directory):
        print(f"Error: The directory '{directory}' does not exist.")
        return []

    # Create the output directory if it doesn't exist
    output_directory = os.path.join(os.path.dirname(directory), "json_files")
    if not os.path.exists(output_directory):
        os.makedirs(output_directory)
        print(f"Created output directory: {output_directory}")

    output_files = []

    # Get all files in the directory
    files = [
        os.path.join(directory, f)
        for f in os.listdir(directory)
        if os.path.isfile(os.path.join(directory, f))
    ]

    for file in files:
        print(f"Processing file: {file}")

        try:
            with open(file, "r", encoding="ISO-8859-1") as f:
                lines = f.readlines()

            questions = []
            question = {}
            question_index = 1

            for line in lines:
                if line.startswith("#Q "):
                    question_text = line[3:].strip()
                    if contains_unicode_nonsense(question_text):
                        question = {}  # Reset question if it's invalid
                        continue
                    question["question"] = html.unescape(question_text)
                    question["category"] = os.path.basename(file)
                    question["index"] = question_index
                elif line[0] in ALPHABET:
                    option_text = line[2:].strip()
                    if contains_unicode_nonsense(option_text):
                        question = {}  # Reset question if it's invalid
                        continue
                    if not question.get("options"):
                        question["options"] = []
                    question["options"].append(html.unescape(option_text))
                elif line.startswith("^ "):
                    correct_answer = line[2:].strip()
                    if contains_unicode_nonsense(correct_answer):
                        question = {}  # Reset question if it's invalid
                        continue
                    question["correct_answer"] = html.unescape(correct_answer)
                elif line.strip() == "" and question:
                    if len(question.get("options", [])) == 4:
                        questions.append(question)
                        question_index += 1
                    else:
                        print(
                            f"Skipping question {question_index} due to insufficient options."
                        )
                    question = {}

            # Add the last question if it exists and has 4 options
            if question and len(question.get("options", [])) == 4:
                questions.append(question)

            # Create output filename in the json_files directory
            base_filename = os.path.basename(file)
            output_file = os.path.join(output_directory, f"{base_filename}.json")

            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(questions, f, indent=4)

            print(f"Successfully converted {file} to {output_file}")
            output_files.append(output_file)

        except Exception as e:
            print(f"Error processing file {file}: {str(e)}")

    return output_files


if __name__ == "__main__":
    # Ask for directory input
    directory = input("Enter the directory path containing quiz files: ").strip()

    # Convert files
    output_files = convert_quiz_files_to_json(directory)

    # Print summary
    if output_files:
        print(f"All files processed. Created {len(output_files)} JSON files.")
    else:
        print("No files were processed.")

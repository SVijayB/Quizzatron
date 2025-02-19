import ollama
import google.generativeai as genai
import re
import os
from dotenv import load_dotenv

load_dotenv()

# Set up Google Gemini API key
api_key = os.getenv("GOOGLE_API_KEY")
GOOGLE_API_KEY = api_key
genai.configure(api_key=GOOGLE_API_KEY)


# Function to generate quiz questions
def generate_questions(topic, num_questions, difficulty, model, image=False):
    with open("assets/prompt.txt", "r") as file:
        prompt = file.read().format(
            topic=topic, num_questions=num_questions, difficulty=difficulty, image=image
        )

    if model == "deepseek":
        response = ollama.chat(
            model="deepseek-r1", messages=[{"role": "user", "content": prompt}]
        )
        return response["message"]["content"]
    elif model == "gemini":
        gemini_model = genai.GenerativeModel("gemini-pro")
        response = gemini_model.generate_content(prompt)
        return response.text.strip()
    else:
        raise ValueError("Invalid model choice. Use 'deepseek' or 'gemini'.")


def parse_questions(response_text, model, difficulty):
    if model == "deepseek":
        match = re.search(r"</think>\s*\n*(.*)", response_text, re.DOTALL)
        if not match:
            return []
        quiz_text = match.group(1).strip()
    else:
        quiz_text = response_text.strip()

    questions = []
    lines = quiz_text.split("\n")

    current_question = None
    options = []
    correct_answer = None
    image_based = False
    index = 1

    for line in lines:
        line = line.strip()
        if re.match(r"^\d+\.\s", line):  # Detects questions
            if current_question:
                questions.append(
                    {
                        "index": index,
                        "question": current_question,  # Store previous question
                        "options": options,
                        "correct_answer": correct_answer,
                        "difficulty": difficulty,
                        "image": image_based,
                    }
                )
                index += 1
            current_question = re.sub(r"^\d+\.\s*", "", line)  # Remove number
            options = []
            correct_answer = None
            image_based = False
        elif re.match(r"^[A-D]\) ", line):  # Detects options
            options.append(line)
        elif re.match(r"^\*?Answer:\s*[A-D]\*?", line):  # Detects correct answer
            match = re.search(r"Answer:\s*([A-D])$", line)
            if match:
                correct_answer = match.group(1)
        elif re.match(
            r"^\s*Image:\s*(True|False)", line, re.IGNORECASE
        ):  # Detects image field
            image_based = line.split(":")[-1].strip().lower() == "true"

    # Ensure the last question is added
    if current_question:
        questions.append(
            {
                "index": index,
                "question": current_question,
                "options": options,
                "correct_answer": correct_answer,
                "difficulty": difficulty,
                "image": image_based,
            }
        )

    return questions

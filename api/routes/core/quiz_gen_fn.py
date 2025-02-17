import google.generativeai as genai
from dotenv import load_dotenv
import ollama
import re
import os

load_dotenv()

# Set up Google Gemini API key
api_key = os.getenv("GOOGLE_API_KEY")
GOOGLE_API_KEY = api_key
genai.configure(api_key=GOOGLE_API_KEY)


# Function to generate quiz questions
def generate_questions(topic, num_questions=10, difficulty="medium", model="gemini"):
    prompt = f"""
    Generate {num_questions} multiple-choice quiz questions on the topic: {topic}.
    Difficulty level: {difficulty}.
    Each question should have 4 answer choices labeled A, B, C, and D. 
    **DO NOT ADD BOLD OR ANY STYLING**
    Only use english characters
    Indicate the correct answer clearly. Make sure the correct answer is not always 'A'.

    Occasionally, include **logo-based questions** when relevant.
    A logo-based question should follow this format:

    Example:
    3. What car brand does this logo represent?
       A) Honda
       B) Toyota
       C) Suzuki
       D) Tesla
       Answer: B
       Logo: True

    If it's **not** a logo-based question, include: `Logo: False`.

    Example Format for a normal question:
    1. What is the capital of France?
       A) Berlin
       B) Madrid
       C) Paris
       D) Rome
       Answer: C
       Logo: False
    """

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
        return {"error": "Invalid model choice. Use 'deepseek' or 'gemini'."}


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
    logo_based = False
    index = 1

    for line in lines:
        line = line.strip()
        if re.match(r"^\d+\.\s", line):  # Detects questions
            if current_question:
                question = {
                    "index": index,
                    "question": current_question,  # Store previous question
                    "options": options,
                    "correct_answer": correct_answer,
                    "difficulty": difficulty,
                    "logo": logo_based,
                }
                questions.append(question)
                index += 1
            current_question = re.sub(r"^\d+\.\s*", "", line)  # Remove number
            options = []
            correct_answer = None
            logo_based = False
        elif re.match(r"^[A-D]\) ", line):  # Detects options
            options.append(line)
        elif re.match(r"^\*?Answer:\s*[A-D]\*?", line):  # Detects correct answer
            match = re.search(r"Answer:\s*([A-D])$", line)
            if match:
                correct_answer = match.group(1)
        elif re.match(
            r"^\s*Logo:\s*(True|False)", line, re.IGNORECASE
        ):  # Detects logo field
            logo_based = line.split(":")[-1].strip().lower() == "true"

    # Ensure the last question is added
    if current_question:
        questions.append(
            {
                "index": index,
                "question": current_question,
                "options": options,
                "correct_answer": correct_answer,
                "difficulty": difficulty,
                "logo": logo_based,
            }
        )

    return questions

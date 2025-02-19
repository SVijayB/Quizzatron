import ollama
import google.generativeai as genai
import re
import os
from dotenv import load_dotenv
import json

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


def parse_questions(response_text):
    try:
        response_json = json.loads(response_text)

        if "questions" in response_json:
            return response_json["questions"]
        else:
            raise ValueError("Invalid JSON format: Missing 'questions' key.")
    except json.JSONDecodeError:
        print("Parsing JSON failed. Returning raw text.")
        return response_text

"""Module for generating and parsing quiz questions using AI models."""

import json
import os
import re
from google import genai
from dotenv import load_dotenv
import pypdf
import ollama

# Load API key from .env file
load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

if GOOGLE_API_KEY:
    client = genai.Client(api_key=GOOGLE_API_KEY)
else:
    print("⚠️ WARNING: GOOGLE_API_KEY not found. Gemini API calls will fail.")

def extract_text_from_pdf(pdf_path):
    """Extract text from a PDF file."""
    try:
        with open(pdf_path, "rb") as file:
            reader = pypdf.PdfReader(file)
            text = "\n".join([page.extract_text() for page in reader.pages if page.extract_text()])
        return text if text else ""
    except Exception as error:  # pylint: disable=broad-except
        print(f"⚠️ Error extracting text from PDF: {error}")
        return ""

def generate_questions(topic, num_questions=5, difficulty="medium", model="gemini", image=False):
    """Generate quiz questions using DeepSeek or Gemini models."""
    try:
        with open("assets/prompt.txt", "r", encoding="utf-8") as file:
            prompt = file.read().format(
                topic=topic,
                num_questions=num_questions,
                difficulty=difficulty,
                image=image
            )
    except FileNotFoundError:
        print("⚠️ Error: prompt.txt not found in assets folder.")
        return ""

    if model == "deepseek":
        try:
            response = ollama.chat(
                model="deepseek-r1", messages=[{"role": "user", "content": prompt}]
            )
            return response.get("message", {}).get("content", "")
        except Exception as error:  # pylint: disable=broad-except
            print(f"⚠️ DeepSeek API error: {error}")
            return ""

    if model == "gemini":
        try:
            response = client.models.generate_content(
                model="gemini-2.0-flash-lite", contents=prompt)
            return response.text.strip() if response else ""
        except Exception as error:  # pylint: disable=broad-except
            print(f"⚠️ Gemini API error: {error}")
            return ""

    print("⚠️ Invalid model choice. Use 'deepseek' or 'gemini'.")
    return ""

def parse_questions(response_text):
    """Parse the API response to extract questions."""
    if not response_text:
        return []

    # Remove markdown-style JSON formatting (``````)
    response_text = re.sub(r"^``````$", "", response_text.strip()).strip("`")

    try:
        response_json = json.loads(response_text)
        return response_json.get("questions", [])
    except json.JSONDecodeError:
        print("⚠️ Parsing JSON failed. Returning empty question list.")
        return []

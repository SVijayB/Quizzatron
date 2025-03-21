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

CLIENT = None  # Initialize client to avoid 'possibly-used-before-assignment' error
if GOOGLE_API_KEY:
    try:
        CLIENT = genai.Client(api_key=GOOGLE_API_KEY)
    except Exception as error:  # pylint: disable=broad-except
        print(f"⚠️ Gemini API client initialization failed: {error}")


def extract_text_from_pdf(pdf_path):
    """Extract text from a PDF file."""
    try:
        with open(pdf_path, "rb") as file:
            reader = pypdf.PdfReader(file)
            text = "\n".join(
                [page.extract_text() for page in reader.pages if page.extract_text()]
            )
        return text if text else ""
    except Exception as another_error:  # pylint: disable=broad-except
        print(f"⚠️ Error extracting text from PDF: {another_error}")
        return ""

# pylint: disable=too-many-return-statements
def generate_questions(
    topic, num_questions=5, difficulty="medium", model="gemini", image=False
):
    """Generate quiz questions using DeepSeek or Gemini models."""
    try:
        with open("assets/prompt.txt", "r", encoding="utf-8") as file:
            prompt = file.read().format(
                topic=topic,
                num_questions=num_questions,
                difficulty=difficulty,
                image=image,
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
        except Exception as ollama_error:  # pylint: disable=broad-except
            print(f"⚠️ DeepSeek API error: {ollama_error}")
            return ""

    if model == "gemini":
        if CLIENT is None:
            print("⚠️ Gemini API client not initialized. Cannot generate questions.")
            return ""

        try:
            response = CLIENT.models.generate_content(
                model="gemini-2.0-flash-lite", contents=prompt
            )
            return response.text.strip() if response else ""
        except Exception as gemini_error:  # pylint: disable=broad-except
            print(f"⚠️ Gemini API error: {gemini_error}")
            return ""

    print("⚠️ Invalid model choice. Use 'deepseek' or 'gemini'.")
    return ""


def parse_questions(response_text):
    """Parse the API response to extract questions."""
    if not response_text:
        return []

    # Remove markdown-style JSON formatting (```json ... ```)
    response_text = re.sub(r"^```json|\n```$", "", response_text.strip()).strip("`")

    try:
        response_json = json.loads(response_text)
        return response_json.get("questions", [])
    except json.JSONDecodeError:
        print("⚠️ Parsing JSON failed. Returning empty question list.")
        return []

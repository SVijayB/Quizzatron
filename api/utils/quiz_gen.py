"""This module contains functions for generating quiz questions from a given topic."""

import json
import os
import logging
import pypdf
import ollama
from google import genai
from dotenv import load_dotenv
from api.utils.extract_img import cleanup_temp_folder, download_images


load_dotenv()


GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
client = genai.Client(api_key=GOOGLE_API_KEY)


def extract_text_from_pdf(pdf_path):
    """Extract text from a PDF file."""
    with open(pdf_path, "rb") as file:
        reader = pypdf.PdfReader(file)
        text = "\n".join(
            [page.extract_text() for page in reader.pages if page.extract_text()]
        )
    return text if text else None


def generate_questions(topic, num_questions, difficulty, model, image, pdf):
    """Generate quiz questions based on the provided parameters."""
    if pdf:
        pdf_text = extract_text_from_pdf(pdf)
        if pdf_text:
            topic = pdf_text
        else:
            logging.error("Failed to extract text from the provided PDF.")
            return {"error": "Failed to extract text from the provided PDF."}

    with open("assets/prompt.txt", "r", encoding="utf-8") as file:
        prompt = file.read().format(
            topic=topic, num_questions=num_questions, difficulty=difficulty, image=image
        )

    if model == "deepseek":
        response = ollama.chat(
            model="deepseek-r1", messages=[{"role": "user", "content": prompt}]
        )
        return response["message"]["content"]

    response = client.models.generate_content(
        model="gemini-2.0-flash-lite", contents=prompt
    )
    return response.text.strip()


def parse_questions(response_text):
    """Parse the response text and download images if available."""
    try:
        response_json = json.loads(response_text)
        cleanup_temp_folder()
        for question in response_json["questions"]:
            if isinstance(question["image"], str) and question["image"]:
                image_path = download_images(question["image"])
                question["image"] = image_path
            else:
                question["image"] = "False"
        logging.info("✅ Quiz generation completed successfully.")
        return response_json["questions"]
    except json.JSONDecodeError:
        logging.error("Failed to parse JSON response.")
        logging.error("Response text: %s", response_text)
        logging.error("Returning raw text.")
        return response_text

from api.utils.extract_img import cleanup_temp_folder, download_images
import google.generativeai as genai
from dotenv import load_dotenv
import logging
import pypdf
import ollama
import json
import os


load_dotenv()


api_key = os.getenv("GOOGLE_API_KEY")
GOOGLE_API_KEY = api_key
genai.configure(api_key=GOOGLE_API_KEY)


def extract_text_from_pdf(pdf_path):
    with open(pdf_path, "rb") as file:
        reader = pypdf.PdfReader(file)
        text = "\n".join(
            [page.extract_text() for page in reader.pages if page.extract_text()]
        )
    return text if text else None


def generate_questions(topic, num_questions, difficulty, model, image, pdf):
    if pdf:
        pdf_text = extract_text_from_pdf(pdf)
        if pdf_text:
            topic = pdf_text
        else:
            logging.error("Failed to extract text from the provided PDF.")
            return {"error": "Failed to extract text from the provided PDF."}

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


def parse_questions(response_text):
    try:
        if response_text.startswith("```json"):
            response_text = response_text[6:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        response_json = json.loads(response_text)
        cleanup_temp_folder()
        for question in response_json["questions"]:
            if question["image"]:
                image_path = download_images(question["image"])
                question["image"] = image_path
        logging.info("✅ Quiz generation completed successfully.")
        return response_json["questions"]
    except json.JSONDecodeError:
        logging.error("Failed to parse JSON response.")
        logging.error(f"Response text: {response_text}")
        logging.error("Returning raw text.")
        return response_text

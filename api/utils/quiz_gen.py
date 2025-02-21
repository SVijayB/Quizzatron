from utils.extract_img import cleanup_temp_folder, download_images
import google.generativeai as genai
from dotenv import load_dotenv
import PyPDF2
import ollama
import json
import os


load_dotenv()

# Set up Google Gemini API key
api_key = os.getenv("GOOGLE_API_KEY")
GOOGLE_API_KEY = api_key
genai.configure(api_key=GOOGLE_API_KEY)


def extract_text_from_pdf(pdf_path):
    with open(pdf_path, "rb") as file:
        reader = PyPDF2.PdfReader(file)
        text = "\n".join(
            [page.extract_text() for page in reader.pages if page.extract_text()]
        )
    return text if text else None


# Function to generate quiz questions
def generate_questions(
    topic, num_questions=5, difficulty="medium", model="gemini", image=False
):
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
        return response_json["questions"]
    except json.JSONDecodeError:
        print("Parsing JSON failed. Returning raw text.")
        return response_text

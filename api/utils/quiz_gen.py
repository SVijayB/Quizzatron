"""Module for generating quiz questions using various AI models and parsing the results."""

import json
import logging
import os
from dotenv import load_dotenv
import pypdf
import litellm
from api.utils.extract_img import download_images

load_dotenv()
litellm.suppress_debug_info = True
litellm.set_verbose = False

AVAILABLE_MODELS = {
    "gemini/gemini-2.5-flash": {
        "key_env": "GOOGLE_API_KEY",
        "name": "Gemini 2.5 Flash"
    },
    "gemini/gemma-4-31b-it": {
        "key_env": "GOOGLE_API_KEY",
        "name": "Gemma 4 31B IT"
    },
    "openai/deepseek-ai/deepseek-v3.2": {
        "key_env": "NVIDIA_KEY",
        "api_base": "https://integrate.api.nvidia.com/v1",
        "name": "DeepSeek v3.2"
    },
    "mistral/mistral-large-2411": {
        "key_env": "MISTRAL_KEY",
        "name": "Mistral Large"
    }
}


def extract_text_from_pdf(pdf_path):
    """Extract text content from a PDF file."""
    with open(pdf_path, "rb") as file:
        reader = pypdf.PdfReader(file)
        text = "\n".join(
            [page.extract_text() for page in reader.pages if page.extract_text()]
        )
    return text if text else None


# pylint: disable=too-many-arguments,too-many-positional-arguments
def generate_questions(topic, num_questions, difficulty, model, image, pdf):
    """Generate quiz questions based on the given parameters."""
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

    messages = [{"role": "user", "content": prompt}]
    
    if model not in AVAILABLE_MODELS:
        logging.error("Model %s is not configured.", model)
        return None

    model_config = AVAILABLE_MODELS[model]
    
    kwargs = {
        "model": model,
        "messages": messages,
        "api_key": os.getenv(model_config.get("key_env", ""))
    }
    
    if "api_base" in model_config:
        kwargs["api_base"] = model_config["api_base"]
        
    try:
        response = litellm.completion(**kwargs)
        return response.choices[0].message.content.strip()
    except Exception as e:
        logging.error("Error executing model %s: %s", model, str(e))
        return None


def parse_questions(response_text):
    """Parse the generated questions and download images if required."""
    try:
        response_json = json.loads(response_text)
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
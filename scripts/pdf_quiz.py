import ollama
import google.generativeai as genai
import re
import os
import PyPDF2
from dotenv import load_dotenv

load_dotenv()

# Set up Google Gemini API key
api_key = os.getenv("GOOGLE_API_KEY")
GOOGLE_API_KEY = api_key
genai.configure(api_key=GOOGLE_API_KEY)


# Function to extract text from the first PDF found in the folder
def extract_text_from_pdf(pdf_path):

    with open(pdf_path, "rb") as file:
        reader = PyPDF2.PdfReader(file)
        text = "\n".join(
            [page.extract_text() for page in reader.pages if page.extract_text()]
        )

    return text if text else None


# Function to generate quiz questions
def generate_questions(topic, num_questions, difficulty, model):
    prompt = f"""
    Generate {num_questions} multiple-choice quiz questions based on this topic: {topic}
    Difficulty level: {difficulty}.
    Each question should have 4 answer choices labeled A, B, C, and D. 
    **DO NOT BOLD ANY CHARACTERS.**
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
    logo_based = False
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
                        "logo": logo_based,
                    }
                )
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


# Function to run the quiz in CLI
def run_quiz(questions):
    score = 0
    for i, q in enumerate(questions, 1):
        print(f"\nQ{i}: {q['question']}")

        # Display logo-based questions differently (can add functionality to fetch logos here)
        if q["logo"]:
            print("🖼️ (This is a logo-based question)")

        # Display answer choices
        for option in q["options"]:
            print(f"  {option}")

        user_answer = input("Enter your choice (A, B, C, or D): ").strip().upper()

        if user_answer == q["correct_answer"]:
            print("✅ Correct!")
            score += 1
        else:
            print(f"❌ Wrong! The correct answer was {q['correct_answer']}.")

    print(f"\n🎯 Quiz Complete! Your final score: {score}/{len(questions)}")


# Main function
def main():
    print("🎓 Welcome to Quizzatron!")

    while True:
        try:
            pdf_topic = (
                input(
                    "Would you like to enter a topic or a PDF for the quiz? (topic/pdf): "
                )
                .strip()
                .lower()
            )
            if pdf_topic in ["topic", "pdf"]:
                break
            else:
                print("Please enter a valid choice (topic/pdf).")
        except ValueError:
            print("Invalid input.")

    if pdf_topic == "pdf":

        pdf_path = input("Enter the path to the PDF file: ").strip()
        if not os.path.exists(pdf_path) or not pdf_path.endswith(".pdf"):
            print("⚠️ Invalid PDF file. Please provide a valid file path.")
            return
        print("\n⏳ Extracting text from the PDF... Please wait.")
        topic = extract_text_from_pdf(pdf_path)

    else:
        topic = input("Enter a topic for the quiz: ").strip()

    while True:
        try:
            num_questions = int(input("How many questions? (5, 10, 20): ").strip())
            if num_questions in [5, 10, 20]:
                break
            else:
                print("Please enter a valid choice (5, 10, or 20).")
        except ValueError:
            print("Invalid input. Please enter a number.")

    difficulty = input("Choose difficulty (easy, medium, hard): ").strip().lower()
    model = input("Choose model (deepseek, gemini): ").strip().lower()

    print("\n⏳ Generating quiz questions... Please wait.")

    response_text = generate_questions(topic, num_questions, difficulty, model)

    questions = parse_questions(response_text, model, difficulty)

    if not questions:
        print("⚠️ No valid questions generated. Try again with a different topic.")
        return

    run_quiz(questions)


if __name__ == "__main__":
    main()

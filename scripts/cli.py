"""Command-line interface for the Quizzatron quiz generator."""

import os
from quiz_gen import generate_questions, parse_questions, extract_text_from_pdf


def run_quiz(questions):
    """Run the quiz with the given questions and calculate the score."""
    score = 0
    for i, question in enumerate(questions, 1):
        print(f"\nQ{i}: {question['question']}")

        if question.get("image"):
            print("🖼️ (This is an image-based question)")

        for idx, option in enumerate(question["options"], start=1):
            print(f"  {chr(64 + idx)}) {option}")  # A, B, C, D

        user_answer = input("Enter your choice (A, B, C, or D): ").strip().upper()

        if user_answer == question["correct_answer"]:
            print("✅ Correct!")
            score += 1
        else:
            print(f"❌ Wrong! The correct answer was {question['correct_answer']}.")

    print(f"\n🎯 Quiz Complete! Your final score: {score}/{len(questions)}")


def main():
    """Main function to run the Quizzatron quiz generator."""
    print("🎓 Welcome to Quizzatron!")
    pdf_topic = input("Would you like to enter a topic or a PDF for the quiz? (topic/pdf): ").strip().lower()

    topic = ""
    if pdf_topic == "pdf":
        pdf_path = input("Enter the path to the PDF file: ").strip()
        if not os.path.exists(pdf_path) or not pdf_path.endswith(".pdf"):
            print("⚠️ Invalid PDF file. Please provide a valid file path.")
            return

        print("\n⏳ Extracting text from the PDF... Please wait.")
        topic = extract_text_from_pdf(pdf_path) or "General Knowledge"
    else:
        topic = input("Enter a topic for the quiz: ").strip()

    while True:
        try:
            num_questions = int(input("How many questions? (5, 10, 20): ").strip())
            if num_questions in [5, 10, 20]:
                break
            print("Please enter a valid choice (5, 10, or 20).")
        except ValueError:
            print("Invalid input. Please enter a number.")

    difficulty = input("Choose difficulty (easy, medium, hard): ").strip().lower()
    model = input("Choose model (deepseek, gemini): ").strip().lower()

    image_input = input("Do you want image-based questions? (true/false): ").strip().lower()
    image = image_input == "true"

    print("\n⏳ Generating quiz questions... Please wait.")

    response_text = generate_questions(topic, num_questions, difficulty, model, image)

    questions = parse_questions(response_text)

    if not questions or not isinstance(questions, list):
        print("⚠️ No valid questions generated. Try again with a different topic.")
        return

    run_quiz(questions)


if __name__ == "__main__":
    main()

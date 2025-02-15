import google.generativeai as genai
import re

from dotenv import load_dotenv
import os

load_dotenv()

# Set up Google Gemini API key
api_key = os.getenv('GOOGLE_API_KEY')
GOOGLE_API_KEY = api_key
genai.configure(api_key=GOOGLE_API_KEY)

# Function to generate quiz questions using Google Gemini API
def generate_questions(topic, num_questions):
    prompt = f"""
    Generate {num_questions} multiple-choice quiz questions on the topic: {topic}.
    Each question should have 4 answer choices labeled A, B, C, and D.
    Indicate the correct answer clearly in the format:

    **1. Question here?**
    A) Option 1
    B) Option 2
    C) Option 3
    D) Option 4
    **Answer: Correct_Option**
    """

    model = genai.GenerativeModel("gemini-pro")
    response = model.generate_content(prompt)
    return response.text.strip()

# Function to clean and parse quiz questions
def clean_quiz(text):
    # Split questions based on double newlines (each question-answer block is separated by "\n\n")
    questions = text.strip().split("\n\n")
    
    quiz_list = []
    
    for q in questions:
        # Extract question
        question_match = re.match(r"\*\*(\d+\..+?)\*\*", q)
        if question_match:
            question = question_match.group(1).strip()
        else:
            continue
        
        # Extract answer choices
        choices = re.findall(r"([A-D])\) (.+)", q)
        choices_dict = {option: text.strip() for option, text in choices}
        
        # Extract correct answer
        answer_match = re.search(r"\*\*Answer: ([A-D])\*\*", q)
        correct_answer = answer_match.group(1) if answer_match else None
        
        quiz_list.append({
            "question": question,
            "choices": choices_dict,
            "answer": correct_answer
        })
    
    return quiz_list

# Function to run the quiz in CLI
def run_quiz(questions):
    score = 0
    for i, q in enumerate(questions, 1):
        print(f"\nQ{i}: {q['question']}")
        for option, choice in q['choices'].items():
            print(f"  {option}) {choice}")

        user_answer = input("Enter your choice (A, B, C, or D): ").strip().upper()
        if user_answer == q['answer']:
            print("✅ Correct!")
            score += 1
        else:
            print(f"❌ Wrong! The correct answer was {q['answer']}.")

    print(f"\n🎯 Quiz Complete! Your final score: {score}/{len(questions)}")

# Main function
def main():
    print("🎓 Welcome to Quizzatron!")

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

    print("\n⏳ Generating quiz questions... Please wait.")
    response_text = generate_questions(topic, num_questions)
    questions = clean_quiz(response_text)

    if not questions:
        print("⚠️ No valid questions generated. Try again with a different topic.")
        return

    run_quiz(questions)

if __name__ == "__main__":
    main()

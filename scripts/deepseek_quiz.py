import ollama
import time

from dotenv import load_dotenv
import os

# Function to generate quiz questions using DeepSeek
def generate_questions(topic, num_questions):
    prompt = f"""
    Generate {num_questions} multiple-choice quiz questions on the topic: {topic}.
    Each question should have 4 answer choices labeled A, B, C, and D.
    Indicate the correct answer clearly.
    
    Example Format:
    1. What is the capital of France?
       A) Berlin
       B) Madrid
       C) Paris
       D) Rome
       Answer: C
    """

    response = ollama.chat(model="deepseek-r1", messages=[{"role": "user", "content": prompt}])
    return response['message']['content']

# Function to parse questions from AI response
import re

def parse_questions(response_text):
    # Extract content after <think></think> tags
    match = re.search(r"</think>\s*\n*(.*)", response_text, re.DOTALL)
    if not match:
        return []  # No valid questions found
    
    quiz_text = match.group(1).strip()  # Extract quiz portion
    
    questions = []
    lines = quiz_text.split("\n")
    
    current_question = None
    options = []
    correct_answer = None

    for line in lines:
        line = line.strip()
        if line and re.match(r"^\d+\.", line):  # Detect question start (e.g., "1. What is ...")
            if current_question:  # Save previous question
                questions.append((current_question, options, correct_answer))
            current_question = line
            options = []
            correct_answer = None
        elif re.match(r"^[A-D]\)", line):  # Detect answer choices (A, B, C, D)
            options.append(line)
        elif re.match(r"^\*?Answer:\s*[A-D]\*?", line):  # Detect correct answer (e.g., "*Answer: C*")
            correct_answer = re.search(r"([A-D])", line).group(1)

    if current_question:  # Save last question
        questions.append((current_question, options, correct_answer))
    
    return questions


# Function to run the quiz in CLI
def run_quiz(questions):
    score = 0
    for i, (question, options, correct) in enumerate(questions, 1):
        print(f"\n{i}. {question}")
        for option in options:
            print(option)

        user_answer = input("Enter your choice (A, B, C, or D): ").strip().upper()
        if user_answer == correct:
            print("✅ Correct!")
            score += 1
        else:
            print(f"❌ Wrong! The correct answer was {correct}.")

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
    start = time.time()
    response = generate_questions(topic, num_questions)
    end = time.time()
    print(f"Time taken to generate quiz: {(end-start):.3f} seconds")
    questions = parse_questions(response)

    if not questions:
        print("⚠️ No valid questions generated. Try again with a different topic.")
        return

    run_quiz(questions)

if __name__ == "__main__":
    main()

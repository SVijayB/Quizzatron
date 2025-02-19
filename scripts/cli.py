from quiz_gen import generate_questions, parse_questions


def run_quiz(questions):
    score = 0
    for i, q in enumerate(questions, 1):
        print(f"\nQ{i}: {q['question']}")

        # Display image-based questions differently (can add functionality to fetch images here)
        if q["image"]:
            print("🖼️ (This is a image-based question)")

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
    image = input("Generate image-based questions? (True/False): ").strip().lower()

    print("\n⏳ Generating quiz questions... Please wait.")

    response_text = generate_questions(topic, num_questions, difficulty, model, image)
    questions = parse_questions(response_text)

    if not questions:
        print("⚠️ No valid questions generated. Try again with a different topic.")
        return

    run_quiz(questions)

    print("\n👋 Thanks for trying Quizzatron!")


if __name__ == "__main__":
    main()

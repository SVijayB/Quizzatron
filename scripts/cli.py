"""Play a Quizzatron quiz in the terminal.

Rewritten to call :mod:`api.services.quiz_service` directly. It previously
imported ``scripts/quiz_gen.py`` -- a divergent copy of the backend generator
that had drifted from ``api/utils/quiz_gen.py`` in several behaviours. There is
one implementation now.

Usage::

    python -m scripts.cli --topic "Ancient Rome" --questions 5 --difficulty hard
    python -m scripts.cli --pdf notes.pdf
    python -m scripts.cli --category "Science: Computers"
    python -m scripts.cli --list-models

With no API key set, the offline placeholder model is used automatically.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from dotenv import load_dotenv

_LETTERS = ("A", "B", "C", "D")


def _build_parser() -> argparse.ArgumentParser:
    """Define the command-line interface."""
    parser = argparse.ArgumentParser(prog="quizzatron", description=__doc__)
    source = parser.add_mutually_exclusive_group()
    source.add_argument("--topic", help="Subject to generate questions about.")
    source.add_argument("--pdf", type=Path, help="Generate questions from a PDF.")
    source.add_argument("--category", help="Use pre-written questions from a category.")
    parser.add_argument("-n", "--questions", type=int, default=5, help="How many questions.")
    parser.add_argument(
        "-d",
        "--difficulty",
        default="medium",
        choices=("easy", "medium", "hard"),
        help="Difficulty level.",
    )
    parser.add_argument("-m", "--model", help="Model key (see --list-models).")
    parser.add_argument("--images", action="store_true", help="Include visual questions.")
    parser.add_argument("--list-models", action="store_true", help="Show available models.")
    parser.add_argument(
        "--list-categories", action="store_true", help="Show available categories."
    )
    return parser


def _print_models() -> int:
    """List the models that are usable right now."""
    from api.llm.registry import all_models

    for spec in all_models():
        mark = "ok " if spec.is_available() else "-- "
        detail = "" if spec.is_available() else f"  (needs {spec.api_key_env})"
        print(f"  [{mark}] {spec.key:<14} {spec.label}{detail}")
    return 0


def _print_categories() -> int:
    """List available question categories."""
    from api.content.trivia import get_categories

    categories = get_categories()
    if not categories:
        print("No categories available (the trivia provider may be unreachable).")
        return 1
    for category in categories:
        print(f"  {category.name}  [{category.source.value}]")
    return 0


def _build_quiz(args: argparse.Namespace):
    """Produce a quiz from whichever source the user chose."""
    from api.models.quiz import Difficulty, QuizRequest
    from api.services.quiz_service import generate_quiz, quiz_from_category

    difficulty = Difficulty.parse(args.difficulty)

    if args.category:
        return quiz_from_category(
            category=args.category, num_questions=args.questions, difficulty=difficulty
        )

    source_text = None
    topic = args.topic
    if args.pdf:
        from api.content.documents import extract_pdf_text, summarise_source

        source_text = extract_pdf_text(args.pdf.read_bytes())
        topic = topic or summarise_source(source_text)

    request = QuizRequest(
        topic=topic or "general knowledge",
        difficulty=difficulty,
        num_questions=args.questions,
        include_images=args.images,
        model=args.model,
    )
    return generate_quiz(request, source_text=source_text)


def _ask(question, number: int, total: int) -> bool:
    """Present one question and return whether the answer was correct."""
    print(f"\n[{number}/{total}] {question.question}")
    if question.image_url:
        print(f"        image: {question.image_url}")
    for index, option in enumerate(question.options):
        print(f"   {_LETTERS[index]}) {option}")

    while True:
        try:
            reply = input("   Your answer: ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            raise
        if reply.upper() in _LETTERS or reply in {"1", "2", "3", "4"}:
            break
        print(f"   Enter one of {', '.join(_LETTERS)}.")

    correct = question.is_correct(reply)
    if correct:
        print("   Correct.")
    else:
        print(f"   Wrong. The answer was {question.correct_letter}) {question.correct_option}")
    if question.explanation:
        print(f"   {question.explanation}")
    return correct


def main(argv: list[str] | None = None) -> int:
    """Entry point."""
    load_dotenv()
    args = _build_parser().parse_args(argv)

    if args.list_models:
        return _print_models()
    if args.list_categories:
        return _print_categories()
    if not (args.topic or args.pdf or args.category):
        print("Give one of --topic, --pdf or --category. See --help.", file=sys.stderr)
        return 2
    if args.pdf and not args.pdf.is_file():
        print(f"No such file: {args.pdf}", file=sys.stderr)
        return 2

    from api.content.trivia import TriviaProviderError
    from api.llm.generator import QuizGenerationError

    print("Generating quiz...")
    try:
        quiz = _build_quiz(args)
    except (QuizGenerationError, TriviaProviderError, ValueError) as exc:
        print(f"Could not build a quiz: {exc}", file=sys.stderr)
        return 1

    total = len(quiz.questions)
    print(f"\n{total} question(s) on {quiz.topic!r} ({quiz.difficulty.value})")

    score = 0
    try:
        for position, question in enumerate(quiz.questions, start=1):
            score += _ask(question, position, total)
    except (EOFError, KeyboardInterrupt):
        print("Stopped early.")
        return 130

    percent = round(100 * score / total) if total else 0
    print(f"\nFinal score: {score}/{total} ({percent}%)")
    return 0


if __name__ == "__main__":
    sys.exit(main())

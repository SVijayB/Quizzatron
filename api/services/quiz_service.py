"""Quiz assembly: generate questions, then resolve their images.

This is the seam that ``api/utils/quiz_gen.py`` lacked. There, image downloading
happened *inside* the generation loop, which coupled text generation to a web
crawler, the filesystem and Flask's request context (it read
``request.host_url``) -- so generation could not be tested, reused, or moved off
the request thread.

Here generation is pure and image resolution is a separate, concurrent step.
"""

from __future__ import annotations

import logging

from api.content.images import resolve_images
from api.content.trivia import TriviaProviderError, fetch_questions
from api.llm.generator import QuizGenerationError, generate_questions
from api.models.quiz import Difficulty, Question, QuestionSource, Quiz, QuizRequest

logger = logging.getLogger(__name__)

__all__ = [
    "QuizGenerationError",
    "TriviaProviderError",
    "generate_quiz",
    "quiz_from_category",
]


def generate_quiz(request: QuizRequest, *, source_text: str | None = None) -> Quiz:
    """Generate a quiz with an LLM and attach images where requested."""
    generated, spec = generate_questions(
        topic=request.topic or "general knowledge",
        num_questions=request.num_questions,
        difficulty=request.difficulty,
        include_images=request.include_images,
        model=request.model,
        source_text=source_text,
    )

    image_urls: list[str | None] = [None] * len(generated)
    if request.include_images:
        queries = [item.image_query for item in generated]
        if any(queries):
            image_urls = resolve_images(queries)
            resolved = sum(1 for url in image_urls if url)
            wanted = sum(1 for query in queries if query)
            if resolved < wanted:
                # Not fatal: the question still stands on its wording. v1 wrote
                # the string "False" here, which is truthy and reached the
                # browser as <img src="False">.
                logger.info("Resolved %d of %d requested images.", resolved, wanted)

    questions = [
        Question.from_generated(
            item,
            index=position,
            difficulty=request.difficulty,
            image_url=image_urls[position - 1],
        )
        for position, item in enumerate(generated, start=1)
    ]

    return Quiz(
        questions=questions,
        topic=request.topic,
        difficulty=request.difficulty,
        source=QuestionSource.LLM,
        model=spec.key,
    )


def quiz_from_category(*, category: str, num_questions: int, difficulty: Difficulty) -> Quiz:
    """Build a quiz from pre-written questions in a category."""
    questions = fetch_questions(
        category=category, num_questions=num_questions, difficulty=difficulty
    )
    source = questions[0].source if questions else QuestionSource.OPENTDB
    return Quiz(
        questions=questions,
        topic=category,
        difficulty=difficulty,
        source=source,
        model=None,
    )

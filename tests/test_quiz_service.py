"""Quiz assembly: the seam between generation and image resolution.

v1 downloaded images *inside* the generation loop, coupling text generation to a
web crawler, the filesystem, and Flask's request context (it read
``request.host_url``). Keeping the two steps separate is what makes both
testable.
"""

from __future__ import annotations

import pytest

from api.models.quiz import Difficulty, QuestionSource, QuizRequest
from api.services import quiz_service


class TestGenerateQuiz:
    """LLM-backed assembly."""

    def test_no_image_lookup_when_images_disabled(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Text-only quizzes must not touch the image provider at all."""
        called = {"n": 0}

        def spy(queries: list) -> list:
            called["n"] += 1
            return [None] * len(queries)

        monkeypatch.setattr(quiz_service, "resolve_images", spy)
        quiz = quiz_service.generate_quiz(
            QuizRequest(topic="Rome", num_questions=3, include_images=False)
        )
        assert called["n"] == 0
        assert all(question.image_url is None for question in quiz.questions)

    def test_attaches_resolved_images_in_order(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Each URL lands on the question that asked for it."""
        monkeypatch.setattr(
            quiz_service,
            "resolve_images",
            lambda queries: [f"https://img/{q}" if q else None for q in queries],
        )
        quiz = quiz_service.generate_quiz(
            QuizRequest(topic="Flags", num_questions=6, include_images=True)
        )
        assert any(question.image_url for question in quiz.questions)
        for question in quiz.questions:
            if question.image_url is not None:
                assert question.image_url.startswith("https://img/")

    def test_unresolved_images_are_null_not_false(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """v1 wrote the string ``"False"`` here, which is truthy and reached the
        browser as ``<img src="False">``."""
        monkeypatch.setattr(quiz_service, "resolve_images", lambda queries: [None] * len(queries))
        quiz = quiz_service.generate_quiz(
            QuizRequest(topic="Flags", num_questions=4, include_images=True)
        )
        for question in quiz.questions:
            assert question.image_url is None
            assert question.image_url is not False

    def test_image_failure_does_not_fail_the_quiz(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """A question still stands on its wording if the picture is missing."""

        def boom(queries: list) -> list:
            raise RuntimeError("provider exploded")

        monkeypatch.setattr(quiz_service, "resolve_images", boom)
        with pytest.raises(RuntimeError):
            # The service does not swallow this; the route layer turns it into a
            # 5xx. Documented here so the behaviour is deliberate, not accidental.
            quiz_service.generate_quiz(
                QuizRequest(topic="Flags", num_questions=2, include_images=True)
            )

    def test_metadata_is_populated(self) -> None:
        """Topic, difficulty, source, and model all round-trip."""
        quiz = quiz_service.generate_quiz(
            QuizRequest(topic="Volcanoes", num_questions=2, difficulty=Difficulty.HARD)
        )
        assert quiz.topic == "Volcanoes"
        assert quiz.difficulty is Difficulty.HARD
        assert quiz.source is QuestionSource.LLM
        assert quiz.model == "offline"
        assert len(quiz) == 2

    def test_indices_are_sequential(self) -> None:
        """Numbering starts at one and has no gaps."""
        quiz = quiz_service.generate_quiz(QuizRequest(topic="x", num_questions=5))
        assert [question.index for question in quiz.questions] == [1, 2, 3, 4, 5]

    def test_source_text_path(self) -> None:
        """Document-derived quizzes carry the derived topic."""
        quiz = quiz_service.generate_quiz(
            QuizRequest(topic="Roman History", num_questions=2),
            source_text="Rome was founded in 753 BC.",
        )
        assert quiz.topic == "Roman History"
        assert len(quiz) == 2


class TestQuizFromCategory:
    """Pre-written question assembly."""

    def test_builds_from_category(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Questions come through with the provider recorded as the source."""
        from api.models.quiz import Question

        sample = [
            Question(
                index=1,
                question="Capital of France?",
                options=["Berlin", "Madrid", "Paris", "Rome"],
                correct_index=2,
                difficulty=Difficulty.EASY,
                source=QuestionSource.OPENTDB,
            )
        ]
        monkeypatch.setattr(quiz_service, "fetch_questions", lambda **_: sample)
        quiz = quiz_service.quiz_from_category(
            category="Geography", num_questions=1, difficulty=Difficulty.EASY
        )
        assert quiz.topic == "Geography"
        assert quiz.source is QuestionSource.OPENTDB
        assert quiz.model is None

    def test_provider_error_propagates(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """The route layer maps this to a 502 with the provider's message."""

        def boom(**_: object):
            raise quiz_service.TriviaProviderError("category exhausted")

        monkeypatch.setattr(quiz_service, "fetch_questions", boom)
        with pytest.raises(quiz_service.TriviaProviderError, match="exhausted"):
            quiz_service.quiz_from_category(
                category="Geography", num_questions=1, difficulty=Difficulty.EASY
            )

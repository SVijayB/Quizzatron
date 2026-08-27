"""Domain model tests: difficulty parsing, option normalisation, grading."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from api.models.quiz import (
    Difficulty,
    GeneratedQuestion,
    Question,
    QuestionSource,
    QuizRequest,
)


class TestDifficulty:
    """v1 validated difficulty case-insensitively in one place and exactly in
    another, so ``?difficulty=Medium`` behaved inconsistently."""

    @pytest.mark.parametrize("value", ["easy", "EASY", "Easy", " easy "])
    def test_parse_is_case_insensitive(self, value: str) -> None:
        """Any casing resolves."""
        assert Difficulty.parse(value) is Difficulty.EASY

    @pytest.mark.parametrize("value", [None, "", "  ", "mixed", "any", "MIXED"])
    def test_unspecified_falls_back(self, value: object) -> None:
        """ "No preference" values use the default."""
        assert Difficulty.parse(value, default=Difficulty.HARD) is Difficulty.HARD

    def test_parse_rejects_nonsense(self) -> None:
        """A genuinely unknown label is an error, not a silent downgrade."""
        with pytest.raises(ValueError, match="unknown difficulty"):
            Difficulty.parse("spicy")

    def test_coerce_is_lenient_for_provider_data(self) -> None:
        """Third-party labels degrade instead of failing the request."""
        assert Difficulty.coerce("spicy", default=Difficulty.EASY) is Difficulty.EASY


class TestGeneratedQuestion:
    """The schema replaces v1's 113 lines of hand-rolled JSON validation."""

    def _base(self, **overrides: object) -> dict[str, object]:
        payload: dict[str, object] = {
            "question": "Which planet is known as the Red Planet?",
            "options": ["Venus", "Mars", "Jupiter", "Saturn"],
            "correct_index": 1,
        }
        payload.update(overrides)
        return payload

    def test_strips_letter_prefixes(self) -> None:
        """Models add "A) " out of habit; the schema normalises it away."""
        q = GeneratedQuestion.model_validate(
            self._base(options=["A) Venus", "B. Mars", "(C) Jupiter", "d - Saturn"])
        )
        assert q.options == ["Venus", "Mars", "Jupiter", "Saturn"]

    def test_rejects_duplicate_options(self) -> None:
        """Four identical options is not a question."""
        with pytest.raises(ValidationError, match="distinct"):
            GeneratedQuestion.model_validate(self._base(options=["a", "a", "b", "c"]))

    def test_rejects_wrong_option_count(self) -> None:
        """Exactly four options are required."""
        with pytest.raises(ValidationError):
            GeneratedQuestion.model_validate(self._base(options=["a", "b", "c"]))

    @pytest.mark.parametrize("bad", [-1, 4, 99])
    def test_rejects_out_of_range_answer(self, bad: int) -> None:
        """The answer index must point at a real option."""
        with pytest.raises(ValidationError):
            GeneratedQuestion.model_validate(self._base(correct_index=bad))

    @pytest.mark.parametrize("value", ["false", "False", "none", "null", "", "  ", False])
    def test_image_query_falsey_becomes_none(self, value: object) -> None:
        """v1 wrote the *string* "False" here, which is truthy and reached the
        browser as ``<img src="False">``."""
        q = GeneratedQuestion.model_validate(self._base(image_query=value))
        assert q.image_query is None

    def test_image_query_kept_when_real(self) -> None:
        """A genuine query survives."""
        q = GeneratedQuestion.model_validate(self._base(image_query=" flag of Japan "))
        assert q.image_query == "flag of Japan"

    def test_collapses_whitespace(self) -> None:
        """Ragged model output is tidied."""
        q = GeneratedQuestion.model_validate(self._base(question="What\n\n is   this?"))
        assert q.question == "What is this?"


class TestQuestionGrading:
    """Grading lives on the model so the *server* decides correctness. v1
    trusted a client-supplied ``is_correct`` flag."""

    @pytest.fixture
    def question(self) -> Question:
        return Question(
            index=1,
            question="Capital of France?",
            options=["Berlin", "Madrid", "Paris", "Rome"],
            correct_index=2,
            difficulty=Difficulty.EASY,
            source=QuestionSource.LLM,
        )

    def test_letter_and_option_helpers(self, question: Question) -> None:
        """Display helpers agree with the index."""
        assert question.correct_letter == "C"
        assert question.correct_option == "Paris"

    @pytest.mark.parametrize("answer", [2, "2", "C", "c", "Paris", "paris", "C) Paris"])
    def test_accepts_every_correct_form(self, question: Question, answer: object) -> None:
        """Index, letter, and option text all grade correctly."""
        assert question.is_correct(answer) is True

    @pytest.mark.parametrize(
        "answer", [0, 3, "A", "Berlin", "", None, True, False, "99", "Z", [], {}]
    )
    def test_rejects_everything_else(self, question: Question, answer: object) -> None:
        """Including the ``True`` bool trap, which ``isinstance(x, int)`` would pass."""
        assert question.is_correct(answer) is False


class TestQuizRequest:
    """Input validation for the generate endpoint."""

    def test_topic_is_required(self) -> None:
        """A quiz needs a subject."""
        with pytest.raises(ValidationError, match="topic is required"):
            QuizRequest.model_validate({"num_questions": 3})

    def test_blank_topic_is_rejected(self) -> None:
        """Whitespace is not a topic."""
        with pytest.raises(ValidationError):
            QuizRequest.model_validate({"topic": "   "})

    @pytest.mark.parametrize(
        ("value", "expected"),
        [
            ("true", True),
            ("TRUE", True),
            ("1", True),
            ("yes", True),
            ("false", False),
            ("0", False),
            ("", False),
            ("off", False),
        ],
    )
    def test_query_string_booleans(self, value: str, expected: bool) -> None:
        """Query params arrive as strings."""
        req = QuizRequest.model_validate({"topic": "x", "include_images": value})
        assert req.include_images is expected

    def test_rejects_zero_questions(self) -> None:
        """At least one question."""
        with pytest.raises(ValidationError):
            QuizRequest.model_validate({"topic": "x", "num_questions": 0})


class TestOptionPrefixStripping:
    """Prefix stripping must not corrupt legitimate answer text."""

    def _q(self, options: list[str]) -> GeneratedQuestion:
        return GeneratedQuestion.model_validate(
            {"question": "Q?", "options": options, "correct_index": 0}
        )

    def test_strips_full_ordered_enumeration(self) -> None:
        """All four prefixed and in order: strip."""
        q = self._q(["A) Venus", "B. Mars", "(C) Jupiter", "d - Saturn"])
        assert q.options == ["Venus", "Mars", "Jupiter", "Saturn"]

    def test_keeps_text_that_merely_looks_prefixed(self) -> None:
        """ "D - Day" is content, not an enumeration marker."""
        q = self._q(["D - Day", "Normandy", "Dunkirk", "Anzio"])
        assert q.options == ["D - Day", "Normandy", "Dunkirk", "Anzio"]

    def test_keeps_partial_enumeration(self) -> None:
        """Out-of-order or incomplete prefixes are left alone."""
        q = self._q(["A) Venus", "Mars", "C) Jupiter", "D) Saturn"])
        assert q.options == ["A) Venus", "Mars", "C) Jupiter", "D) Saturn"]

    def test_keeps_wrong_letter_order(self) -> None:
        """Letters must run A, B, C, D."""
        q = self._q(["B) Venus", "A) Mars", "C) Jupiter", "D) Saturn"])
        assert q.options[0] == "B) Venus"

    def test_does_not_strip_to_empty(self) -> None:
        """Stripping that would empty an option is abandoned."""
        q = self._q(["A) x", "B) y", "C) z", "D) w"])
        assert q.options == ["x", "y", "z", "w"]

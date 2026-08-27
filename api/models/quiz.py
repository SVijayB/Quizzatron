"""Quiz domain models.

Two distinct shapes live here, and keeping them separate is deliberate:

``GeneratedQuestion``/``GeneratedQuiz``
    What we ask the *model* to produce. Passed to pydantic-ai as ``output_type``,
    so the schema itself enforces the contract and the prompt no longer has to
    beg for valid JSON. It omits anything the server already knows (the question
    number, the requested difficulty) to save tokens and remove error surface.

``Question``/``Quiz``
    What the *API* serves. Every source -- the LLM, OpenTDB and MongoDB -- is
    normalised into this one shape.

The v1 contract shipped ``options`` as ``["A) India", "B) Japan", ...]`` with a
separate ``correct_answer: "B"`` letter, which forced every consumer to parse
``option.charAt(0)``. v2 stores clean option text plus an integer
``correct_index``, and normalises away any prefix the model adds anyway.
"""

from __future__ import annotations

import re
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

# Matches a leading "A) ", "B. ", "(c) ", "d - " and similar decorations that
# models add out of habit even when the schema doesn't ask for them.
_OPTION_PREFIX = re.compile(r"^\s*[(\[]?([A-Da-d])\s*[)\].:\-]\s+")

OPTION_COUNT = 4
_LETTERS = ("A", "B", "C", "D")


class Difficulty(str, Enum):
    """Quiz difficulty levels."""

    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"

    @classmethod
    def _match(cls, value: object) -> "Difficulty | None":
        """Return the matching member, or ``None`` if there isn't one."""
        if isinstance(value, cls):
            return value
        if isinstance(value, str):
            key = value.strip().lower()
            for member in cls:
                if member.value == key:
                    return member
        return None

    @staticmethod
    def _is_unspecified(value: object) -> bool:
        """Whether a value means "no preference"."""
        if value is None:
            return True
        return isinstance(value, str) and value.strip().lower() in {"", "mixed", "any"}

    @classmethod
    def parse(cls, value: object, default: "Difficulty | None" = None) -> "Difficulty":
        """Strictly parse user input, case-insensitively.

        ``None``, ``""``, ``"mixed"`` and ``"any"`` mean "no preference" and fall
        back to ``default``. Anything else unrecognised raises, so a request for
        ``difficulty=spicy`` is a 400 rather than a silent downgrade to medium.

        v1 validated with ``difficulty.lower()`` in the service but compared
        exactly in the util, so ``?difficulty=Medium`` behaved inconsistently.
        """
        if cls._is_unspecified(value):
            return default or cls.MEDIUM
        matched = cls._match(value)
        if matched is not None:
            return matched
        raise ValueError(f"unknown difficulty {value!r}; expected easy, medium or hard")

    @classmethod
    def coerce(cls, value: object, default: "Difficulty | None" = None) -> "Difficulty":
        """Leniently parse third-party data, never raising.

        Used for values that arrive from OpenTDB and MongoDB documents, where an
        unexpected label should degrade to ``default`` rather than fail the
        whole request.
        """
        matched = cls._match(value)
        if matched is not None:
            return matched
        return default or cls.MEDIUM


class QuestionSource(str, Enum):
    """Where a question came from."""

    LLM = "llm"
    OPENTDB = "opentdb"
    MONGO = "mongo"


def _normalise_options(values: list[str]) -> list[str]:
    """Strip an A/B/C/D enumeration prefix from option text.

    Only strips when *every* option carries a prefix and the letters run in
    order, which is a strong signal the model enumerated its list rather than
    that the text genuinely begins that way. Stripping option-by-option would
    corrupt legitimate answers such as ``"D - Day"``.
    """
    text = [str(value).strip() for value in values]
    matches = [_OPTION_PREFIX.match(item) for item in text]

    if len(text) == OPTION_COUNT and all(matches):
        letters = [m.group(1).upper() for m in matches if m is not None]
        if letters == list(_LETTERS):
            stripped = [_OPTION_PREFIX.sub("", item, count=1).strip() for item in text]
            if all(stripped):
                return stripped

    return text


class GeneratedQuestion(BaseModel):
    """A single question as produced by the language model."""

    model_config = ConfigDict(extra="ignore")

    question: str = Field(min_length=1, description="The question text.")
    options: list[str] = Field(
        min_length=OPTION_COUNT,
        max_length=OPTION_COUNT,
        description="Exactly four answer choices as plain text, with no 'A)' prefixes.",
    )
    correct_index: int = Field(
        ge=0,
        le=OPTION_COUNT - 1,
        description="Zero-based index into options of the correct answer.",
    )
    image_query: str | None = Field(
        default=None,
        description=(
            "For visual questions only: a short image-search phrase for the subject "
            "the question asks about, e.g. 'national flag of Japan'. Null otherwise."
        ),
    )
    explanation: str | None = Field(
        default=None,
        max_length=280,
        description="One short sentence explaining why the answer is correct.",
    )

    @field_validator("options", mode="after")
    @classmethod
    def _clean_options(cls, value: list[str]) -> list[str]:
        """Remove letter prefixes and reject blank or duplicate options."""
        cleaned = _normalise_options(value)
        if any(not option for option in cleaned):
            raise ValueError("Option text cannot be empty.")
        if len({option.casefold() for option in cleaned}) != len(cleaned):
            raise ValueError("All four options must be distinct.")
        return cleaned

    @field_validator("question", mode="after")
    @classmethod
    def _clean_question(cls, value: str) -> str:
        """Collapse whitespace in the question text."""
        collapsed = " ".join(value.split())
        if not collapsed:
            raise ValueError("Question text cannot be empty.")
        return collapsed

    @field_validator("image_query", "explanation", mode="before")
    @classmethod
    def _blank_to_none(cls, value: object) -> object:
        """Treat empty strings and model-emitted 'false'/'null' as absent.

        v1's prompt made the model write the *string* ``"False"`` into the image
        field, which is truthy and reached the browser as ``<img src="False">``.
        """
        if isinstance(value, str):
            stripped = value.strip()
            if stripped.lower() in {"", "false", "none", "null", "n/a"}:
                return None
            return stripped
        if isinstance(value, bool):
            return None
        return value


class GeneratedQuiz(BaseModel):
    """The full model response: the ``output_type`` handed to pydantic-ai."""

    model_config = ConfigDict(extra="ignore")

    questions: list[GeneratedQuestion] = Field(min_length=1)


class Question(BaseModel):
    """A question as served by the API. Normalised across all sources."""

    model_config = ConfigDict(extra="forbid")

    index: int = Field(ge=1, description="1-based position within the quiz.")
    question: str = Field(min_length=1)
    options: list[str] = Field(min_length=OPTION_COUNT, max_length=OPTION_COUNT)
    correct_index: int = Field(ge=0, le=OPTION_COUNT - 1)
    difficulty: Difficulty
    source: QuestionSource = QuestionSource.LLM
    image_url: str | None = Field(
        default=None, description="Resolved image URL, or null for a text-only question."
    )
    explanation: str | None = None

    @property
    def correct_letter(self) -> str:
        """The correct answer as an ``A``-``D`` letter, for display only."""
        return _LETTERS[self.correct_index]

    @property
    def correct_option(self) -> str:
        """The text of the correct option."""
        return self.options[self.correct_index]

    def is_correct(self, answer: object) -> bool:
        """Grade an answer given as an index, a letter, or the option text.

        Grading lives on the model so the server -- not the client -- decides
        correctness. v1 trusted a client-supplied ``is_correct`` flag.
        """
        if isinstance(answer, bool) or answer is None:
            return False
        if isinstance(answer, int):
            return answer == self.correct_index
        text = str(answer).strip()
        if not text:
            return False
        if len(text) == 1:
            if text.isdigit():
                return int(text) == self.correct_index
            if text.upper() in _LETTERS:
                return text.upper() == self.correct_letter
        stripped = _OPTION_PREFIX.sub("", text).strip()
        return stripped.casefold() == self.correct_option.casefold()

    @classmethod
    def from_generated(
        cls,
        generated: GeneratedQuestion,
        *,
        index: int,
        difficulty: Difficulty,
        image_url: str | None = None,
    ) -> "Question":
        """Promote a model-generated question into the served shape."""
        return cls(
            index=index,
            question=generated.question,
            options=generated.options,
            correct_index=generated.correct_index,
            difficulty=difficulty,
            source=QuestionSource.LLM,
            image_url=image_url,
            explanation=generated.explanation,
        )


class Quiz(BaseModel):
    """A complete quiz. This is the top-level API response body."""

    model_config = ConfigDict(extra="forbid")

    questions: list[Question]
    topic: str | None = None
    difficulty: Difficulty = Difficulty.MEDIUM
    source: QuestionSource = QuestionSource.LLM
    model: str | None = None

    def __len__(self) -> int:
        """Number of questions in the quiz."""
        return len(self.questions)


class QuizRequest(BaseModel):
    """Validated parameters for a quiz-generation request."""

    model_config = ConfigDict(extra="ignore")

    topic: str | None = None
    difficulty: Difficulty = Difficulty.MEDIUM
    num_questions: int = Field(default=5, ge=1)
    include_images: bool = False
    model: str | None = None

    @field_validator("difficulty", mode="before")
    @classmethod
    def _parse_difficulty(cls, value: object) -> object:
        """Accept any casing plus 'mixed'/'any'; reject anything else."""
        return Difficulty.parse(value, default=Difficulty.MEDIUM)

    @field_validator("include_images", mode="before")
    @classmethod
    def _coerce_bool(cls, value: object) -> object:
        """Accept query-string booleans such as ``"true"``/``"1"``."""
        if isinstance(value, str):
            return value.strip().lower() in {"1", "true", "yes", "on"}
        return value

    @field_validator("topic", mode="before")
    @classmethod
    def _clean_topic(cls, value: object) -> object:
        """Trim the topic and treat blank input as absent."""
        if isinstance(value, str):
            return value.strip() or None
        return value

    @model_validator(mode="after")
    def _require_topic(self) -> "QuizRequest":
        """A quiz needs something to be about."""
        if not self.topic:
            raise ValueError("A topic is required.")
        return self

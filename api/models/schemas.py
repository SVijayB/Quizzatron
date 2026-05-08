"""Pydantic models for quiz generation request/response validation."""

from enum import Enum
from typing import Union

from pydantic import BaseModel, Field, field_validator


class Difficulty(str, Enum):
    """Allowed difficulty levels for quiz questions."""

    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class CorrectAnswer(str, Enum):
    """Valid answer choices for a quiz question."""

    A = "A"
    B = "B"
    C = "C"
    D = "D"


class QuizQuestion(BaseModel):
    """Schema for a single quiz question returned by the LLM."""

    index: int = Field(ge=1)
    question: str = Field(min_length=1)
    options: list[str] = Field(min_length=4, max_length=4)
    correct_answer: CorrectAnswer
    difficulty: Difficulty
    image: Union[str, bool] = False

    @field_validator("image", mode="before")
    @classmethod
    def coerce_image(cls, v):
        """Handle the LLM returning 'false'/'False' as a string instead of a boolean."""
        if isinstance(v, str) and v.lower() == "false":
            return False
        return v


class QuizResponse(BaseModel):
    """Schema for the full LLM response containing a list of quiz questions."""

    questions: list[QuizQuestion] = Field(min_length=1)


class QuizRequest(BaseModel):
    """Validates incoming API request parameters for quiz generation."""

    topic: Union[str, None] = None
    pdf: Union[str, None] = None
    model: str = "gemini/gemini-2.5-flash"
    difficulty: Difficulty = Difficulty.MEDIUM
    num_questions: int = Field(default=5, ge=1)
    image: bool = False

    @field_validator("image", mode="before")
    @classmethod
    def coerce_image_param(cls, v):
        """Handle image param arriving as a string from query params."""
        if isinstance(v, str):
            return v.lower() == "true"
        return v

    @field_validator("pdf")
    @classmethod
    def validate_pdf_extension(cls, v):
        """Ensure the PDF path ends with .pdf if provided."""
        if v is not None and not v.lower().endswith(".pdf"):
            raise ValueError("Invalid file format. Must be a .pdf file.")
        return v

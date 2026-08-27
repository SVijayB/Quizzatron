"""Quiz generation via pydantic-ai.

This module replaces ``api/utils/quiz_gen.py`` + ``api/utils/validate_output.py``
(113 lines of hand-rolled JSON repair). The schema does the validating now:

* ``output_type=GeneratedQuiz`` constrains the model structurally, so there is
  nothing to strip, no ```` ```json ```` fences, and no
  ``.replace("\\n", "")`` mangling of legitimate string content.
* Validation failures are re-prompted by pydantic-ai with the actual error, so a
  retry is informed. v1 re-sent the byte-identical prompt three times with
  default temperature and no error feedback -- three identical failures were the
  normal outcome.
* Timeout, temperature and token ceiling are set explicitly. v1 used provider
  defaults for all three and had no timeout at all.
"""

from __future__ import annotations

import logging

from pydantic_ai import Agent
from pydantic_ai.exceptions import UnexpectedModelBehavior, UsageLimitExceeded
from pydantic_ai.settings import ModelSettings

from api.core.aio import run_async
from api.core.config import get_settings
from api.llm.prompts import build_instructions, build_user_prompt
from api.llm.registry import ModelSpec, ModelUnavailableError, build_model, resolve_model
from api.models.quiz import Difficulty, GeneratedQuestion, GeneratedQuiz

logger = logging.getLogger(__name__)


class QuizGenerationError(RuntimeError):
    """Raised when a quiz could not be generated."""

    def __init__(self, message: str, *, retryable: bool = False) -> None:
        """Record whether the caller could reasonably retry."""
        super().__init__(message)
        self.retryable = retryable


def _build_agent(spec: ModelSpec, instructions: str) -> Agent[None, GeneratedQuiz]:
    """Construct the generation agent for one request."""
    settings = get_settings()
    return Agent(
        build_model(spec),
        output_type=GeneratedQuiz,
        instructions=instructions,
        # Output retries re-prompt the model with the validation error attached.
        retries={"output": settings.llm_output_retries},
        model_settings=ModelSettings(
            temperature=0.85,
            max_tokens=8000,
            timeout=settings.llm_timeout_s,
        ),
    )


def _dedupe(questions: list[GeneratedQuestion]) -> list[GeneratedQuestion]:
    """Drop questions that repeat an earlier question's text."""
    seen: set[str] = set()
    unique: list[GeneratedQuestion] = []
    for question in questions:
        fingerprint = " ".join(question.question.casefold().split())
        if fingerprint in seen:
            continue
        seen.add(fingerprint)
        unique.append(question)
    return unique


def generate_questions(
    *,
    topic: str,
    num_questions: int,
    difficulty: Difficulty,
    include_images: bool = False,
    model: str | None = None,
    source_text: str | None = None,
) -> tuple[list[GeneratedQuestion], ModelSpec]:
    """Generate raw questions for a topic.

    Returns the questions together with the model spec that produced them.
    Image queries are *not* resolved here -- that is the content layer's job, so
    that this stays a pure text-generation step with no filesystem or crawler
    dependency.
    """
    settings = get_settings()
    capped = max(1, min(int(num_questions), settings.max_questions))

    try:
        spec = resolve_model(model)
    except ModelUnavailableError as exc:
        raise QuizGenerationError(str(exc)) from exc

    instructions = build_instructions(difficulty, include_images)
    prompt = build_user_prompt(topic, capped, source_text=source_text)
    agent = _build_agent(spec, instructions)

    logger.info(
        "Generating %d %s question(s) on %r via %s (%s)",
        capped,
        difficulty.value,
        topic,
        spec.key,
        spec.model_id,
    )

    try:
        # A whole-run ceiling on top of the per-request HTTP timeout: pydantic-ai
        # has no built-in run timeout, and a retry cycle can otherwise outlive
        # any reverse-proxy limit.
        result = run_async(
            agent.run(prompt),
            timeout=settings.llm_timeout_s * (settings.llm_output_retries + 1) + 15,
        )
    except TimeoutError as exc:
        raise QuizGenerationError(
            "The model took too long to respond. Try fewer questions.", retryable=True
        ) from exc
    except UnexpectedModelBehavior as exc:
        # Retries exhausted: the model kept producing output that failed schema
        # validation.
        logger.warning("Model %s failed schema validation repeatedly: %s", spec.key, exc)
        raise QuizGenerationError(
            "The model could not produce a valid quiz. Try again or pick a different model.",
            retryable=True,
        ) from exc
    except UsageLimitExceeded as exc:
        raise QuizGenerationError(f"Generation exceeded its limits: {exc}") from exc
    except ModelUnavailableError as exc:
        raise QuizGenerationError(str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - provider errors are open-ended
        logger.exception("Quiz generation failed for model %s", spec.key)
        raise QuizGenerationError(
            _describe_provider_error(exc), retryable=_is_retryable(exc)
        ) from exc

    questions = _dedupe(result.output.questions)
    if not questions:
        raise QuizGenerationError("The model returned no questions.", retryable=True)

    if len(questions) > capped:
        questions = questions[:capped]
    elif len(questions) < capped:
        # Serving a slightly shorter quiz beats failing the request outright.
        logger.info("Model returned %d of %d requested questions.", len(questions), capped)

    usage = getattr(result, "usage", None)
    if usage is not None:
        logger.info(
            "Generation usage: %s tokens in / %s out",
            getattr(usage, "input_tokens", "?"),
            getattr(usage, "output_tokens", "?"),
        )

    return questions, spec


def _is_retryable(exc: Exception) -> bool:
    """Whether a provider error is worth the caller retrying."""
    name = type(exc).__name__.lower()
    text = str(exc).lower()
    markers = ("ratelimit", "overload", "unavailable", "timeout", "503", "429", "500")
    return any(marker in name or marker in text for marker in markers)


def _describe_provider_error(exc: Exception) -> str:
    """Turn a provider exception into something a user can act on.

    v1 collapsed every failure into "An unexpected error occurred." -- including
    missing credentials and rate limits, which have obvious user-facing fixes.
    """
    name = type(exc).__name__.lower()
    text = str(exc).lower()
    if "authentication" in name or "unauthorized" in text or "api key" in text:
        return "The model provider rejected our credentials. Check the API key."
    if "ratelimit" in name or "429" in text:
        return "The model provider is rate-limiting us. Try again shortly."
    if "unavailable" in name or "503" in text or "overload" in text:
        return "The model provider is temporarily unavailable. Try again shortly."
    if "notfound" in name or "not found" in text or "does not exist" in text:
        return "That model is not available from the provider. Pick a different model."
    return "Quiz generation failed. Try again, or pick a different model."


def generate_quiz_payload(
    *,
    topic: str,
    num_questions: int,
    difficulty: Difficulty,
    include_images: bool = False,
    model: str | None = None,
    source_text: str | None = None,
) -> GeneratedQuiz:
    """Convenience wrapper returning a :class:`GeneratedQuiz`."""
    questions, _ = generate_questions(
        topic=topic,
        num_questions=num_questions,
        difficulty=difficulty,
        include_images=include_images,
        model=model,
        source_text=source_text,
    )
    return GeneratedQuiz(questions=questions)

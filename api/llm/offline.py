"""An offline model that needs no API key and no network.

This exists because the app should be fully runnable -- and the whole test suite
should pass -- with zero credentials. pydantic-ai's ``TestModel`` almost does the
job, but it emits ``['a', 'a', 'a', 'a']`` for a list-of-strings field, which our
"all four options must be distinct" rule correctly rejects.

So instead we drive a :class:`FunctionModel` that returns schema-valid,
visually plausible placeholder questions in the quantity the prompt asked for.
Selected via the ``offline`` model key.
"""

from __future__ import annotations

import hashlib
import re

from pydantic_ai.messages import ModelMessage, ModelResponse, ToolCallPart, UserPromptPart
from pydantic_ai.models.function import AgentInfo, FunctionModel

# Matches the phrasing produced by api.llm.prompts.build_user_prompt.
_COUNT_RE = re.compile(r"\bWrite\s+(\d+)\s+multiple-choice\b", re.IGNORECASE)
_TOPIC_RE = re.compile(r'on the topic:\s*"([^"]*)"')

_FILLERS: tuple[tuple[str, tuple[str, str, str, str]], ...] = (
    (
        "Which of these is most closely associated with {topic}?",
        ("Alpha", "Beta", "Gamma", "Delta"),
    ),
    ("In what decade did {topic} first gain prominence?", ("1960s", "1970s", "1980s", "1990s")),
    ("Who is most often credited in discussions of {topic}?", ("Ada", "Grace", "Alan", "Edsger")),
    ("Which term does NOT belong with {topic}?", ("Cobalt", "Basalt", "Quartz", "Marlin")),
    (
        "What is the usual first step when studying {topic}?",
        ("Observe", "Publish", "Ignore", "Sell"),
    ),
    ("Which region is most linked to {topic}?", ("Andes", "Baltic", "Sahel", "Mekong")),
)


def _extract_count(messages: list[ModelMessage], default: int = 5) -> int:
    """Recover the requested question count from the prompt text."""
    for message in reversed(messages):
        for part in getattr(message, "parts", []):
            if not isinstance(part, UserPromptPart):
                continue
            content = part.content if isinstance(part.content, str) else str(part.content)
            match = _COUNT_RE.search(content)
            if match:
                return max(1, min(int(match.group(1)), 50))
    return default


def _extract_topic(messages: list[ModelMessage], default: str = "this topic") -> str:
    """Recover the topic from the prompt text, for nicer placeholder copy."""
    for message in reversed(messages):
        for part in getattr(message, "parts", []):
            if not isinstance(part, UserPromptPart):
                continue
            content = part.content if isinstance(part.content, str) else str(part.content)
            match = _TOPIC_RE.search(content)
            if match and match.group(1).strip():
                return match.group(1).strip()
            if "SOURCE DOCUMENT" in content:
                return "the uploaded document"
    return default


def _wants_images(messages: list[ModelMessage], info: AgentInfo) -> bool:
    """Whether the instructions asked for visual questions.

    Instructions arrive on ``AgentInfo.instructions`` (and ``ModelRequest``),
    not as a message part, so check both.
    """
    texts = [info.instructions or ""]
    texts.extend(str(getattr(message, "instructions", "") or "") for message in messages)
    for text in texts:
        if "Every question in this quiz is text-only" in text:
            return False
        if "image_query" in text:
            return True
    return False


def _build_questions(topic: str, count: int, with_images: bool) -> list[dict[str, object]]:
    """Produce ``count`` distinct placeholder questions."""
    questions: list[dict[str, object]] = []
    for i in range(count):
        template, options = _FILLERS[i % len(_FILLERS)]
        # Deterministic but varied: keeps snapshots stable across runs.
        digest = hashlib.sha256(f"{topic}:{i}".encode()).digest()
        correct = digest[0] % 4
        suffix = "" if i < len(_FILLERS) else f" (part {i // len(_FILLERS) + 1})"
        questions.append(
            {
                "question": template.format(topic=topic) + suffix,
                "options": [f"{opt}{suffix}" for opt in options],
                "correct_index": correct,
                "image_query": f"{topic} illustration" if with_images and i % 3 == 0 else None,
                "explanation": "Placeholder answer from the offline model.",
            }
        )
    return questions


def _offline_function(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
    """Return a schema-valid placeholder quiz as an output tool call."""
    count = _extract_count(messages)
    topic = _extract_topic(messages)
    payload = {"questions": _build_questions(topic, count, _wants_images(messages, info))}

    if not info.output_tools:
        # No structured output requested; degrade to plain text.
        from pydantic_ai.messages import TextPart

        return ModelResponse(parts=[TextPart(content="Offline model: no output tool available.")])

    return ModelResponse(parts=[ToolCallPart(info.output_tools[0].name, payload)])


def build_offline_model() -> FunctionModel:
    """Construct the offline placeholder model."""
    return FunctionModel(_offline_function, model_name="offline-placeholder")

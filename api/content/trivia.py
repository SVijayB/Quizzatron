"""Pre-written trivia questions from OpenTDB and MongoDB.

Fixes over ``api/utils/{category_aggregator,opentdb_data,mongodb_data}.py`` and
``api/services/triviaqa_api.py``:

* **One pooled ``MongoClient``.** v1 constructed a client per request and never
  closed it (three sockets per quiz-by-category call), with no
  ``serverSelectionTimeoutMS`` -- so an unreachable database stalled the request
  for pymongo's 30-second default.
* **Categories are cached.** v1 did a fresh OpenTDB HTTP round trip *plus* a
  fresh Mongo connect on every single call, including on every question fetch.
* **Degrades instead of 500ing.** v1's aggregator ended its ``except`` with a
  bare ``raise`` and the route had no handler, so an OpenTDB outage took out the
  category list with a traceback.
* **``correct_answer`` is resolved honestly.** v1 used a nested ternary that
  fell through to ``"D"`` when the stored answer matched no option -- silently
  marking the wrong choice correct. Unresolvable questions are now skipped.
* **OpenTDB's ``response_code`` is checked.** v1 ignored it, so "not enough
  questions in this category" surfaced as a silently empty quiz.
* Fixes ``except (..., MongoClient.ServerSelectionTimeoutError)`` -- that
  attribute does not exist, so the except clause itself raised ``AttributeError``.
"""

from __future__ import annotations

import html
import logging
import random
import threading
import time
from dataclasses import dataclass
from typing import Any

import requests
from pymongo import MongoClient
from pymongo.errors import PyMongoError

from api.core.config import get_settings
from api.models.quiz import OPTION_COUNT, Difficulty, Question, QuestionSource

logger = logging.getLogger(__name__)

_OPENTDB_CATEGORIES_URL = "https://opentdb.com/api_category.php"
_OPENTDB_QUESTIONS_URL = "https://opentdb.com/api.php"

_CATEGORY_TTL_S = 600

_OPENTDB_RESPONSE_CODES = {
    0: None,
    1: "Not enough questions in that category for this request.",
    2: "That category is not valid.",
    3: "The trivia session token is unknown.",
    4: "That category is exhausted for now. Try another.",
    5: "Too many requests to the trivia provider. Try again shortly.",
}


@dataclass(frozen=True)
class Category:
    """A selectable question category."""

    name: str
    source: QuestionSource
    ref: str

    def as_dict(self) -> dict[str, str]:
        """Serialise for the categories endpoint."""
        return {"name": self.name, "source": self.source.value, "ref": self.ref}


# --------------------------------------------------------------------------
# MongoDB
# --------------------------------------------------------------------------

_mongo_lock = threading.Lock()
_mongo_client: MongoClient | None = None
_mongo_failed = False


def get_mongo_client() -> MongoClient | None:
    """Return the shared Mongo client, or ``None`` when unavailable.

    Built once and reused. Returns ``None`` (rather than raising) when no URI is
    configured or the server can't be reached, so every caller degrades.
    """
    global _mongo_client, _mongo_failed  # noqa: PLW0603 - module-level singleton

    settings = get_settings()
    if not settings.mongo_uri or _mongo_failed:
        return None

    with _mongo_lock:
        if _mongo_client is not None:
            return _mongo_client
        try:
            client: MongoClient = MongoClient(
                settings.mongo_uri,
                serverSelectionTimeoutMS=settings.mongo_timeout_ms,
                connectTimeoutMS=settings.mongo_timeout_ms,
                socketTimeoutMS=settings.mongo_timeout_ms * 2,
                appname="quizzatron",
            )
            client.admin.command("ping")
        except PyMongoError as exc:
            logger.warning("MongoDB unavailable, continuing without it: %s", exc)
            _mongo_failed = True
            return None
        _mongo_client = client
        return client


def reset_mongo_client() -> None:
    """Close and forget the shared client. Used by tests."""
    global _mongo_client, _mongo_failed  # noqa: PLW0603 - module-level singleton
    with _mongo_lock:
        if _mongo_client is not None:
            _mongo_client.close()
        _mongo_client = None
        _mongo_failed = False


def _mongo_categories() -> list[Category]:
    """Collection names in the trivia database, as categories."""
    client = get_mongo_client()
    if client is None:
        return []
    try:
        names = client[get_settings().mongo_db_name].list_collection_names()
    except PyMongoError as exc:
        logger.warning("Could not list Mongo collections: %s", exc)
        return []
    return [
        Category(name=name, source=QuestionSource.MONGO, ref=name)
        for name in sorted(names)
        if not name.startswith("system.")
    ]


def _mongo_questions(collection_name: str, count: int, difficulty: Difficulty) -> list[Question]:
    """Sample questions from a Mongo collection."""
    client = get_mongo_client()
    if client is None:
        return []

    database = client[get_settings().mongo_db_name]
    try:
        # Over-sample so questions we have to skip don't shrink the quiz.
        docs = list(
            database[collection_name].aggregate([{"$sample": {"size": max(count * 2, count + 5)}}])
        )
    except PyMongoError as exc:
        logger.warning("Mongo sample failed for %r: %s", collection_name, exc)
        return []

    questions: list[Question] = []
    for doc in docs:
        if len(questions) >= count:
            break
        built = _question_from_mongo_doc(doc, len(questions) + 1, difficulty)
        if built is not None:
            questions.append(built)
    return questions


def _question_from_mongo_doc(
    doc: dict[str, Any], index: int, difficulty: Difficulty
) -> Question | None:
    """Convert one Mongo document, or ``None`` if it can't be trusted."""
    text = str(doc.get("question") or "").strip()
    raw_options = doc.get("options")
    answer = doc.get("correct_answer")

    if not text or not isinstance(raw_options, list) or answer is None:
        return None

    options = [str(option).strip() for option in raw_options if str(option).strip()]
    if len(options) != OPTION_COUNT:
        # v1 hard-indexed options[0..3] and raised IndexError here.
        return None

    answer_text = str(answer).strip()
    folded = [option.casefold() for option in options]
    try:
        correct_index = folded.index(answer_text.casefold())
    except ValueError:
        # v1 defaulted to "D" and silently shipped a wrong answer key.
        logger.debug("Skipping Mongo question: answer %r matches no option.", answer_text)
        return None

    doc_difficulty = doc.get("difficulty")
    resolved = Difficulty.coerce(doc_difficulty, default=difficulty)

    return Question(
        index=index,
        question=html.unescape(text),
        options=[html.unescape(option) for option in options],
        correct_index=correct_index,
        difficulty=resolved,
        source=QuestionSource.MONGO,
        image_url=None,
        explanation=None,
    )


# --------------------------------------------------------------------------
# OpenTDB
# --------------------------------------------------------------------------


class TriviaProviderError(RuntimeError):
    """Raised when a trivia provider cannot satisfy a request."""


def _opentdb_categories() -> list[Category]:
    """Fetch the OpenTDB category list."""
    settings = get_settings()
    try:
        response = requests.get(_OPENTDB_CATEGORIES_URL, timeout=settings.opentdb_timeout_s)
        response.raise_for_status()
        payload = response.json()
    except (requests.RequestException, ValueError) as exc:
        logger.warning("OpenTDB categories unavailable: %s", exc)
        return []

    return [
        Category(
            name=str(item["name"]),
            source=QuestionSource.OPENTDB,
            ref=str(item["id"]),
        )
        for item in payload.get("trivia_categories", [])
        if item.get("name") and item.get("id") is not None
    ]


def _opentdb_questions(category_id: str, count: int, difficulty: Difficulty) -> list[Question]:
    """Fetch questions from OpenTDB for a category."""
    settings = get_settings()
    params = {
        "amount": str(count),
        "category": str(category_id),
        "difficulty": difficulty.value,
        "type": "multiple",
    }
    try:
        response = requests.get(
            _OPENTDB_QUESTIONS_URL, params=params, timeout=settings.opentdb_timeout_s
        )
        if response.status_code == 429:
            raise TriviaProviderError(
                "The trivia provider is rate-limiting us. Try again in a few seconds."
            )
        response.raise_for_status()
        payload = response.json()
    except (requests.RequestException, ValueError) as exc:
        logger.warning("OpenTDB question fetch failed: %s", exc)
        raise TriviaProviderError("The trivia provider is unreachable right now.") from exc

    code = payload.get("response_code")
    if code:
        message = _OPENTDB_RESPONSE_CODES.get(code, "The trivia provider returned an error.")
        raise TriviaProviderError(message)

    questions: list[Question] = []
    for item in payload.get("results", []):
        built = _question_from_opentdb(item, len(questions) + 1, difficulty)
        if built is not None:
            questions.append(built)
    return questions


def _question_from_opentdb(
    item: dict[str, Any], index: int, fallback: Difficulty
) -> Question | None:
    """Convert one OpenTDB result, shuffling the options."""
    text = item.get("question")
    correct = item.get("correct_answer")
    wrong = item.get("incorrect_answers")

    if not text or correct is None or not isinstance(wrong, list):
        return None
    if len(wrong) != OPTION_COUNT - 1:
        return None

    correct_text = html.unescape(str(correct)).strip()
    options = [correct_text] + [html.unescape(str(w)).strip() for w in wrong]
    if len({option.casefold() for option in options}) != OPTION_COUNT:
        return None

    random.shuffle(options)
    return Question(
        index=index,
        question=html.unescape(str(text)).strip(),
        options=options,
        correct_index=options.index(correct_text),
        difficulty=Difficulty.coerce(item.get("difficulty"), default=fallback),
        source=QuestionSource.OPENTDB,
        image_url=None,
        explanation=None,
    )


# --------------------------------------------------------------------------
# Public API
# --------------------------------------------------------------------------

_category_lock = threading.Lock()
_category_cache: tuple[float, list[Category]] | None = None


def get_categories(*, force_refresh: bool = False) -> list[Category]:
    """All available categories, merged and cached.

    Never raises: a provider that is down simply contributes nothing.
    """
    global _category_cache  # noqa: PLW0603 - module-level cache

    now = time.monotonic()
    with _category_lock:
        if not force_refresh and _category_cache is not None:
            cached_at, cached = _category_cache
            if now - cached_at < _CATEGORY_TTL_S:
                return list(cached)

    merged: dict[str, Category] = {}
    for category in _opentdb_categories():
        merged[category.name.casefold()] = category
    # Local collections win on a name collision, matching v1's precedence.
    for category in _mongo_categories():
        merged[category.name.casefold()] = category

    categories = sorted(merged.values(), key=lambda c: c.name.casefold())
    with _category_lock:
        _category_cache = (time.monotonic(), categories)
    return list(categories)


def clear_category_cache() -> None:
    """Drop the cached category list. Used by tests."""
    global _category_cache  # noqa: PLW0603 - module-level cache
    with _category_lock:
        _category_cache = None


def find_category(name: str) -> Category | None:
    """Look up a category by name, case-insensitively."""
    if not name:
        return None
    wanted = name.strip().casefold()
    for category in get_categories():
        if category.name.casefold() == wanted or category.ref.casefold() == wanted:
            return category
    return None


def fetch_questions(*, category: str, num_questions: int, difficulty: Difficulty) -> list[Question]:
    """Fetch pre-written questions for a category from whichever source owns it."""
    settings = get_settings()
    count = max(1, min(int(num_questions), settings.max_questions))

    found = find_category(category)
    if found is None:
        raise TriviaProviderError(f"Unknown category: {category!r}.")

    if found.source is QuestionSource.MONGO:
        questions = _mongo_questions(found.ref, count, difficulty)
    else:
        questions = _opentdb_questions(found.ref, count, difficulty)

    if not questions:
        raise TriviaProviderError(
            f"No usable questions were available for {found.name!r}. Try another category."
        )

    # Renumber so indices are contiguous after any skips.
    for position, question in enumerate(questions, start=1):
        question.index = position
    return questions

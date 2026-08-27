"""Resolve an image for a question from Wikimedia.

Why this replaces ``api/utils/extract_img.py`` wholesale
-------------------------------------------------------
The old module scraped Google Images with ``icrawler``, wrote the result into a
shared ``api/static/temp`` directory, and served it back. That design carried
five separate defects, and *all five disappear by not downloading anything*:

1. **Path traversal.** The on-disk filename was ``query.replace(" ", "_")`` --
   the query being LLM output, itself derived from user-supplied topic/PDF text.
   A query containing ``..`` escaped the temp directory, and the code then called
   ``os.remove()`` and ``os.rename()`` on that path. Prompt injection to
   arbitrary file delete/write.
2. **Race.** Every crawl wrote to the same ``000001*`` glob slot, so concurrent
   requests could swap each other's images, and a stale file from a failed crawl
   was silently served as a fresh result.
3. **Unbounded disk leak.** ``cleanup_temp_folder()`` had zero production
   callers, so the directory grew for the lifetime of the process.
4. **Licensing.** The crawl originally filtered on
   ``license="noncommercial"``; that filter was later dropped, leaving the app
   re-hosting arbitrarily licensed images.
5. **Latency.** N image questions meant N sequential scrapes with no timeout,
   inside the request.

Linking to Wikimedia instead means: no filesystem writes at all, a real
documented API rather than scraping, freely-licensed media, and canonical images
for exactly the subjects quizzes ask about (flags, landmarks, people, species).

Requests are cached and run concurrently with a hard timeout.
"""

from __future__ import annotations

import logging
import re
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache

import requests

from api.core.config import get_settings

logger = logging.getLogger(__name__)

_API_ENDPOINT = "https://en.wikipedia.org/w/api.php"

# Wikimedia asks for a descriptive User-Agent identifying the application.
_USER_AGENT = "Quizzatron/2.0 (https://github.com/SVijayB/Quizzatron) quiz-image-lookup"

# Descriptor words that models append out of habit. They describe the *kind* of
# picture wanted, not the subject, and searching for them lands on the wrong
# article ("Nikola Tesla portrait" matched an unrelated painter).
# Only words that describe the *medium* rather than the subject, plus stopwords.
# Deliberately excluded: map, diagram, emblem, painting, artwork, sculpture --
# those are legitimate subjects in their own right ("map of the Roman Empire"),
# and stripping them changes what the question is asking about.
_DESCRIPTORS = {
    "photo",
    "photos",
    "photograph",
    "photography",
    "picture",
    "pic",
    "image",
    "images",
    "illustration",
    "portrait",
    "headshot",
    "closeup",
    "close-up",
    "official",
    "famous",
    "the",
    "a",
    "an",
    "of",
}

_WORD_RE = re.compile(r"[a-z0-9]+")


def _normalise_query(query: str) -> str:
    """Reduce a model-written image query to its subject."""
    cleaned = " ".join(str(query).split())
    tokens = cleaned.split()
    kept = [t for t in tokens if t.strip(".,'\"").casefold() not in _DESCRIPTORS]
    # Never strip everything away.
    return " ".join(kept) if kept else cleaned


def _tokens(text: str) -> set[str]:
    """Lowercase word tokens, for cheap title-similarity scoring."""
    return set(_WORD_RE.findall(text.casefold()))


def _strip_tracking(url: str) -> str:
    """Remove analytics query parameters Wikimedia appends to image URLs."""
    parsed = urllib.parse.urlsplit(url)
    if not parsed.query:
        return url
    kept = [
        (key, value)
        for key, value in urllib.parse.parse_qsl(parsed.query)
        if not key.startswith("utm_")
    ]
    return urllib.parse.urlunsplit(parsed._replace(query=urllib.parse.urlencode(kept)))


def _score(title: str, wanted: set[str]) -> float:
    """Rank a candidate page title against the requested subject tokens."""
    if not wanted:
        return 0.0
    title_tokens = _tokens(title)
    overlap = len(title_tokens & wanted) / len(wanted)
    # Prefer tight titles: "Flag of Japan" over "List of flags of Asia".
    brevity = 1.0 / (1 + max(0, len(title_tokens) - len(wanted)))
    return overlap + 0.25 * brevity


@lru_cache(maxsize=512)
def _lookup(query: str, timeout: float) -> str | None:
    """Search Wikimedia for a representative image URL. Cached per query."""
    subject = _normalise_query(query)
    if not subject:
        return None

    params = {
        "action": "query",
        "format": "json",
        "formatversion": "2",
        "prop": "pageimages",
        "piprop": "original|thumbnail",
        "pithumbsize": "900",
        "generator": "search",
        "gsrsearch": subject,
        "gsrlimit": "5",
        "gsrnamespace": "0",
    }

    try:
        response = requests.get(
            _API_ENDPOINT,
            params=params,
            timeout=timeout,
            headers={"User-Agent": _USER_AGENT, "Accept": "application/json"},
        )
        response.raise_for_status()
        payload = response.json()
    except requests.RequestException as exc:
        logger.warning("Image lookup failed for %r: %s", subject, exc)
        return None
    except ValueError as exc:
        logger.warning("Image lookup returned invalid JSON for %r: %s", subject, exc)
        return None

    pages = payload.get("query", {}).get("pages") or []
    if isinstance(pages, dict):  # formatversion=1 fallback
        pages = list(pages.values())

    wanted = _tokens(subject)
    best_url: str | None = None
    best_rank = float("-inf")
    for page in pages:
        source = (page.get("original") or page.get("thumbnail") or {}).get("source")
        if not source:
            continue
        rank = _score(str(page.get("title", "")), wanted)
        if rank > best_rank:
            best_rank = rank
            best_url = str(source)

    if best_url is None:
        logger.info("No Wikimedia image found for %r", subject)
        return None
    return _strip_tracking(best_url)


def resolve_image(query: str | None) -> str | None:
    """Return an image URL for ``query``, or ``None`` if nothing suitable exists."""
    if not query or not str(query).strip():
        return None
    return _lookup(str(query).strip(), get_settings().image_download_timeout_s)


def resolve_images(queries: list[str | None]) -> list[str | None]:
    """Resolve several image queries concurrently, preserving order.

    v1 resolved images strictly serially with no timeout, so a 10-question image
    quiz meant 10 back-to-back scrapes inside the request.
    """
    settings = get_settings()
    unique = {q.strip() for q in queries if q and str(q).strip()}
    if not unique:
        return [None] * len(queries)

    workers = max(1, min(settings.image_max_concurrency, len(unique)))
    resolved: dict[str, str | None] = {}
    with ThreadPoolExecutor(max_workers=workers, thread_name_prefix="img") as pool:
        futures = {pool.submit(resolve_image, q): q for q in unique}
        for future, query in futures.items():
            try:
                resolved[query] = future.result(timeout=settings.image_download_timeout_s + 5)
            except Exception as exc:  # noqa: BLE001 - a missing image is not fatal
                logger.warning("Image resolution errored for %r: %s", query, exc)
                resolved[query] = None

    return [resolved.get(q.strip()) if q and str(q).strip() else None for q in queries]


def clear_image_cache() -> None:
    """Drop the memoised lookups. Used by tests."""
    _lookup.cache_clear()

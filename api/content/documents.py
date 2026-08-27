"""Extract quiz source text from uploaded documents.

Fixes carried over from ``api/utils/quiz_gen.py``:

* ``extract_text()`` was called **twice per page** (once to filter, once to join),
  doubling parse cost on every upload.
* There was **no page cap, no character cap and no ``MAX_CONTENT_LENGTH``**, so a
  500-page PDF was extracted whole and interpolated into the prompt.
* Encrypted and corrupt files raised bare exceptions that were swallowed several
  layers up and reported as "Invalid model output".
* Uploads were written to ``uploads/`` and **never deleted**.

This module works on bytes and never persists anything, so there is no upload
directory to leak and no path for a caller to read an arbitrary server file.
"""

from __future__ import annotations

import io
import logging

from pypdf import PdfReader
from pypdf.errors import PdfReadError

from api.core.config import get_settings

logger = logging.getLogger(__name__)


class DocumentError(ValueError):
    """Raised when a document cannot be turned into usable text."""


def extract_pdf_text(data: bytes | io.BufferedIOBase) -> str:
    """Extract text from PDF bytes, truncated to the configured limits.

    Raises :class:`DocumentError` with a user-facing message on any failure.
    """
    settings = get_settings()
    stream = io.BytesIO(data) if isinstance(data, (bytes, bytearray)) else data

    try:
        reader = PdfReader(stream)
    except PdfReadError as exc:
        raise DocumentError("That file could not be read as a PDF.") from exc
    except Exception as exc:  # noqa: BLE001 - pypdf raises a wide range
        logger.warning("PDF open failed: %s", exc)
        raise DocumentError("That file could not be read as a PDF.") from exc

    if getattr(reader, "is_encrypted", False):
        # An empty user password is common and harmless; try it before failing.
        try:
            if not reader.decrypt(""):
                raise DocumentError("That PDF is password-protected.")
        except DocumentError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise DocumentError("That PDF is password-protected.") from exc

    pages = reader.pages[: settings.max_pdf_pages]
    if not pages:
        raise DocumentError("That PDF has no pages.")

    chunks: list[str] = []
    total = 0
    for number, page in enumerate(pages, start=1):
        try:
            # Extracted once per page, unlike v1.
            text = page.extract_text() or ""
        except Exception as exc:  # noqa: BLE001 - a bad page shouldn't kill the upload
            logger.warning("Could not extract page %d: %s", number, exc)
            continue

        text = text.strip()
        if not text:
            continue

        chunks.append(text)
        total += len(text)
        if total >= settings.max_pdf_chars:
            logger.info(
                "PDF truncated at page %d (%d chars, limit %d).",
                number,
                total,
                settings.max_pdf_chars,
            )
            break

    combined = "\n\n".join(chunks).strip()
    if not combined:
        raise DocumentError(
            "No text could be extracted from that PDF. Scanned images are not supported."
        )

    if len(combined) > settings.max_pdf_chars:
        combined = combined[: settings.max_pdf_chars].rsplit(" ", 1)[0]

    return combined


def summarise_source(text: str, limit: int = 60) -> str:
    """A short human label for a document, used as the quiz's topic name."""
    first_line = next((line.strip() for line in text.splitlines() if line.strip()), "")
    if not first_line:
        return "Uploaded document"
    collapsed = " ".join(first_line.split())
    if len(collapsed) <= limit:
        return collapsed
    return collapsed[:limit].rsplit(" ", 1)[0] + "..."

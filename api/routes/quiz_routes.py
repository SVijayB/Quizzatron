"""Quiz generation endpoints.

Contract changes from v1, all deliberate:

* The success body is the quiz object, not ``[[...], 200]``. v1 called
  ``jsonify(questions, 200)``, which builds a two-element JSON *array* and does
  not set the status -- a wart four separate consumers had to unwrap.
* ``options`` carry no ``"A) "`` prefix and the answer is an integer
  ``correct_index``.
* ``GET /generate?pdf=<server path>`` is **removed**. It opened an arbitrary
  local file, gated only by ``.endswith(".pdf")``.
* Uploads are read from the request stream and never written to disk, so there
  is no upload directory to fill up and nothing for a later request to read.
"""

from __future__ import annotations

import logging

from flask import Blueprint, jsonify, request
from pydantic import ValidationError

from api.content.documents import DocumentError, extract_pdf_text, summarise_source
from api.content.trivia import TriviaProviderError
from api.core.config import get_settings
from api.core.errors import ApiError
from api.llm.registry import available_models, default_model_key
from api.models.quiz import QuizRequest
from api.services.quiz_service import (
    QuizGenerationError,
    generate_quiz,
    quiz_from_category,
)

logger = logging.getLogger(__name__)

quiz_bp = Blueprint("quiz", __name__, url_prefix="/quiz")

_ALLOWED_PDF_TYPES = {"application/pdf", "application/x-pdf", "application/octet-stream"}
_PDF_MAGIC = b"%PDF-"


@quiz_bp.get("/models")
def list_models():
    """Return the selectable models.

    Only models whose credentials are actually present are marked available --
    v1 advertised every configured model, so choosing one produced an opaque 500.
    """
    models = [spec.as_public_dict() for spec in available_models()]
    return jsonify({"models": models, "default": default_model_key()})


@quiz_bp.post("/generate")
def generate():
    """Generate a quiz from a topic, an uploaded PDF, or a category."""
    payload, source_text, topic_override = _read_request()

    try:
        parsed = QuizRequest.model_validate(payload)
    except ValidationError as exc:
        raise ApiError(_first_error(exc), status=400, code="invalid_request") from exc

    if topic_override:
        parsed = parsed.model_copy(update={"topic": topic_override})

    try:
        quiz = generate_quiz(parsed, source_text=source_text)
    except QuizGenerationError as exc:
        raise ApiError(
            str(exc),
            status=503 if exc.retryable else 400,
            code="generation_failed",
            retryable=exc.retryable,
        ) from exc

    return jsonify(quiz.model_dump(mode="json"))


@quiz_bp.post("/category")
def from_category():
    """Build a quiz from pre-written questions in a category."""
    body = request.get_json(silent=True) or {}
    category = str(body.get("category") or "").strip()
    if not category:
        raise ApiError("A category is required.", status=400, code="invalid_request")

    try:
        parsed = QuizRequest.model_validate({**body, "topic": category})
    except ValidationError as exc:
        raise ApiError(_first_error(exc), status=400, code="invalid_request") from exc

    try:
        quiz = quiz_from_category(
            category=category,
            num_questions=parsed.num_questions,
            difficulty=parsed.difficulty,
        )
    except TriviaProviderError as exc:
        raise ApiError(str(exc), status=502, code="provider_error", retryable=True) from exc

    return jsonify(quiz.model_dump(mode="json"))


def _read_request() -> tuple[dict[str, object], str | None, str | None]:
    """Normalise JSON and multipart bodies into one dict.

    Returns ``(fields, source_text, topic_override)``.
    """
    settings = get_settings()

    if request.files:
        fields: dict[str, object] = dict(request.form)
        upload = request.files.get("pdf") or request.files.get("file")
        if upload is None or not upload.filename:
            raise ApiError("No file was uploaded.", status=400, code="invalid_request")

        filename = upload.filename.lower()
        if not filename.endswith(".pdf"):
            raise ApiError("Only PDF files are supported.", status=400, code="invalid_file")
        if upload.mimetype and upload.mimetype not in _ALLOWED_PDF_TYPES:
            raise ApiError("Only PDF files are supported.", status=400, code="invalid_file")

        data = upload.read(settings.max_upload_bytes + 1)
        if not data:
            raise ApiError("That file is empty.", status=400, code="invalid_file")
        if len(data) > settings.max_upload_bytes:
            limit_mb = settings.max_upload_bytes // (1024 * 1024)
            raise ApiError(
                f"That file is too large. The limit is {limit_mb} MB.",
                status=413,
                code="file_too_large",
            )
        # Content check, not just the extension.
        if not data.startswith(_PDF_MAGIC):
            raise ApiError("That file is not a valid PDF.", status=400, code="invalid_file")

        try:
            text = extract_pdf_text(data)
        except DocumentError as exc:
            raise ApiError(str(exc), status=400, code="unreadable_document") from exc

        override = str(fields.get("topic") or "").strip() or summarise_source(text)
        return fields, text, override

    body = request.get_json(silent=True)
    if body is None:
        body = dict(request.form) if request.form else {}
    if not isinstance(body, dict):
        raise ApiError("Expected a JSON object.", status=400, code="invalid_request")
    return dict(body), None, None


def _first_error(exc: ValidationError) -> str:
    """Render the first pydantic error as a sentence."""
    errors = exc.errors()
    if not errors:
        return "Invalid request."
    first = errors[0]
    field = ".".join(str(part) for part in first.get("loc", ())) or "request"
    message = first.get("msg", "is invalid")
    message = message.removeprefix("Value error, ")
    return f"{field}: {message}"

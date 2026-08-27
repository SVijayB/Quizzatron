"""One consistent JSON error envelope.

v1 returned errors in at least five different shapes: ``{"error": "..."}``,
a bare string body, ``null``, a verbose usage blob with example URLs, and
``f"ERROR 404: CANNOT GET {path}"`` as **plain text** from the 404 handler. It
also returned HTTP 200 for "not found" on ``/api/questions/get``.

Everything now answers with ``{"error": {"message": ..., "code": ...}}`` and a
status that matches.
"""

from __future__ import annotations

import logging

from flask import Flask, jsonify
from werkzeug.exceptions import HTTPException

logger = logging.getLogger(__name__)


class ApiError(Exception):
    """An error with an HTTP status and a client-safe message."""

    def __init__(
        self,
        message: str,
        *,
        status: int = 400,
        code: str = "bad_request",
        retryable: bool = False,
    ) -> None:
        """Build an API error."""
        super().__init__(message)
        self.message = message
        self.status = status
        self.code = code
        self.retryable = retryable

    def to_dict(self) -> dict[str, object]:
        """Serialise into the error envelope."""
        return {
            "error": {
                "message": self.message,
                "code": self.code,
                "retryable": self.retryable,
            }
        }


def error_response(
    message: str, *, status: int = 400, code: str = "bad_request", retryable: bool = False
):
    """Build a Flask JSON error response."""
    payload = ApiError(message, status=status, code=code, retryable=retryable).to_dict()
    return jsonify(payload), status


def register_error_handlers(app: Flask) -> None:
    """Install handlers so every failure returns the same envelope."""

    @app.errorhandler(ApiError)
    def _handle_api_error(exc: ApiError):
        """Return a declared API error."""
        return jsonify(exc.to_dict()), exc.status

    @app.errorhandler(HTTPException)
    def _handle_http_error(exc: HTTPException):
        """Convert Werkzeug's HTML error pages into JSON."""
        return (
            jsonify(
                {
                    "error": {
                        "message": exc.description or exc.name,
                        "code": exc.name.lower().replace(" ", "_"),
                        "retryable": exc.code in {429, 502, 503, 504},
                    }
                }
            ),
            exc.code or 500,
        )

    @app.errorhandler(Exception)
    def _handle_unexpected(exc: Exception):
        """Log the real cause, tell the client nothing sensitive."""
        logger.exception("Unhandled error: %s", exc)
        return (
            jsonify(
                {
                    "error": {
                        "message": "Something went wrong on our end.",
                        "code": "internal_error",
                        "retryable": True,
                    }
                }
            ),
            500,
        )

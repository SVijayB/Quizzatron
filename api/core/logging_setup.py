"""Logging configuration.

v1 attached an unrotated ``logging.FileHandler("app.log")`` at a **relative**
path, so the file landed wherever the process happened to start and grew without
bound. It also removed every pre-existing root handler on each call.
"""

from __future__ import annotations

import logging
import logging.handlers
import sys

from api.core.config import LOG_DIR

_CONFIGURED = False

_NOISY = ("engineio", "socketio", "werkzeug", "urllib3", "httpx", "httpcore", "pymongo")


def setup_logging(*, level: int = logging.INFO, to_file: bool = True) -> None:
    """Configure root logging once, idempotently."""
    global _CONFIGURED  # noqa: PLW0603 - process-wide, guard against re-entry
    if _CONFIGURED:
        return

    formatter = logging.Formatter(
        "%(asctime)s %(levelname)-7s %(name)s: %(message)s", datefmt="%Y-%m-%d %H:%M:%S"
    )

    handlers: list[logging.Handler] = []

    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(formatter)
    handlers.append(console)

    if to_file:
        try:
            LOG_DIR.mkdir(parents=True, exist_ok=True)
            rotating = logging.handlers.RotatingFileHandler(
                LOG_DIR / "quizzatron.log",
                maxBytes=2 * 1024 * 1024,
                backupCount=3,
                encoding="utf-8",
            )
            rotating.setFormatter(formatter)
            handlers.append(rotating)
        except OSError:
            # Read-only filesystem: console logging is enough.
            pass

    root = logging.getLogger()
    root.setLevel(level)
    for handler in handlers:
        root.addHandler(handler)

    for name in _NOISY:
        logging.getLogger(name).setLevel(logging.WARNING)

    _CONFIGURED = True

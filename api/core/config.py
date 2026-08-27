"""Application settings and filesystem paths.

Every path here is absolute and derived from this file's location, so the app
behaves identically no matter what working directory the process starts in. The
previous implementation used bare relative paths (``assets/prompt.txt``,
``api/static/temp``, ``uploads``) which silently broke outside the repo root.

Nothing in this module touches the filesystem or the network at import time.
Call :func:`ensure_runtime_dirs` explicitly from the app factory instead.
"""

from __future__ import annotations

import os
import secrets
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

# api/core/config.py -> api/core -> api -> <repo root>
REPO_ROOT: Path = Path(__file__).resolve().parents[2]
API_DIR: Path = REPO_ROOT / "api"
ASSETS_DIR: Path = REPO_ROOT / "assets"
STATIC_DIR: Path = API_DIR / "static"
TEMP_IMAGE_DIR: Path = STATIC_DIR / "temp"
UPLOAD_DIR: Path = REPO_ROOT / "uploads"
LOG_DIR: Path = REPO_ROOT / "logs"


def _env_flag(name: str, default: bool = False) -> bool:
    """Read a boolean environment variable tolerantly."""
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    """Read an int environment variable, falling back on anything unparseable."""
    try:
        return int(os.getenv(name, "").strip() or default)
    except (TypeError, ValueError):
        return default


def _env_list(name: str) -> list[str]:
    """Read a comma-separated environment variable into a list."""
    raw = os.getenv(name, "")
    return [item.strip() for item in raw.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    """Resolved application configuration."""

    environment: str = "LOCAL"
    secret_key: str = ""
    port: int = 5000
    host: str = "127.0.0.1"

    # CORS
    cors_origins: list[str] = field(default_factory=list)

    # Data sources
    mongo_uri: str | None = None
    mongo_db_name: str = "trivia-qa"
    mongo_timeout_ms: int = 3000
    opentdb_timeout_s: float = 5.0

    # Quiz generation limits
    max_questions: int = 30
    max_pdf_chars: int = 24_000
    max_pdf_pages: int = 60
    max_upload_bytes: int = 10 * 1024 * 1024
    llm_timeout_s: float = 90.0
    llm_output_retries: int = 2

    # Images
    image_download_timeout_s: float = 12.0
    image_max_concurrency: int = 4
    temp_image_ttl_s: int = 3600

    # Multiplayer
    max_players_per_lobby: int = 8
    lobby_idle_ttl_s: int = 3600
    reaper_interval_s: int = 300

    # LiteLLM proxy (optional). When set, models can be routed through a
    # LiteLLM gateway instead of talking to providers directly.
    litellm_base_url: str | None = None
    litellm_api_key: str | None = None

    @property
    def is_local(self) -> bool:
        """True when running in a local/dev environment."""
        return self.environment in {"LOCAL", "DEVELOPMENT", "DEV", "TEST"}

    @property
    def is_production(self) -> bool:
        """True when running with production semantics."""
        return not self.is_local


def load_settings() -> Settings:
    """Build :class:`Settings` from the process environment."""
    environment = (os.getenv("FLASK_ENV") or "LOCAL").strip().upper()
    is_local = environment in {"LOCAL", "DEVELOPMENT", "DEV", "TEST"}

    secret_key = os.getenv("SECRET_KEY") or ""
    if not secret_key:
        if not is_local:
            raise RuntimeError("SECRET_KEY must be set when FLASK_ENV is not a local environment.")
        # Ephemeral per-process key is fine for local dev; sessions simply
        # don't survive a restart.
        secret_key = secrets.token_urlsafe(32)

    origins = _env_list("CORS_ORIGINS")
    if not origins:
        origins = (
            ["http://localhost:8080", "http://127.0.0.1:8080"]
            if is_local
            else ["https://quizzatron.netlify.app"]
        )

    return Settings(
        environment=environment,
        secret_key=secret_key,
        port=_env_int("PORT", 5000),
        host=os.getenv("HOST") or ("127.0.0.1" if is_local else "0.0.0.0"),
        cors_origins=origins,
        mongo_uri=os.getenv("MONGO_CONNECTION_STRING") or None,
        mongo_db_name=os.getenv("MONGO_DB_NAME") or "trivia-qa",
        mongo_timeout_ms=_env_int("MONGO_TIMEOUT_MS", 3000),
        max_questions=_env_int("MAX_QUESTIONS", 30),
        max_upload_bytes=_env_int("MAX_UPLOAD_BYTES", 10 * 1024 * 1024),
        llm_timeout_s=float(_env_int("LLM_TIMEOUT_S", 90)),
        llm_output_retries=_env_int("LLM_OUTPUT_RETRIES", 2),
        max_players_per_lobby=_env_int("MAX_PLAYERS_PER_LOBBY", 8),
        lobby_idle_ttl_s=_env_int("LOBBY_IDLE_TTL_S", 3600),
        litellm_base_url=os.getenv("LITELLM_BASE_URL") or None,
        litellm_api_key=os.getenv("LITELLM_API_KEY") or None,
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the process-wide settings, loading them once."""
    return load_settings()


def reset_settings_cache() -> None:
    """Clear the cached settings. Used by tests that patch the environment."""
    get_settings.cache_clear()


def ensure_runtime_dirs() -> None:
    """Create the directories the app writes to.

    Called explicitly by the app factory so that merely importing a module
    never touches the filesystem (which broke read-only containers and made
    the utils untestable).
    """
    for path in (TEMP_IMAGE_DIR, UPLOAD_DIR, LOG_DIR):
        path.mkdir(parents=True, exist_ok=True)

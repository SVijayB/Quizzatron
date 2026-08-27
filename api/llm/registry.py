"""Model catalogue and pydantic-ai model construction.

Design notes
------------
* **No hardcoded provider branching.** v1 did ``if model == "gemini": ... elif
  model == "deepseek": ...`` in two places with different casing rules. Models
  are data here, and adding one is a single table entry.

* **The ``litellm`` SDK is deliberately not a dependency.** Latest litellm pins
  ``openai<3`` while ``pydantic-ai-slim[openai]`` needs ``openai>=3``, so
  installing both silently drags litellm backwards. pydantic-ai's
  :class:`LiteLLMProvider` only needs the ``openai`` package -- it is an
  OpenAI-compatible HTTP client plus per-vendor model profiles -- so pointing it
  at a LiteLLM **proxy** gives the gateway benefits with no conflict.

* **Model IDs are env-overridable.** Provider catalogues change often, so every
  entry can be redirected with an environment variable rather than a code edit.
  See ``MODEL_ID_ENV_SUFFIX``.

* **Nothing here contacts a provider at import time.** v1 built
  ``genai.Client()`` at module import, so a missing key broke app boot entirely.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, replace
from functools import lru_cache

from pydantic_ai.models import Model

from api.core.config import get_settings

# A model's ID can be overridden with QUIZZATRON_MODEL_<KEY>, where <KEY> is the
# registry key upper-cased with hyphens turned into underscores. For example:
#   QUIZZATRON_MODEL_GEMINI_FLASH=gemini-2.5-flash-002
MODEL_ID_ENV_SUFFIX = "QUIZZATRON_MODEL_"

# Sentinel key for the offline provider. Uses pydantic-ai's TestModel, which
# returns schema-conformant placeholder data with no network access -- so the
# app boots and the whole test suite runs with zero credentials.
OFFLINE_MODEL_KEY = "offline"

# Provider routed through a LiteLLM proxy rather than a native SDK.
LITELLM_PROVIDER = "litellm"


@dataclass(frozen=True)
class ModelSpec:
    """A selectable model and how to reach it."""

    key: str
    label: str
    provider: str
    model_id: str
    api_key_env: str | None = None
    notes: str | None = None

    @property
    def requires_key(self) -> bool:
        """True when this model needs an API key to be usable."""
        return bool(self.api_key_env)

    def is_available(self) -> bool:
        """True when this model can actually be called right now."""
        if self.provider == LITELLM_PROVIDER:
            return bool(get_settings().litellm_base_url)
        if self.provider == "test":
            return True
        if not self.api_key_env:
            return True
        return bool(os.getenv(self.api_key_env))

    def as_public_dict(self) -> dict[str, object]:
        """Serialise for the ``/api/quiz/models`` response."""
        return {
            "key": self.key,
            "label": self.label,
            "provider": self.provider,
            "available": self.is_available(),
            "requires_key": self.requires_key,
            "key_env": self.api_key_env,
            "notes": self.notes,
        }


# Ordered: the first available entry becomes the default.
#
# NOTE ON MODEL IDS: provider catalogues move fast and these cannot be verified
# without live credentials. Each is overridable via QUIZZATRON_MODEL_<KEY>, and
# an unknown ID surfaces as a clear ModelUnavailableError rather than a generic
# 500. Verify against your provider's current catalogue before deploying.
_REGISTRY: tuple[ModelSpec, ...] = (
    ModelSpec(
        key="gemini-flash",
        label="Gemini 2.5 Flash",
        provider="google",
        model_id="gemini-2.5-flash",
        api_key_env="GOOGLE_API_KEY",
        notes="Fast and cheap. Recommended default.",
    ),
    ModelSpec(
        key="gemini-pro",
        label="Gemini 2.5 Pro",
        provider="google",
        model_id="gemini-2.5-pro",
        api_key_env="GOOGLE_API_KEY",
        notes="Higher quality, slower.",
    ),
    ModelSpec(
        key="mistral-large",
        label="Mistral Large",
        provider="mistral",
        model_id="mistral-large-latest",
        api_key_env="MISTRAL_API_KEY",
    ),
    ModelSpec(
        key="gpt",
        label="GPT",
        provider="openai-chat",
        model_id="gpt-4.1-mini",
        api_key_env="OPENAI_API_KEY",
    ),
    ModelSpec(
        key="deepseek",
        label="DeepSeek",
        provider="deepseek",
        model_id="deepseek-chat",
        api_key_env="DEEPSEEK_API_KEY",
        notes="Reasoning models may be slower to return structured output.",
    ),
    ModelSpec(
        key="litellm",
        label="LiteLLM gateway",
        provider=LITELLM_PROVIDER,
        model_id="openai/gpt-4.1-mini",
        api_key_env="LITELLM_API_KEY",
        notes="Routes through a LiteLLM proxy. Requires LITELLM_BASE_URL.",
    ),
    ModelSpec(
        key=OFFLINE_MODEL_KEY,
        label="Offline (placeholder questions)",
        provider="test",
        model_id="test",
        notes="No network or API key. For local development and tests only.",
    ),
)


class ModelUnavailableError(RuntimeError):
    """Raised when a requested model is unknown or has no credentials."""


def _apply_env_override(spec: ModelSpec) -> ModelSpec:
    """Return ``spec`` with its model ID replaced by an env override, if set."""
    env_name = MODEL_ID_ENV_SUFFIX + spec.key.upper().replace("-", "_")
    override = os.getenv(env_name)
    if override and override.strip():
        return replace(spec, model_id=override.strip())
    return spec


def all_models() -> list[ModelSpec]:
    """Every registered model, with env overrides applied."""
    specs = [_apply_env_override(spec) for spec in _REGISTRY]
    if not _offline_allowed():
        specs = [s for s in specs if s.key != OFFLINE_MODEL_KEY]
    return specs


def _offline_allowed() -> bool:
    """Whether the offline placeholder model may be selected."""
    raw = os.getenv("ALLOW_OFFLINE_MODEL")
    if raw is not None:
        return raw.strip().lower() in {"1", "true", "yes", "on"}
    return get_settings().is_local


def available_models() -> list[ModelSpec]:
    """Only the models that can actually be called right now.

    v1's ``/quiz/models`` advertised every configured model regardless of
    whether its key existed, so picking one produced an opaque 500.
    """
    return [spec for spec in all_models() if spec.is_available()]


def default_model_key() -> str | None:
    """The first available model's key, or ``None`` if nothing is configured."""
    usable = available_models()
    return usable[0].key if usable else None


def resolve_model(key: str | None) -> ModelSpec:
    """Look up a model by key, case-insensitively.

    Falls back to the first available model when ``key`` is empty. Raises
    :class:`ModelUnavailableError` for an unknown key or a missing credential,
    so the caller can return a precise error instead of a generic failure.
    """
    specs = all_models()
    if not key or not str(key).strip():
        fallback = default_model_key()
        if fallback is None:
            raise ModelUnavailableError(
                "No language model is configured. Set GOOGLE_API_KEY (or another "
                "provider key), or set ALLOW_OFFLINE_MODEL=1 for placeholder output."
            )
        key = fallback

    wanted = str(key).strip().lower()
    by_key = {spec.key.lower(): spec for spec in specs}

    spec = by_key.get(wanted)
    if spec is None:
        # Accept a raw provider model ID too, so QUIZZATRON_MODEL_* overrides and
        # LiteLLM-style "provider/model" strings still resolve.
        for candidate in specs:
            if candidate.model_id.lower() == wanted:
                spec = candidate
                break

    if spec is None:
        known = ", ".join(sorted(s.key for s in specs))
        raise ModelUnavailableError(f"Unknown model {key!r}. Available: {known}.")

    if not spec.is_available():
        if spec.provider == LITELLM_PROVIDER:
            raise ModelUnavailableError(f"Model {spec.key!r} needs LITELLM_BASE_URL to be set.")
        raise ModelUnavailableError(
            f"Model {spec.key!r} is configured but {spec.api_key_env} is not set."
        )
    return spec


@lru_cache(maxsize=16)
def _build_model_cached(provider: str, model_id: str) -> Model:
    """Construct and memoise a pydantic-ai model.

    Cached so the underlying HTTP client and connection pool are reused across
    requests instead of rebuilt per call.
    """
    settings = get_settings()

    if provider == "test":
        from api.llm.offline import build_offline_model

        return build_offline_model()

    if provider == LITELLM_PROVIDER:
        from pydantic_ai.models.openai import OpenAIChatModel
        from pydantic_ai.providers.litellm import LiteLLMProvider

        return OpenAIChatModel(
            model_id,
            provider=LiteLLMProvider(
                api_base=settings.litellm_base_url,
                api_key=settings.litellm_api_key or "not-required",
            ),
        )

    if provider == "google":
        from pydantic_ai.models.google import GoogleModel

        return GoogleModel(model_id)

    if provider == "mistral":
        from pydantic_ai.models.mistral import MistralModel

        return MistralModel(model_id)

    if provider in {"openai", "openai-chat", "deepseek"}:
        # pydantic-ai's "<provider>:<model>" shorthand handles base URLs and
        # key env vars for OpenAI-compatible providers. Note bare "openai:"
        # resolves to the Responses API, so we pin Chat Completions.
        from pydantic_ai.models import infer_model

        prefix = "openai-chat" if provider == "openai" else provider
        return infer_model(f"{prefix}:{model_id}")

    raise ModelUnavailableError(f"Unsupported provider {provider!r}.")


def build_model(spec: ModelSpec) -> Model:
    """Return a ready-to-use pydantic-ai model for ``spec``."""
    try:
        return _build_model_cached(spec.provider, spec.model_id)
    except ModelUnavailableError:
        raise
    except Exception as exc:  # noqa: BLE001 - surfaced as a clean API error
        raise ModelUnavailableError(
            f"Could not initialise model {spec.key!r} ({spec.model_id}): {exc}"
        ) from exc


def clear_model_cache() -> None:
    """Drop memoised models. Used by tests that swap environment variables."""
    _build_model_cached.cache_clear()

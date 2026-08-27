"""Language-model layer: model registry, prompts, and the quiz-generation agent."""

from api.llm.registry import ModelSpec, available_models, build_model, resolve_model

__all__ = ["ModelSpec", "available_models", "build_model", "resolve_model"]

"""Shared test fixtures.

The whole suite runs with **no API keys and no MongoDB**. Quiz generation uses
the offline model (``api/llm/offline.py``), which returns schema-valid
placeholder data through pydantic-ai's ``FunctionModel``, and every network call
is either stubbed or explicitly marked.
"""

from __future__ import annotations

import os
import threading
import time
from collections.abc import Iterator

import pytest


@pytest.fixture(autouse=True)
def _isolated_env(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """Give every test a clean, credential-free environment."""
    for name in (
        "GOOGLE_API_KEY",
        "OPENAI_API_KEY",
        "MISTRAL_API_KEY",
        "DEEPSEEK_API_KEY",
        "LITELLM_BASE_URL",
        "LITELLM_API_KEY",
        "MONGO_CONNECTION_STRING",
    ):
        monkeypatch.delenv(name, raising=False)

    monkeypatch.setenv("FLASK_ENV", "TEST")
    monkeypatch.setenv("ALLOW_OFFLINE_MODEL", "1")
    monkeypatch.setenv("SECRET_KEY", "test-secret")

    from api.content import images, trivia
    from api.core import config
    from api.llm import registry

    config.reset_settings_cache()
    registry.clear_model_cache()
    images.clear_image_cache()
    trivia.clear_category_cache()
    trivia.reset_mongo_client()

    yield

    config.reset_settings_cache()
    registry.clear_model_cache()
    images.clear_image_cache()
    trivia.clear_category_cache()
    trivia.reset_mongo_client()


@pytest.fixture(autouse=True)
def _no_network(monkeypatch: pytest.MonkeyPatch, request: pytest.FixtureRequest) -> None:
    """Fail loudly if a test makes a real HTTP call.

    Tests that genuinely need the network must be marked ``@pytest.mark.network``.
    """
    if request.node.get_closest_marker("network"):
        return

    def _blocked(*args: object, **kwargs: object) -> None:
        raise AssertionError(
            "Unexpected network call. Stub it, or mark the test @pytest.mark.network."
        )

    monkeypatch.setattr("requests.get", _blocked)
    monkeypatch.setattr("requests.post", _blocked)


@pytest.fixture
def store():
    """An empty lobby store."""
    from api.multiplayer.store import store as lobby_store

    lobby_store.clear()
    yield lobby_store
    lobby_store.clear()


class RecordingBroadcaster:
    """Captures emitted events and runs background tasks on real threads."""

    def __init__(self) -> None:
        """Start empty."""
        self.events: list[tuple[str, dict]] = []
        self._lock = threading.Lock()
        self._threads: list[threading.Thread] = []

    def emit(self, event: str, payload: dict, *, room: str | None = None) -> None:
        """Record an event."""
        with self._lock:
            self.events.append((event, payload))

    def sleep(self, seconds: float) -> None:
        """Real sleep, so deadlines actually elapse."""
        time.sleep(seconds)

    def spawn(self, target, *args: object) -> None:
        """Run a task on a daemon thread."""
        thread = threading.Thread(target=target, args=args, daemon=True)
        thread.start()
        with self._lock:
            self._threads.append(thread)

    def names(self) -> list[str]:
        """Event names in order."""
        with self._lock:
            return [name for name, _ in self.events]

    def count(self, event: str) -> int:
        """How many times an event fired."""
        with self._lock:
            return sum(1 for name, _ in self.events if name == event)

    def last(self, event: str) -> dict | None:
        """The most recent payload for an event."""
        with self._lock:
            for name, payload in reversed(self.events):
                if name == event:
                    return payload
        return None

    def wait_for(self, event: str, timeout: float = 10.0, count: int = 1) -> bool:
        """Block until an event has fired ``count`` times."""
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if self.count(event) >= count:
                return True
            time.sleep(0.05)
        return False


@pytest.fixture
def broadcaster(store) -> Iterator[RecordingBroadcaster]:
    """Install a recording broadcaster into the engine."""
    from api.multiplayer import engine

    recorder = RecordingBroadcaster()
    engine.set_broadcaster(recorder)
    yield recorder
    engine.set_broadcaster(engine.NullBroadcaster())


@pytest.fixture
def app():
    """A configured Flask app."""
    from api.app import create_app

    application, _ = create_app()
    application.config.update(TESTING=True)
    return application


@pytest.fixture
def client(app):
    """A Flask test client."""
    return app.test_client()


def pytest_configure(config: pytest.Config) -> None:
    """Register custom markers."""
    config.addinivalue_line("markers", "network: test performs real network calls")

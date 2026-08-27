"""Bridge for calling async code from synchronous Flask handlers.

pydantic-ai is async-first. Flask (in threading mode, which is what this app
runs -- ``SocketIO`` is constructed without ``async_mode`` and neither eventlet
nor gevent is installed) serves each request on a real OS thread.

``Agent.run_sync()`` would mostly work here, but it calls
``loop.run_until_complete`` on a thread-local loop and raises ``RuntimeError``
if a loop is already running on that thread. A single long-lived background loop
is both safer and faster: it never conflicts with a caller's loop, and the
underlying HTTP connection pool is reused across requests instead of being torn
down every call.
"""

from __future__ import annotations

import asyncio
import atexit
import threading
from collections.abc import Coroutine
from concurrent.futures import TimeoutError as FutureTimeoutError
from typing import Any, TypeVar

T = TypeVar("T")


class AsyncRunner:
    """Runs coroutines on a dedicated background event loop."""

    def __init__(self, name: str = "quizzatron-aio") -> None:
        """Create a runner. The loop starts lazily on first use."""
        self._name = name
        self._loop: asyncio.AbstractEventLoop | None = None
        self._thread: threading.Thread | None = None
        self._lock = threading.Lock()

    def _ensure_loop(self) -> asyncio.AbstractEventLoop:
        """Start the background loop if it isn't already running."""
        with self._lock:
            if self._loop is None or self._loop.is_closed():
                loop = asyncio.new_event_loop()
                thread = threading.Thread(
                    target=self._run_forever, args=(loop,), name=self._name, daemon=True
                )
                thread.start()
                self._loop = loop
                self._thread = thread
            return self._loop

    @staticmethod
    def _run_forever(loop: asyncio.AbstractEventLoop) -> None:
        """Event-loop thread body."""
        asyncio.set_event_loop(loop)
        loop.run_forever()

    def run(self, coro: Coroutine[Any, Any, T], timeout: float | None = None) -> T:
        """Run ``coro`` to completion and return its result.

        Raises :class:`TimeoutError` if ``timeout`` elapses first, cancelling the
        coroutine so a slow provider can't leak a task forever.
        """
        loop = self._ensure_loop()
        future = asyncio.run_coroutine_threadsafe(coro, loop)
        try:
            return future.result(timeout=timeout)
        except FutureTimeoutError as exc:
            future.cancel()
            raise TimeoutError(f"Operation did not finish within {timeout} seconds.") from exc

    def shutdown(self) -> None:
        """Stop the background loop. Safe to call more than once."""
        with self._lock:
            loop, thread = self._loop, self._thread
            self._loop = self._thread = None
        if loop is not None and not loop.is_closed():
            loop.call_soon_threadsafe(loop.stop)
        if thread is not None:
            thread.join(timeout=5)
        if loop is not None and not loop.is_closed():
            loop.close()


_RUNNER = AsyncRunner()
atexit.register(_RUNNER.shutdown)


def run_async(coro: Coroutine[Any, Any, T], timeout: float | None = None) -> T:
    """Run ``coro`` on the shared background loop."""
    return _RUNNER.run(coro, timeout=timeout)

"""In-memory lobby registry with a working reaper.

v1 exported ``cleanup_inactive_lobbies`` and ``cleanup_orphaned_players`` but
**called neither from anywhere** -- no scheduler, no background task -- so
``active_lobbies`` grew for the entire process lifetime, holding every question
payload and every answer. ``cleanup_orphaned_players`` was also a guaranteed
deadlock: it held the global lock and then called ``leave_lobby``, which took the
same non-reentrant lock again.

Here the registry lock only ever guards the dict itself, per-lobby mutation uses
each lobby's own re-entrant lock, and the reaper is actually started by the app
factory.

Lobbies are process-local, so the deployment is single-process by design. That
was already true in v1 (``allow_unsafe_werkzeug=True``, no Socket.IO message
queue); it is now explicit rather than accidental.
"""

from __future__ import annotations

import logging
import threading
import uuid

from api.core.config import get_settings
from api.multiplayer.models import (
    CODE_LENGTH,
    DEFAULT_AVATAR,
    GameState,
    Lobby,
    Player,
    generate_lobby_code,
    now_ms,
)

logger = logging.getLogger(__name__)

MAX_LOBBIES = 500


class LobbyError(RuntimeError):
    """Raised for lobby operations that cannot be satisfied."""

    def __init__(self, message: str, *, status: int = 400) -> None:
        """Carry an HTTP status so routes don't have to guess one."""
        super().__init__(message)
        self.status = status


class LobbyStore:
    """Holds every active lobby."""

    def __init__(self) -> None:
        """Create an empty store."""
        self._lobbies: dict[str, Lobby] = {}
        self._lock = threading.RLock()

    def create(self, *, host_name: str, avatar: str | None = None) -> tuple[Lobby, Player]:
        """Create a lobby and its host player."""
        name = _clean_name(host_name)
        with self._lock:
            if len(self._lobbies) >= MAX_LOBBIES:
                self._reap_locked()
            if len(self._lobbies) >= MAX_LOBBIES:
                raise LobbyError("The server is at capacity. Try again shortly.", status=503)

            # Generate and insert under one lock hold. v1 released the lock
            # between picking a code and inserting it, so two concurrent creates
            # could collide and the second silently overwrote the first.
            code = self._unique_code_locked()
            host = Player(
                id=str(uuid.uuid4()),
                name=name,
                avatar=avatar or DEFAULT_AVATAR,
                is_host=True,
                ready=True,
            )
            lobby = Lobby(code=code, host_id=host.id)
            lobby.players[host.id] = host
            self._lobbies[code] = lobby

        logger.info("Lobby %s created by %r", code, name)
        return lobby, host

    def _unique_code_locked(self) -> str:
        """Pick a code not already in use. Caller must hold the lock."""
        for _ in range(50):
            code = generate_lobby_code()
            if code not in self._lobbies:
                return code
        raise LobbyError("Could not allocate a lobby code. Try again.", status=503)

    def get(self, code: str | None) -> Lobby | None:
        """Look up a lobby by code, case-insensitively."""
        if not code:
            return None
        key = str(code).strip().upper()
        if len(key) != CODE_LENGTH:
            return None
        with self._lock:
            return self._lobbies.get(key)

    def require(self, code: str | None) -> Lobby:
        """Look up a lobby or raise a 404-flavoured :class:`LobbyError`."""
        lobby = self.get(code)
        if lobby is None:
            raise LobbyError("That lobby does not exist. Check the code.", status=404)
        return lobby

    def remove(self, code: str) -> None:
        """Delete a lobby."""
        with self._lock:
            self._lobbies.pop(str(code).strip().upper(), None)

    def codes(self) -> list[str]:
        """Every active lobby code."""
        with self._lock:
            return list(self._lobbies)

    def count(self) -> int:
        """How many lobbies are active."""
        with self._lock:
            return len(self._lobbies)

    def reap(self) -> list[str]:
        """Drop idle and empty lobbies. Returns the codes removed."""
        with self._lock:
            return self._reap_locked()

    def _reap_locked(self) -> list[str]:
        """Reaper body. Caller must hold the registry lock."""
        ttl_ms = get_settings().lobby_idle_ttl_s * 1000
        cutoff = now_ms() - ttl_ms
        doomed: list[str] = []

        for code, lobby in list(self._lobbies.items()):
            with lobby.lock:
                idle = lobby.last_activity_ms < cutoff
                empty = not lobby.players
                abandoned = not lobby.connected_players and lobby.state is GameState.GAME_OVER
            if idle or empty or abandoned:
                doomed.append(code)

        for code in doomed:
            self._lobbies.pop(code, None)
        if doomed:
            logger.info("Reaped %d idle lobby/lobbies: %s", len(doomed), ", ".join(doomed))
        return doomed

    def clear(self) -> None:
        """Remove every lobby. Used by tests."""
        with self._lock:
            self._lobbies.clear()


def _clean_name(name: object) -> str:
    """Normalise a display name."""
    text = " ".join(str(name or "").split())
    if not text:
        raise LobbyError("A player name is required.")
    if len(text) > 20:
        text = text[:20].rstrip()
    return text


store = LobbyStore()

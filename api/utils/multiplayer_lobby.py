"""Utility functions for multiplayer lobby management."""

import uuid
import random
import time
import threading
import logging
import json
from flask import jsonify

# Game states
GAME_STATE = {
    "LOBBY": "lobby",
    "QUESTION": "question",
    "WAITING": "waiting",
    "SCOREBOARD": "scoreboard",
    "GAME_OVER": "game_over",
}

# In-memory storage for active lobbies
active_lobbies = {}

# Lock for thread-safe operations on the lobbies dictionary
lobbies_lock = threading.Lock()

# Import active_sessions from socket_server - this helps prevent circular imports
# while still allowing us to access the sessions map
active_sessions = None


def init_active_sessions(sessions_map):
    """Initialize the active_sessions reference from socket_server."""
    global active_sessions
    active_sessions = sessions_map


def cleanup_inactive_lobbies():
    """Remove lobbies that have been inactive for over an hour."""
    with lobbies_lock:
        current_time = time.time()
        inactive_lobbies = []

        for code, lobby in active_lobbies.items():
            # If lobby hasn't been accessed in 1 hour, mark for removal
            if current_time - lobby.get("last_activity", current_time) > 3600:
                inactive_lobbies.append(code)

        # Remove inactive lobbies
        for code in inactive_lobbies:
            del active_lobbies[code]
            logging.info(f"Removed inactive lobby: {code}")


def cleanup_orphaned_players():
    """
    Clean up players whose sessions are no longer active.
    This handles cases where browser crashes or refreshes don't trigger proper disconnects.
    """
    if active_sessions is None:
        logging.warning(
            "Active sessions not initialized, skipping orphaned player cleanup"
        )
        return

    with lobbies_lock:
        # Get all active session IDs
        active_sids = set(active_sessions.keys())

        # Scan all lobbies and players to check for orphaned players
        for lobby_code, lobby in list(active_lobbies.items()):
            for player in list(lobby["players"]):
                player_sid = player.get("session_id")
                # If player has a session ID but it's no longer active
                if player_sid and player_sid not in active_sids:
                    logging.info(
                        f"Found orphaned player {player['name']} in lobby {lobby_code}"
                    )
                    # Remove player through the normal mechanism
                    # We need to be careful to avoid deadlocks here
                    from api.services.multiplayer_service import leave_lobby

                    leave_lobby(lobby_code, player["name"])


def generate_lobby_code():
    """Generate a unique 6-character lobby code."""
    while True:
        code = "".join(random.choices("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", k=6))
        with lobbies_lock:
            if code not in active_lobbies:
                return code


def get_active_lobbies():
    """Return the active lobbies dictionary."""
    return active_lobbies

"""Enhanced multiplayer quiz game functionality with real-time updates."""

import uuid
import logging

# Import all functions from utility modules
from api.utils.multiplayer_lobby import (
    init_active_sessions,
    cleanup_inactive_lobbies,
    cleanup_orphaned_players,
    generate_lobby_code,
    GAME_STATE,
    active_lobbies,
    lobbies_lock,
)

from api.utils.multiplayer_game import (
    create_new_lobby,
    join_existing_lobby,
    update_player_ready_status,
    update_lobby_settings,
    start_game,
)

from api.utils.multiplayer_player import (
    leave_lobby,
    get_lobby_info,
    get_game_state,
    submit_player_answer,
    advance_to_next_question,
    get_game_results,
    update_player_avatar,
)

from api.utils.multiplayer_broadcast import (
    broadcast_lobby_update,
    broadcast_question,
    broadcast_player_answered,
    broadcast_all_answers_in,
    broadcast_scoreboard,
    broadcast_game_over,
)

# Export all functions as part of the public API
__all__ = [
    "init_active_sessions",
    "cleanup_inactive_lobbies",
    "cleanup_orphaned_players",
    "create_new_lobby",
    "join_existing_lobby",
    "update_player_ready_status",
    "update_lobby_settings",
    "start_game",
    "leave_lobby",
    "get_lobby_info",
    "get_game_state",
    "submit_player_answer",
    "advance_to_next_question",
    "get_game_results",
    "update_player_avatar",
    "broadcast_lobby_update",
    "broadcast_question",
    "broadcast_player_answered",
    "broadcast_all_answers_in",
    "broadcast_scoreboard",
    "broadcast_game_over",
]

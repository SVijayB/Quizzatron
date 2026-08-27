/**
 * One function per multiplayer endpoint.
 *
 * Real-time play runs over Socket.IO; these exist for the create/join handshake
 * and for state recovery after a reload. Every mutating call carries the
 * caller's `playerId`, which is what makes host-only actions enforceable.
 *
 * There is deliberately no `nextQuestion()`: the server owns round advancement.
 */

import { request } from "./http";
import type {
  AnswerResponse,
  CreateLobbyResponse,
  GameState,
  JoinLobbyResponse,
  LobbyMutationResponse,
  LobbySettings,
  LobbyState,
  MpResults,
  OkResponse,
} from "@/types/api";

interface Identity {
  lobbyCode: string;
  playerId: string;
}

export function createLobby(
  input: { hostName: string; avatar?: string },
  signal?: AbortSignal,
): Promise<CreateLobbyResponse> {
  return request<CreateLobbyResponse>("/multiplayer/create", {
    method: "POST",
    json: input,
    signal,
  });
}

export function joinLobby(
  input: { lobbyCode: string; playerName: string; avatar?: string },
  signal?: AbortSignal,
): Promise<JoinLobbyResponse> {
  return request<JoinLobbyResponse>("/multiplayer/join", {
    method: "POST",
    json: { ...input, lobbyCode: input.lobbyCode.trim().toUpperCase() },
    signal,
  });
}

export function leaveLobby(input: Identity, signal?: AbortSignal): Promise<OkResponse> {
  return request<OkResponse>("/multiplayer/leave", {
    method: "POST",
    json: input,
    signal,
  });
}

export function setReady(
  input: Identity & { ready: boolean },
  signal?: AbortSignal,
): Promise<LobbyMutationResponse> {
  return request<LobbyMutationResponse>("/multiplayer/ready", {
    method: "POST",
    json: input,
    signal,
  });
}

export function updateSettings(
  input: Identity & { settings: Partial<LobbySettings> },
  signal?: AbortSignal,
): Promise<LobbyMutationResponse> {
  return request<LobbyMutationResponse>("/multiplayer/settings", {
    method: "POST",
    json: input,
    signal,
  });
}

export function updateAvatar(
  input: Identity & { avatar: string },
  signal?: AbortSignal,
): Promise<LobbyMutationResponse> {
  return request<LobbyMutationResponse>("/multiplayer/avatar", {
    method: "POST",
    json: input,
    signal,
  });
}

export function startGame(
  input: Identity,
  signal?: AbortSignal,
): Promise<LobbyMutationResponse> {
  return request<LobbyMutationResponse>("/multiplayer/start", {
    method: "POST",
    json: input,
    signal,
  });
}

export function submitAnswer(
  input: Identity & { questionIndex: number; selectedIndex: number | null },
  signal?: AbortSignal,
): Promise<AnswerResponse> {
  return request<AnswerResponse>("/multiplayer/answer", {
    method: "POST",
    json: input,
    signal,
  });
}

export function restartGame(
  input: Identity,
  signal?: AbortSignal,
): Promise<LobbyMutationResponse> {
  return request<LobbyMutationResponse>("/multiplayer/restart", {
    method: "POST",
    json: input,
    signal,
  });
}

export function getLobbyState(
  lobbyCode: string,
  signal?: AbortSignal,
): Promise<LobbyState> {
  return request<LobbyState>(`/multiplayer/lobby/${encodeURIComponent(lobbyCode)}`, {
    signal,
  });
}

export function getGameState(
  lobbyCode: string,
  signal?: AbortSignal,
): Promise<GameState> {
  return request<GameState>(`/multiplayer/game/${encodeURIComponent(lobbyCode)}`, {
    signal,
  });
}

/**
 * The authority for final standings. The `game:over` socket payload is the
 * immediate source; this endpoint is how a client that missed the event (a
 * reload, a dropped socket) recovers instead of showing "No Results Found".
 */
export function getResults(lobbyCode: string, signal?: AbortSignal): Promise<MpResults> {
  return request<MpResults>(`/multiplayer/results/${encodeURIComponent(lobbyCode)}`, {
    signal,
  });
}

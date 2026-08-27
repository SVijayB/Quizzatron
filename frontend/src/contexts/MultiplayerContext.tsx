import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { isSnapshot, socketClient, type SocketStatus } from "@/services/socket";
import { useSocketEvent, useSocketStatus } from "@/hooks/useSocketEvent";
import type {
  AnySnapshot,
  GameState,
  LobbyClosedPayload,
  LobbyPhase,
  LobbySettings,
  LobbyState,
  MpPlayer,
  MpResults,
} from "@/types/api";

/**
 * Multiplayer identity plus the latest server snapshot.
 *
 * What this deliberately does *not* do:
 * - expose `setupSocketListeners`/`cleanupSocketListeners`. v1 did, the lobby
 *   destructured `cleanupSocketListeners` and never called it, and every page
 *   wired its own duplicate listeners on top.
 * - keep its own copy of the game settings. Settings live on the server; we read
 *   them from the snapshot and never persist them.
 * - use localStorage as an event bus. There is exactly one namespaced key, it
 *   holds only identity, and it exists so a reload can rejoin.
 */

const STORAGE_KEY = "quizzatron:multiplayer";

export interface MultiplayerIdentity {
  playerId: string;
  playerName: string;
  avatar: string;
  lobbyCode: string;
}

/** The lobby fields every snapshot shape shares, normalised. */
export interface LobbySnapshot {
  lobbyCode: string;
  hostId: string;
  state: LobbyPhase;
  started: boolean;
  generating: boolean;
  settings: LobbySettings;
  players: MpPlayer[];
  questionCount: number;
}

interface MultiplayerContextValue {
  identity: MultiplayerIdentity | null;
  /** The local player as the server sees them, when they are in the snapshot. */
  self: MpPlayer | null;
  isHost: boolean;
  snapshot: LobbySnapshot | null;
  results: MpResults | null;
  status: SocketStatus;
  /** Set when the server closed the lobby out from under us. */
  closed: LobbyClosedPayload | null;

  /** Remember who we are, persist it, and join the socket room. */
  signIn: (identity: MultiplayerIdentity) => void;
  /** Forget identity, snapshot and results, and leave the room. */
  signOut: () => void;
  /** Record a locally chosen avatar so a rejoin keeps it. */
  rememberAvatar: (avatar: string) => void;
  /** Feed in a snapshot fetched over REST (initial load, recovery). */
  applySnapshot: (snapshot: LobbyState | GameState | AnySnapshot) => void;
  setResults: (results: MpResults) => void;
  acknowledgeClosed: () => void;
}

const MultiplayerContext = createContext<MultiplayerContextValue | undefined>(undefined);

function readStoredIdentity(): MultiplayerIdentity | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    const { playerId, playerName, avatar, lobbyCode } = record;
    if (typeof playerId !== "string" || typeof lobbyCode !== "string") return null;
    if (!playerId || !lobbyCode) return null;
    return {
      playerId,
      lobbyCode,
      playerName: typeof playerName === "string" ? playerName : "Player",
      avatar: typeof avatar === "string" && avatar ? avatar : "🐶",
    };
  } catch {
    return null;
  }
}

function writeStoredIdentity(identity: MultiplayerIdentity | null): void {
  try {
    if (identity) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Private browsing can refuse writes. A reload just cannot auto-rejoin.
  }
}

function normalise(payload: AnySnapshot): LobbySnapshot | null {
  if (!isSnapshot(payload)) return null;
  const state = payload.state;
  return {
    lobbyCode: payload.lobbyCode,
    hostId: typeof payload.hostId === "string" ? payload.hostId : "",
    state,
    started: payload.started ?? state !== "lobby",
    generating: payload.generating ?? false,
    settings: payload.settings,
    players: payload.players,
    questionCount: payload.questionCount ?? 0,
  };
}

export function MultiplayerProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<MultiplayerIdentity | null>(readStoredIdentity);
  const [snapshot, setSnapshot] = useState<LobbySnapshot | null>(null);
  const [results, setResults] = useState<MpResults | null>(null);
  const [closed, setClosed] = useState<LobbyClosedPayload | null>(null);
  const status = useSocketStatus();

  // One place decides what the socket's identity is, and it re-joins on every
  // reconnect from inside the client.
  useEffect(() => {
    if (!identity) {
      socketClient.setIdentity(null);
      return;
    }
    socketClient.connect();
    socketClient.setIdentity({
      lobbyCode: identity.lobbyCode,
      playerId: identity.playerId,
    });
  }, [identity]);

  const ingest = useCallback((payload: AnySnapshot) => {
    const next = normalise(payload);
    if (next) setSnapshot(next);
  }, []);

  useSocketEvent("lobby:joined", ingest);
  useSocketEvent("lobby:update", ingest);
  useSocketEvent("game:question", ingest);

  useSocketEvent("game:started", (payload) => {
    // A restart reuses the lobby, so last round's results have to go or the
    // quiz screen would bounce straight back to the results screen.
    setResults(null);
    // The server builds this payload before it advances to the first question,
    // so it still reads `state: "lobby"`. Stamping `started` here is what stops
    // the quiz screen from bouncing everyone back to the lobby on kick-off.
    ingest({ ...payload, started: true });
  });

  useSocketEvent("game:reveal", (payload) => {
    // Keep the shared player list in step so the scoreboard does not need its
    // own copy of everyone's score (v1 had five separate implementations).
    setSnapshot((current) =>
      current ? { ...current, players: payload.players } : current,
    );
  });

  useSocketEvent("game:over", (payload) => {
    setResults(payload);
    setSnapshot((current) =>
      current
        ? { ...current, state: "game_over", players: payload.players, started: true }
        : current,
    );
  });

  useSocketEvent("lobby:closed", (payload) => {
    setClosed(payload);
    setSnapshot(null);
  });

  const signIn = useCallback((next: MultiplayerIdentity) => {
    writeStoredIdentity(next);
    setIdentity(next);
    setClosed(null);
    setResults(null);
  }, []);

  const signOut = useCallback(() => {
    writeStoredIdentity(null);
    setIdentity(null);
    setSnapshot(null);
    setResults(null);
    setClosed(null);
    socketClient.setIdentity(null);
  }, []);

  const rememberAvatar = useCallback((avatar: string) => {
    setIdentity((current) => {
      if (!current) return current;
      const next = { ...current, avatar };
      writeStoredIdentity(next);
      return next;
    });
  }, []);

  const acknowledgeClosed = useCallback(() => setClosed(null), []);

  const self = useMemo(() => {
    if (!identity || !snapshot) return null;
    return snapshot.players.find((player) => player.id === identity.playerId) ?? null;
  }, [identity, snapshot]);

  const value = useMemo<MultiplayerContextValue>(
    () => ({
      identity,
      self,
      isHost: Boolean(identity && snapshot && snapshot.hostId === identity.playerId),
      snapshot,
      results,
      status,
      closed,
      signIn,
      signOut,
      rememberAvatar,
      applySnapshot: ingest,
      setResults,
      acknowledgeClosed,
    }),
    [
      identity,
      self,
      snapshot,
      results,
      status,
      closed,
      signIn,
      signOut,
      rememberAvatar,
      ingest,
      acknowledgeClosed,
    ],
  );

  return (
    <MultiplayerContext.Provider value={value}>{children}</MultiplayerContext.Provider>
  );
}

export function useMultiplayer(): MultiplayerContextValue {
  const context = useContext(MultiplayerContext);
  if (!context) {
    throw new Error("useMultiplayer must be used inside <MultiplayerProvider>");
  }
  return context;
}

/**
 * The single Socket.IO client for the app.
 *
 * Kept from v1: `on(event, handler)` returns an unsubscribe closure and handlers
 * live in a `Map`, so a component can register and tear down cleanly.
 *
 * Fixed from v1:
 * - No `alert()`, no `console.*`, and no React hooks (`useToast`/`useLocation`
 *   were imported into what was otherwise a plain class, which only worked by
 *   accident).
 * - `lobby:join` is re-emitted on **every** `connect`, including reconnects. v1
 *   logged "Automatically rejoining room" and never actually emitted, so a
 *   transport blip left the client deaf for the rest of the game.
 * - Connection status is observable rather than guessed at from a boolean that
 *   three different components each kept their own copy of.
 */

import type { Socket } from "socket.io-client";

import { SOCKET_URL } from "./config";
import type {
  AnySnapshot,
  ClientEventName,
  ClientEvents,
  GameState,
  LobbyState,
  ServerEventName,
  ServerEvents,
} from "@/types/api";

export type SocketStatus = "idle" | "connecting" | "connected" | "reconnecting" | "error";

export interface SocketIdentity {
  lobbyCode: string;
  playerId: string;
}

type Handler = (payload: unknown) => void;

/**
 * Exponential backoff with jitter, capped so a long outage keeps retrying at a
 * sane rate instead of hammering the server or giving up on the game.
 */
const SOCKET_OPTIONS = {
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  reconnectionDelayMax: 10_000,
  randomizationFactor: 0.5,
  timeout: 10_000,
} as const;

/** Every server event we listen for. Attached once per socket instance. */
const SERVER_EVENTS: readonly ServerEventName[] = [
  "connection:ready",
  "lobby:joined",
  "lobby:update",
  "lobby:closed",
  "game:started",
  "game:question",
  "game:answered",
  "game:reveal",
  "game:over",
  "error",
];

class SocketClient {
  private socket: Socket | null = null;
  private readonly handlers = new Map<ServerEventName, Set<Handler>>();
  private readonly statusHandlers = new Set<(status: SocketStatus) => void>();
  private identity: SocketIdentity | null = null;
  private currentStatus: SocketStatus = "idle";
  private loading = false;

  get status(): SocketStatus {
    return this.currentStatus;
  }

  /**
   * Open the connection, or do nothing if one already exists.
   *
   * The transport is imported on demand so that the ~40 kB of socket.io never
   * lands in the bundle for someone who only plays solo.
   */
  connect(): void {
    if (this.socket) {
      if (!this.socket.connected) this.socket.connect();
      return;
    }
    if (this.loading) return;

    this.loading = true;
    this.setStatus("connecting");

    void import("socket.io-client")
      .then(({ io }) => {
        this.loading = false;
        // `disconnect()` may have been called while the chunk was in flight.
        if (this.socket || this.currentStatus === "idle") return;
        this.attach(io(SOCKET_URL, SOCKET_OPTIONS));
      })
      .catch(() => {
        this.loading = false;
        this.setStatus("error");
      });
  }

  private attach(socket: Socket): void {
    // Two overlapping connect() calls must never leave two live sockets.
    if (this.socket) {
      socket.disconnect();
      return;
    }
    // Assigned before the listeners so `emitJoin` can see it from `connect`.
    this.socket = socket;

    socket.on("connect", () => {
      this.setStatus("connected");
      // Rejoin on every connect, reconnects included. This is the fix that keeps
      // a mid-game reconnect receiving broadcasts.
      this.emitJoin();
    });

    socket.on("disconnect", () => {
      this.setStatus(this.identity ? "reconnecting" : "idle");
    });

    socket.io.on("reconnect_attempt", () => this.setStatus("reconnecting"));
    socket.io.on("error", () => this.setStatus("error"));
    socket.on("connect_error", () => {
      this.setStatus(this.currentStatus === "connected" ? "reconnecting" : "error");
    });

    for (const event of SERVER_EVENTS) {
      socket.on(event, (payload: unknown) => this.dispatch(event, payload));
    }
  }

  /** Close the connection and forget the identity. Handlers stay registered. */
  disconnect(): void {
    this.identity = null;
    this.loading = false;
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.setStatus("idle");
  }

  /**
   * Declare who we are. Emits `lobby:join` straight away when already
   * connected, and is replayed on every subsequent `connect`. Passing `null`
   * tears the connection down — there is nothing to listen for without a lobby.
   */
  setIdentity(identity: SocketIdentity | null): void {
    if (!identity) {
      this.disconnect();
      return;
    }
    this.identity = identity;
    this.connect();
    this.emitJoin();
  }

  /** Subscribe to a server event. Returns the unsubscribe closure. */
  on<E extends ServerEventName>(
    event: E,
    handler: (payload: ServerEvents[E]) => void,
  ): () => void {
    const set = this.handlers.get(event) ?? new Set<Handler>();
    const wrapped = handler as Handler;
    set.add(wrapped);
    this.handlers.set(event, set);

    return () => {
      const current = this.handlers.get(event);
      if (!current) return;
      current.delete(wrapped);
      if (current.size === 0) this.handlers.delete(event);
    };
  }

  /** Subscribe to connection-status changes. Fires immediately with the current value. */
  onStatus(handler: (status: SocketStatus) => void): () => void {
    this.statusHandlers.add(handler);
    handler(this.currentStatus);
    return () => {
      this.statusHandlers.delete(handler);
    };
  }

  /** Send a typed client event. Silently ignored when the socket is down. */
  emit<E extends ClientEventName>(event: E, payload: ClientEvents[E]): void {
    this.socket?.emit(event, payload);
  }

  private emitJoin(): void {
    const identity = this.identity;
    if (!identity || !this.socket?.connected) return;
    this.socket.emit("lobby:join", identity);
  }

  private dispatch(event: ServerEventName, payload: unknown): void {
    const set = this.handlers.get(event);
    if (!set) return;
    // Copy first: a handler is allowed to unsubscribe itself.
    for (const handler of Array.from(set)) handler(payload);
  }

  private setStatus(status: SocketStatus): void {
    if (this.currentStatus === status) return;
    this.currentStatus = status;
    for (const handler of Array.from(this.statusHandlers)) handler(status);
  }
}

export const socketClient = new SocketClient();

/* --------------------------------------------------------------- narrowing */

/** True when a `lobby:joined` payload actually carries a lobby snapshot. */
export function isSnapshot(value: AnySnapshot): value is AnySnapshot &
  Pick<LobbyState, "lobbyCode" | "players" | "settings" | "state"> {
  return (
    typeof value.lobbyCode === "string" &&
    Array.isArray(value.players) &&
    typeof value.settings === "object" &&
    value.settings !== null &&
    typeof value.state === "string"
  );
}

/** True when a snapshot is the in-game shape (it has a server clock). */
export function isGameSnapshot(value: AnySnapshot): value is GameState {
  return (
    isSnapshot(value) &&
    typeof value.deadlineMs === "number" &&
    typeof value.serverNowMs === "number" &&
    typeof value.questionIndex === "number"
  );
}

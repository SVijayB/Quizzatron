import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Link2,
  Loader2,
  LogOut,
  Play,
  WifiOff,
} from "lucide-react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  AvatarPicker,
  Button,
  CodeDisplay,
  Input,
  Label,
  Panel,
  PanelHeader,
  PanelTitle,
  useToast,
} from "@/components/ui";
import { useMultiplayer } from "@/contexts/MultiplayerContext";
import { useSocketEvent } from "@/hooks/useSocketEvent";
import { LobbySettingsForm } from "@/features/lobby/LobbySettingsForm";
import { PlayerList } from "@/features/lobby/PlayerList";
import { DEFAULT_AVATAR_EMOJI, getRandomEmoji } from "@/lib/avatars";
import { ApiError, errorMessage, isAbortError } from "@/services/http";
import {
  getLobbyState,
  joinLobby,
  leaveLobby,
  setReady,
  startGame,
  updateAvatar,
  updateSettings,
} from "@/services/multiplayerApi";
import { getCategories, getModels } from "@/services/quizApi";
import { socketClient } from "@/services/socket";
import type { LobbySettings } from "@/types/api";

const NAME_MAX = 20;

/**
 * The lobby.
 *
 * The bug this rewrite exists to kill: v1 required `contextLobbyCode === urlCode`
 * before it would render anything, so a pasted invite link — where the context is
 * empty by definition — was permanently un-joinable. Here the URL is the source
 * of truth and a visitor who is not yet a member gets a join form.
 */
export default function MultiplayerLobby() {
  const { lobbyCode: rawCode } = useParams<{ lobbyCode: string }>();
  const lobbyCode = (rawCode ?? "").trim().toUpperCase();
  const navigate = useNavigate();
  const { toast } = useToast();

  const {
    identity,
    snapshot,
    self,
    isHost,
    status,
    closed,
    signIn,
    signOut,
    rememberAvatar,
    applySnapshot,
    acknowledgeClosed,
  } = useMultiplayer();

  const joined = Boolean(identity && identity.lobbyCode === lobbyCode);

  const [joinName, setJoinName] = useState(() => identity?.playerName ?? "");
  const [joinAvatar, setJoinAvatar] = useState(
    () => identity?.avatar ?? getRandomEmoji(),
  );
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const modelsQuery = useQuery({
    queryKey: ["models"],
    queryFn: ({ signal }) => getModels(signal),
    staleTime: 5 * 60_000,
  });
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: ({ signal }) => getCategories(signal),
    staleTime: 10 * 60_000,
  });

  /* ------------------------------------------------------------- recovery */

  useEffect(() => {
    if (!joined || !lobbyCode) return;
    const controller = new AbortController();

    getLobbyState(lobbyCode, controller.signal)
      .then((state) => {
        setLoadError(null);
        applySnapshot(state);
      })
      .catch((caught: unknown) => {
        if (isAbortError(caught)) return;
        setLoadError(errorMessage(caught, "Could not load that lobby."));
      });

    return () => controller.abort();
  }, [applySnapshot, joined, lobbyCode]);

  /* --------------------------------------------------------------- events */

  useSocketEvent("error", (payload) => {
    toast({
      variant: "destructive",
      title: "Lobby error",
      description: payload.message,
    });
  });

  useSocketEvent("game:started", () => {
    // `replace` so the browser Back button cannot drop a player back into a
    // lobby screen for a game that is already in progress.
    navigate(`/multiplayer/quiz/${lobbyCode}`, { replace: true });
  });

  useEffect(() => {
    if (!closed) return;
    toast({
      variant: "destructive",
      title: "Lobby closed",
      description: closed.reason,
    });
    acknowledgeClosed();
    signOut();
    navigate("/multiplayer", { replace: true });
  }, [acknowledgeClosed, closed, navigate, signOut, toast]);

  // A reload mid-game, or a game that is already over, lands on the right screen.
  useEffect(() => {
    const state = snapshot?.state;
    // The lobbyCode guard matters: the snapshot can still describe the *previous*
    // lobby for the instant between joining a new one and its first update.
    if (!joined || !state || snapshot?.lobbyCode !== lobbyCode) return;
    if (state === "question" || state === "reveal") {
      navigate(`/multiplayer/quiz/${lobbyCode}`, { replace: true });
    } else if (state === "game_over") {
      navigate(`/multiplayer/results/${lobbyCode}`, { replace: true });
    }
  }, [joined, lobbyCode, navigate, snapshot?.lobbyCode, snapshot?.state]);

  /* -------------------------------------------------------------- actions */

  /** Prefer the socket; fall back to REST so a dropped socket is not a dead end. */
  const send = useCallback(
    (viaSocket: () => void, viaRest: () => Promise<unknown>) => {
      if (socketClient.status === "connected") {
        viaSocket();
        return;
      }
      viaRest().catch((caught: unknown) => {
        if (isAbortError(caught)) return;
        toast({
          variant: "destructive",
          title: "That did not go through",
          description: errorMessage(caught),
        });
      });
    },
    [toast],
  );

  const onJoin = async () => {
    const name = joinName.trim();
    if (!name) {
      setJoinError("Enter a name first.");
      return;
    }

    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setJoining(true);
    setJoinError(null);

    try {
      const response = await joinLobby(
        { lobbyCode, playerName: name, avatar: joinAvatar },
        controller.signal,
      );
      signIn({
        playerId: response.playerId,
        playerName: name,
        avatar: joinAvatar,
        lobbyCode: response.lobbyCode,
      });
      applySnapshot(response.lobby);
    } catch (caught) {
      if (controller.signal.aborted) return;
      setJoinError(errorMessage(caught, "Could not join that lobby."));
    } finally {
      if (!controller.signal.aborted) setJoining(false);
    }
  };

  const onToggleReady = () => {
    if (!identity || !self) return;
    const next = !self.ready;
    send(
      () =>
        socketClient.emit("lobby:ready", {
          lobbyCode,
          playerId: identity.playerId,
          ready: next,
        }),
      () => setReady({ lobbyCode, playerId: identity.playerId, ready: next }),
    );
  };

  const onChangeAvatar = (avatar: string) => {
    if (!identity) return;
    rememberAvatar(avatar);
    send(
      () =>
        socketClient.emit("lobby:avatar", {
          lobbyCode,
          playerId: identity.playerId,
          avatar,
        }),
      () => updateAvatar({ lobbyCode, playerId: identity.playerId, avatar }),
    );
  };

  const onChangeSettings = (patch: Partial<LobbySettings>) => {
    if (!identity) return;
    send(
      () =>
        socketClient.emit("lobby:settings", {
          lobbyCode,
          playerId: identity.playerId,
          settings: patch,
        }),
      () => updateSettings({ lobbyCode, playerId: identity.playerId, settings: patch }),
    );
  };

  const onStart = async () => {
    if (!identity) return;
    setStarting(true);
    try {
      // Deliberately REST: the response tells us whether generation was accepted,
      // and the server then broadcasts `game:started` to everyone including us.
      await startGame({ lobbyCode, playerId: identity.playerId });
    } catch (caught) {
      toast({
        variant: "destructive",
        title: "Could not start",
        description: errorMessage(caught),
      });
    } finally {
      setStarting(false);
    }
  };

  const onLeave = async () => {
    if (identity) {
      try {
        await leaveLobby({ lobbyCode, playerId: identity.playerId });
      } catch (caught) {
        // Leaving locally must succeed even if the call does not.
        if (caught instanceof ApiError && caught.status === 0) {
          toast({ description: "You left, but the server was unreachable." });
        }
      }
    }
    signOut();
    navigate("/multiplayer", { replace: true });
  };

  const copyInvite = async () => {
    const url = `${window.location.origin}/multiplayer/lobby/${lobbyCode}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ variant: "success", title: "Invite link copied" });
    } catch {
      toast({
        title: "Copy the link from the address bar",
        description: url,
      });
    }
  };

  /* --------------------------------------------------------------- render */

  if (!lobbyCode) {
    return <LobbyProblem message="That link has no lobby code in it." />;
  }

  if (joined && loadError) {
    return (
      <LobbyProblem
        message={loadError}
        onReset={() => {
          signOut();
          navigate("/multiplayer", { replace: true });
        }}
      />
    );
  }

  const disconnected = status !== "connected" && status !== "idle";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-3 pb-[max(2rem,env(safe-area-inset-bottom))] pt-6 sm:px-5">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/multiplayer">
            <ArrowLeft aria-hidden="true" />
            Multiplayer
          </Link>
        </Button>
      </div>

      <header className="flex flex-col gap-3">
        <h1 className="font-display text-3xl uppercase leading-none tracking-tightest sm:text-4xl">
          Lobby
        </h1>
        <CodeDisplay code={lobbyCode} label="Share this code" />
        <div>
          <Button variant="secondary" size="md" onClick={() => void copyInvite()}>
            <Link2 aria-hidden="true" />
            Copy invite link
          </Button>
        </div>
        {disconnected ? (
          <p
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 rounded border-2 border-ink-line bg-ink-raised px-3 py-2 text-sm font-semibold text-bone-dim"
          >
            <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
            {status === "reconnecting" ? "Reconnecting…" : "Connecting…"}
          </p>
        ) : null}
      </header>

      {!joined ? (
        <Panel as="section" padded="md" className="flex flex-col gap-4">
          <PanelHeader>
            <PanelTitle as="h2">Join this lobby</PanelTitle>
          </PanelHeader>

          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void onJoin();
            }}
          >
            <div className="flex items-end gap-4">
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Label htmlFor="join-name">Display name</Label>
                <Input
                  id="join-name"
                  value={joinName}
                  maxLength={NAME_MAX}
                  onChange={(event) => setJoinName(event.target.value)}
                  placeholder="Your name"
                  autoComplete="nickname"
                />
              </div>
              <div className="flex flex-col items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-bone-dim">
                  Avatar
                </span>
                <AvatarPicker
                  value={joinAvatar || DEFAULT_AVATAR_EMOJI}
                  onChange={setJoinAvatar}
                  size={56}
                />
              </div>
            </div>

            {joinError ? (
              <p
                role="alert"
                className="flex items-start gap-2 rounded border-2 border-ink-line bg-hot p-3 text-sm font-semibold text-ink"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="break-words">{joinError}</span>
              </p>
            ) : null}

            <Button type="submit" size="lg" block disabled={joining}>
              {joining ? (
                <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />
              ) : (
                <Check aria-hidden="true" />
              )}
              {joining ? "Joining…" : "Join lobby"}
            </Button>
          </form>
        </Panel>
      ) : (
        <>
          {snapshot?.generating ? (
            <Panel as="section" tone="accent" padded="md">
              <p role="status" aria-live="polite" className="flex items-center gap-2 font-bold uppercase">
                <Loader2 className="h-5 w-5 motion-safe:animate-spin" aria-hidden="true" />
                Building the quiz…
              </p>
            </Panel>
          ) : null}

          <PlayerList
            players={snapshot?.players ?? []}
            selfId={identity?.playerId ?? null}
          />

          <Panel as="section" padded="md" className="flex flex-col gap-4">
            <PanelHeader>
              <PanelTitle as="h2" className="text-lg sm:text-xl">
                You
              </PanelTitle>
            </PanelHeader>

            <div className="flex flex-wrap items-center gap-4">
              <AvatarPicker
                value={self?.avatar ?? identity?.avatar ?? DEFAULT_AVATAR_EMOJI}
                onChange={onChangeAvatar}
                size={56}
                label="Change your avatar"
              />
              <div className="min-w-0 flex-1">
                <p className="break-words font-display text-lg uppercase tracking-display">
                  {self?.name ?? identity?.playerName}
                </p>
                <p className="text-xs text-bone-dim">
                  {isHost ? "You are the host." : "Waiting for the host to start."}
                </p>
              </div>
            </div>

            <Button
              variant={self?.ready ? "success" : "primary"}
              size="lg"
              block
              onClick={onToggleReady}
              aria-pressed={Boolean(self?.ready)}
            >
              <Check aria-hidden="true" />
              {self?.ready ? "Ready — tap to unready" : "I'm ready"}
            </Button>
          </Panel>

          {snapshot ? (
            <LobbySettingsForm
              settings={snapshot.settings}
              readOnly={!isHost}
              onChange={onChangeSettings}
              models={modelsQuery.data?.models ?? []}
              categories={categoriesQuery.data?.categories ?? []}
            />
          ) : null}

          {isHost ? (
            <Button
              size="lg"
              block
              onClick={() => void onStart()}
              disabled={starting || snapshot?.generating || (snapshot?.players.length ?? 0) === 0}
            >
              {starting || snapshot?.generating ? (
                <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />
              ) : (
                <Play aria-hidden="true" />
              )}
              {starting || snapshot?.generating ? "Starting…" : "Start game"}
            </Button>
          ) : null}

          <Button variant="ghost" onClick={() => setConfirmLeave(true)}>
            <LogOut aria-hidden="true" />
            Leave lobby
          </Button>

          <ConfirmDialog
            open={confirmLeave}
            onOpenChange={setConfirmLeave}
            title="Leave this lobby?"
            description="You will drop out of the game. The host can invite you back with the same code."
            confirmLabel="Leave"
            destructive
            onConfirm={() => void onLeave()}
          />
        </>
      )}
    </div>
  );
}

function LobbyProblem({
  message,
  onReset,
}: {
  message: string;
  onReset?: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-3 pt-8 sm:px-5">
      <Panel as="section" padded="lg" className="flex flex-col gap-4">
        <h1 className="flex items-center gap-2 font-display text-2xl uppercase tracking-display">
          <AlertTriangle className="h-6 w-6 shrink-0 text-hot" aria-hidden="true" />
          Lobby unavailable
        </h1>
        <p role="alert" className="break-words text-sm text-bone">
          {message}
        </p>
        {onReset ? (
          <Button onClick={onReset}>Back to multiplayer</Button>
        ) : (
          <Button asChild>
            <Link to="/multiplayer">Back to multiplayer</Link>
          </Button>
        )}
      </Panel>
    </div>
  );
}

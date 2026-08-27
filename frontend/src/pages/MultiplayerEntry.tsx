import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, LogIn, Loader2, Plus } from "lucide-react";

import {
  AvatarPicker,
  Button,
  Input,
  Label,
  Panel,
  PanelHeader,
  PanelTitle,
  Separator,
} from "@/components/ui";
import { useMultiplayer } from "@/contexts/MultiplayerContext";
import { getRandomEmoji } from "@/lib/avatars";
import { errorMessage } from "@/services/http";
import { createLobby, joinLobby } from "@/services/multiplayerApi";

const CODE_LENGTH = 6;
const NAME_MAX = 20;

type Busy = "none" | "creating" | "joining";

export default function MultiplayerEntry() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { identity, signIn } = useMultiplayer();

  const [name, setName] = useState(() => identity?.playerName ?? "");
  // A new player gets a random avatar rather than everyone sharing the default.
  const [avatar, setAvatar] = useState(() => identity?.avatar ?? getRandomEmoji());
  const [code, setCode] = useState(() =>
    (params.get("code") ?? "").trim().toUpperCase().slice(0, CODE_LENGTH),
  );
  const [busy, setBusy] = useState<Busy>("none");
  const [error, setError] = useState<string | null>(null);

  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const trimmedName = name.trim();

  const run = async (kind: Exclude<Busy, "none">) => {
    if (!trimmedName) {
      setError("Enter a name so everyone knows who you are.");
      return;
    }
    if (kind === "joining" && code.trim().length !== CODE_LENGTH) {
      setError(`A lobby code is ${CODE_LENGTH} characters.`);
      return;
    }

    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setBusy(kind);
    setError(null);

    try {
      const response =
        kind === "creating"
          ? await createLobby({ hostName: trimmedName, avatar }, controller.signal)
          : await joinLobby(
              { lobbyCode: code.trim(), playerName: trimmedName, avatar },
              controller.signal,
            );

      signIn({
        playerId: response.playerId,
        playerName: trimmedName,
        avatar,
        lobbyCode: response.lobbyCode,
      });
      navigate(`/multiplayer/lobby/${response.lobbyCode}`);
    } catch (caught) {
      if (controller.signal.aborted) return;
      setError(errorMessage(caught, "Could not reach the lobby."));
    } finally {
      if (!controller.signal.aborted) setBusy("none");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-3 pb-[max(2rem,env(safe-area-inset-bottom))] pt-6 sm:px-5">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/">
            <ArrowLeft aria-hidden="true" />
            Home
          </Link>
        </Button>
      </div>

      <h1 className="font-display text-3xl uppercase leading-none tracking-tightest sm:text-5xl">
        Multiplayer
      </h1>

      {identity ? (
        <Panel as="section" tone="sunken" padded="sm" className="flex flex-col gap-3">
          <p className="text-sm text-bone-dim">
            You were last in lobby{" "}
            <span className="font-mono font-bold text-acid">{identity.lobbyCode}</span>.
          </p>
          <Button asChild variant="secondary">
            <Link to={`/multiplayer/lobby/${identity.lobbyCode}`}>Rejoin that lobby</Link>
          </Button>
        </Panel>
      ) : null}

      <Panel as="section" padded="md">
        <PanelHeader>
          <PanelTitle as="h2">Who are you?</PanelTitle>
        </PanelHeader>

        <div className="flex items-end gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Label htmlFor="player-name">Display name</Label>
            <Input
              id="player-name"
              value={name}
              maxLength={NAME_MAX}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              autoComplete="nickname"
            />
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-bone-dim">
              Avatar
            </span>
            <AvatarPicker value={avatar} onChange={setAvatar} size={56} />
          </div>
        </div>
      </Panel>

      <Panel as="section" padded="md" className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <PanelTitle as="h2">Start a new lobby</PanelTitle>
          <p className="text-sm text-bone-dim">
            You become the host and pick the settings.
          </p>
          <Button
            size="lg"
            block
            disabled={busy !== "none"}
            onClick={() => void run("creating")}
          >
            {busy === "creating" ? (
              <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />
            ) : (
              <Plus aria-hidden="true" />
            )}
            {busy === "creating" ? "Creating…" : "Create lobby"}
          </Button>
        </div>

        <Separator />

        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void run("joining");
          }}
        >
          <PanelTitle as="h2">Join with a code</PanelTitle>
          <Label htmlFor="lobby-code">Lobby code</Label>
          <Input
            id="lobby-code"
            value={code}
            onChange={(event) =>
              setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_LENGTH))
            }
            placeholder="ABC234"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className="font-mono text-2xl tracking-widest"
          />
          <Button
            type="submit"
            variant="secondary"
            size="lg"
            block
            disabled={busy !== "none"}
          >
            {busy === "joining" ? (
              <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />
            ) : (
              <LogIn aria-hidden="true" />
            )}
            {busy === "joining" ? "Joining…" : "Join lobby"}
          </Button>
        </form>

        {error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded border-2 border-ink-line bg-hot p-3 text-sm font-semibold text-ink"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="break-words">{error}</span>
          </p>
        ) : null}
      </Panel>
    </div>
  );
}

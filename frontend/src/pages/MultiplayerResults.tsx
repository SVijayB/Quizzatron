import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Home as HomeIcon,
  Loader2,
  LogOut,
  RefreshCw,
  RotateCcw,
} from "lucide-react";

import {
  Button,
  Panel,
  PanelHeader,
  PanelTitle,
  Skeleton,
  useToast,
} from "@/components/ui";
import { useMultiplayer } from "@/contexts/MultiplayerContext";
import { PlayerList } from "@/features/lobby/PlayerList";
import { Podium, type PodiumEntry } from "@/features/results/Podium";
import { QuestionReview, type ReviewItem } from "@/features/results/QuestionReview";
import { useConfetti } from "@/lib/confetti";
import { errorMessage } from "@/services/http";
import { getResults, restartGame } from "@/services/multiplayerApi";

/**
 * Final standings.
 *
 * The authority is `GET /api/multiplayer/results/:code`; the `game:over` payload
 * in context seeds it so the screen paints instantly. v1 could only read a
 * localStorage cache, so anyone who missed the socket event got "No Results
 * Found" and had no way back.
 */
export default function MultiplayerResults() {
  const { lobbyCode: rawCode } = useParams<{ lobbyCode: string }>();
  const lobbyCode = (rawCode ?? "").trim().toUpperCase();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { identity, results: cached, isHost, signOut, snapshot } = useMultiplayer();
  const fireConfetti = useConfetti();

  const [restarting, setRestarting] = useState(false);

  // When the host resets the lobby the server broadcasts `lobby:update` with the
  // state back to "lobby", which is everyone's cue to follow them there.
  useEffect(() => {
    if (snapshot?.state === "lobby" && snapshot.lobbyCode === lobbyCode) {
      navigate(`/multiplayer/lobby/${lobbyCode}`, { replace: true });
    }
  }, [lobbyCode, navigate, snapshot?.lobbyCode, snapshot?.state]);

  const seed = cached && cached.lobbyCode === lobbyCode ? cached : undefined;

  const query = useQuery({
    queryKey: ["mp-results", lobbyCode],
    queryFn: ({ signal }) => getResults(lobbyCode, signal),
    initialData: seed,
    enabled: lobbyCode.length > 0,
    retry: 1,
  });

  const results = query.data;
  const players = useMemo(() => results?.players ?? [], [results?.players]);
  const playerId = identity?.playerId ?? null;
  const self = playerId ? players.find((player) => player.id === playerId) : undefined;
  const won = players.length > 0 && players[0]?.id === playerId;

  useEffect(() => {
    if (won) fireConfetti();
  }, [fireConfetti, won]);

  const podium = useMemo<PodiumEntry[]>(
    () =>
      players.slice(0, 3).map((player) => ({
        id: player.id,
        name: player.name,
        avatar: player.avatar,
        score: player.score,
        detail: `${player.correctCount} right`,
        isSelf: player.id === playerId,
      })),
    [players, playerId],
  );

  const review = useMemo<ReviewItem[]>(() => {
    if (!results || !self) return [];
    return results.questions.map((question) => {
      // `question.index` is 1-based; answers are keyed by the 0-based round index.
      const answer = self.answers?.find(
        (entry) => entry.questionIndex === question.index - 1,
      );
      return {
        number: question.index,
        text: question.question,
        options: question.options,
        correctIndex: question.correctIndex,
        explanation: question.explanation,
        selectedIndex: answer?.selectedIndex ?? null,
        timedOut: answer?.timedOut ?? true,
        isCorrect: answer?.isCorrect ?? false,
        points: answer?.points ?? null,
      };
    });
  }, [results, self]);

  const onRestart = async () => {
    if (!identity) return;
    setRestarting(true);
    try {
      await restartGame({ lobbyCode, playerId: identity.playerId });
      navigate(`/multiplayer/lobby/${lobbyCode}`);
    } catch (caught) {
      toast({
        variant: "destructive",
        title: "Could not restart",
        description: errorMessage(caught),
      });
    } finally {
      setRestarting(false);
    }
  };

  if (query.isPending && !results) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-3 pt-6 sm:px-5">
        <h1 className="font-display text-3xl uppercase tracking-tightest">Results</h1>
        <Panel as="section" padded="lg" className="flex flex-col gap-3">
          <p role="status" aria-live="polite" className="text-sm text-bone-dim">
            Loading the final scores…
          </p>
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-16 w-full" />
        </Panel>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-3 pt-8 sm:px-5">
        <Panel as="section" padded="lg" className="flex flex-col gap-4">
          <h1 className="flex items-center gap-2 font-display text-2xl uppercase tracking-display">
            <AlertTriangle className="h-6 w-6 shrink-0 text-hot" aria-hidden="true" />
            No results yet
          </h1>
          <p role="alert" className="break-words text-sm text-bone">
            {errorMessage(query.error, "Those results are not available.")}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={() => void query.refetch()}>
              <RefreshCw aria-hidden="true" />
              Try again
            </Button>
            <Button asChild variant="secondary">
              <Link to="/multiplayer">Back to multiplayer</Link>
            </Button>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-3 pb-[max(2rem,env(safe-area-inset-bottom))] pt-6 sm:px-5">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl uppercase leading-none tracking-tightest sm:text-5xl">
          Final scores
        </h1>
        <p className="font-mono text-xs uppercase tracking-widest text-bone-dim">
          Lobby {results.lobbyCode} · {results.questionCount} questions
        </p>
      </header>

      <Panel as="section" padded="lg">
        <p role="status" aria-live="polite" className="mb-5 text-center text-sm font-bold uppercase tracking-wide">
          {self
            ? won
              ? "You won."
              : `You finished with ${self.score} points, ${self.correctCount} of ${results.questionCount} right.`
            : "Here is how everyone did."}
        </p>
        <Podium entries={podium} />
      </Panel>

      <PlayerList
        players={players}
        selfId={playerId}
        showReady={false}
        showScore
      />

      <Panel as="section" padded="md" className="flex flex-col gap-3">
        <PanelHeader>
          <PanelTitle as="h2" className="text-lg sm:text-xl">
            What next
          </PanelTitle>
        </PanelHeader>

        <div className="flex flex-col gap-3">
          {isHost ? (
            <Button size="lg" block onClick={() => void onRestart()} disabled={restarting}>
              {restarting ? (
                <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />
              ) : (
                <RotateCcw aria-hidden="true" />
              )}
              {restarting ? "Resetting…" : "Play again with the same crew"}
            </Button>
          ) : (
            <p
              role="status"
              aria-live="polite"
              className="rounded border-2 border-ink-line bg-ink-sunken p-3 text-sm text-bone-dim"
            >
              Stay here — if the host starts another round you will be taken
              straight to the lobby.
            </p>
          )}

          <Button
            variant="ghost"
            onClick={() => {
              signOut();
              navigate("/multiplayer", { replace: true });
            }}
          >
            <LogOut aria-hidden="true" />
            Leave this lobby
          </Button>

          <Button asChild variant="ghost">
            <Link to="/">
              <HomeIcon aria-hidden="true" />
              Home
            </Link>
          </Button>
        </div>
      </Panel>

      {review.length > 0 ? (
        <QuestionReview items={review} title="Your answers" />
      ) : null}
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/ui";
import { useMultiplayer } from "@/contexts/MultiplayerContext";
import { useSocketEvent } from "@/hooks/useSocketEvent";
import { QuizRunner } from "@/features/quiz/QuizRunner";
import { useMultiplayerQuiz } from "@/features/quiz/useMultiplayerQuiz";
import { leaveLobby } from "@/services/multiplayerApi";

/**
 * Multiplayer play. Everything on screen comes from `useMultiplayerQuiz`, which
 * only ever reports what the server said — no local grading, no local scoring,
 * and no "request next question" path (the server advances rounds).
 *
 * `lobby:join` is re-emitted from here too, via the socket client, on every
 * connect. v1 only wired that up in the lobby, so a reconnect during play left
 * the client deaf for the rest of the game.
 */
export default function MultiplayerQuiz() {
  const { lobbyCode: rawCode } = useParams<{ lobbyCode: string }>();
  const lobbyCode = (rawCode ?? "").trim().toUpperCase();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { identity, status, closed, results, snapshot, signOut, acknowledgeClosed } =
    useMultiplayer();
  const engine = useMultiplayerQuiz(lobbyCode);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const isMember = Boolean(identity && identity.lobbyCode === lobbyCode);

  // Not a member (a pasted mid-game link, or a cleared identity): the lobby page
  // knows how to get them in.
  useEffect(() => {
    if (!isMember) navigate(`/multiplayer/lobby/${lobbyCode}`, { replace: true });
  }, [isMember, lobbyCode, navigate]);

  // Landed here before kick-off (a bookmarked URL, or a restart): the lobby is
  // the right screen. `started` is what distinguishes "not begun" from the
  // moment the server emits `game:started` while still reading state "lobby".
  useEffect(() => {
    if (
      snapshot?.lobbyCode === lobbyCode &&
      snapshot.state === "lobby" &&
      !snapshot.started
    ) {
      navigate(`/multiplayer/lobby/${lobbyCode}`, { replace: true });
    }
  }, [lobbyCode, navigate, snapshot?.lobbyCode, snapshot?.started, snapshot?.state]);

  const toResults = () =>
    navigate(`/multiplayer/results/${lobbyCode}`, { replace: true });

  useSocketEvent("game:over", () => toResults());

  useEffect(() => {
    if (results) navigate(`/multiplayer/results/${lobbyCode}`, { replace: true });
  }, [lobbyCode, navigate, results]);

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

  const onLeave = async () => {
    if (identity) {
      try {
        await leaveLobby({ lobbyCode, playerId: identity.playerId });
      } catch {
        // Leaving locally must work regardless.
      }
    }
    signOut();
    navigate("/multiplayer", { replace: true });
  };

  return (
    <>
      <QuizRunner
        engine={engine}
        heading="Live quiz"
        quitLabel="Leave"
        onQuit={() => setConfirmLeave(true)}
        connectionNote={
          status === "connected" || status === "idle"
            ? null
            : status === "reconnecting"
              ? "Reconnecting to the game…"
              : "Connecting to the game…"
        }
      />

      <ConfirmDialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        title="Leave the game?"
        description="Your score stays on the scoreboard, but you will stop playing."
        confirmLabel="Leave"
        destructive
        onConfirm={() => void onLeave()}
      />
    </>
  );
}

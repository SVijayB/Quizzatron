import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useCountdown } from "@/hooks/useCountdown";
import { useSocketEvent } from "@/hooks/useSocketEvent";
import { useMultiplayer } from "@/contexts/MultiplayerContext";
import { socketClient } from "@/services/socket";
import { ApiError, errorMessage, isAbortError } from "@/services/http";
import { getGameState, submitAnswer } from "@/services/multiplayerApi";
import type { GameRevealPayload, GameState } from "@/types/api";
import type { AnswerOutcome, QuizEngine, QuizPhase, ScoreRow } from "./types";

/**
 * Server-driven play. This hook never grades anything and never computes a
 * score: the in-play question carries no `correctIndex`, the reveal supplies it,
 * and points arrive already calculated.
 *
 * The countdown is derived from `deadlineMs` against the server's own
 * `serverNowMs`, so a player with a skewed system clock sees the same clock as
 * everyone else.
 */
export function useMultiplayerQuiz(lobbyCode: string): QuizEngine {
  const { identity, snapshot, results, applySnapshot } = useMultiplayer();

  const [game, setGame] = useState<GameState | null>(null);
  const [offsetMs, setOffsetMs] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [reveal, setReveal] = useState<GameRevealPayload | null>(null);
  const [revealTimer, setRevealTimer] = useState<{
    deadlineMs: number;
    totalMs: number;
  } | null>(null);
  const [answeredIds, setAnsweredIds] = useState<ReadonlySet<string>>(new Set());
  const [progress, setProgress] = useState<{ answered: number; total: number } | null>(
    null,
  );
  const [errorText, setErrorText] = useState<string | null>(null);
  /** Bumped by `retry` to re-run the recovery fetch. */
  const [reloadKey, setReloadKey] = useState(0);

  /** Question indices we have already answered. The server is idempotent, but
   * there is no reason to send a duplicate. */
  const emitted = useRef<Set<number>>(new Set());

  const playerId = identity?.playerId ?? null;

  // The context already ingests `game:question` into the shared snapshot, so
  // this only tracks the round-local state.
  const ingestGame = useCallback((payload: GameState) => {
    setGame(payload);
    setOffsetMs(payload.serverNowMs - Date.now());
    setReveal(null);
    setRevealTimer(null);
    setProgress(null);
    setAnsweredIds(new Set());
    setSelectedIndex(null);
    setErrorText(null);
  }, []);

  useSocketEvent("game:question", ingestGame);

  useSocketEvent("game:answered", (payload) => {
    setAnsweredIds((current) => {
      const next = new Set(current);
      next.add(payload.playerId);
      return next;
    });
    setProgress({ answered: payload.answeredCount, total: payload.totalPlayers });
  });

  useSocketEvent("game:reveal", (payload) => {
    setReveal(payload);
    // Expressed on the server clock so one offset covers both countdowns.
    setRevealTimer({
      deadlineMs: Date.now() + offsetMs + payload.nextInMs,
      totalMs: payload.nextInMs,
    });
    setProgress(null);
  });

  // A restart replays question indices from zero, so the duplicate guard has to
  // be cleared or the first answer of round two would be swallowed.
  useSocketEvent("game:started", () => {
    emitted.current.clear();
    setReveal(null);
    setRevealTimer(null);
    setSelectedIndex(null);
    setAnsweredIds(new Set());
  });

  useSocketEvent("error", (payload) => setErrorText(payload.message));

  // Recovery path: a reload, or arriving before the first broadcast. The socket
  // also re-emits `lobby:join` on connect, which replies with a snapshot.
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    getGameState(lobbyCode, controller.signal)
      .then((state) => {
        if (cancelled) return;
        // Only seed; a live `game:question` always wins.
        setGame((current) => current ?? state);
        setOffsetMs((current) =>
          current === 0 ? state.serverNowMs - Date.now() : current,
        );
        applySnapshot(state);
      })
      .catch((error: unknown) => {
        if (cancelled || isAbortError(error)) return;
        // 409 means "not started yet". That is the normal race at kick-off — the
        // lobby navigates here on `game:started`, which the server emits just
        // before it opens the first question. The socket delivers it moments
        // later, so surfacing this as an error would only flash a false failure.
        if (error instanceof ApiError && error.status === 409) return;
        setErrorText(errorMessage(error, "Could not load the game."));
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [applySnapshot, lobbyCode, reloadKey]);

  const retry = useCallback(() => {
    setErrorText(null);
    socketClient.connect();
    setReloadKey((key) => key + 1);
  }, []);

  const question = game?.question ?? null;
  const questionIndex = game?.questionIndex ?? -1;
  const revealForThisQuestion =
    reveal && reveal.questionIndex === questionIndex ? reveal : null;

  const players = useMemo(
    () => snapshot?.players ?? game?.players ?? [],
    [game?.players, snapshot?.players],
  );
  const self = playerId
    ? (players.find((player) => player.id === playerId) ?? null)
    : null;

  const generating = snapshot?.generating ?? false;
  const gameOver = snapshot?.state === "game_over" || results !== null;

  const phase: QuizPhase = useMemo(() => {
    if (gameOver) return "finished";
    if (errorText && !question) return "error";
    if (!question || generating) return "loading";
    if (revealForThisQuestion) return "reveal";
    return selectedIndex === null ? "question" : "waiting";
  }, [errorText, gameOver, generating, question, revealForThisQuestion, selectedIndex]);

  /* ------------------------------------------------------------------ clock */

  const perQuestionMs = (snapshot?.settings.timePerQuestion ?? 15) * 1000;

  const activeDeadline = revealForThisQuestion
    ? (revealTimer?.deadlineMs ?? null)
    : (game?.deadlineMs ?? null);

  const countdown = useCountdown({
    deadlineMs: phase === "question" || phase === "waiting" || phase === "reveal"
      ? activeDeadline
      : null,
    offsetMs,
    intervalMs: 150,
  });

  /* ----------------------------------------------------------------- answer */

  const select = useCallback(
    (index: number) => {
      if (!identity || !game?.question || selectedIndex !== null) return;
      const target = game.questionIndex;
      setSelectedIndex(index);
      if (emitted.current.has(target)) return;
      emitted.current.add(target);

      const payload = {
        lobbyCode,
        playerId: identity.playerId,
        questionIndex: target,
        selectedIndex: index,
      };

      if (socketClient.status === "connected") {
        socketClient.emit("game:answer", payload);
        return;
      }

      // Socket is down: the REST endpoint records the same answer, so a blip
      // does not cost the player the question.
      submitAnswer(payload).catch((error: unknown) => {
        if (isAbortError(error)) return;
        setErrorText(errorMessage(error, "Could not send your answer."));
      });
    },
    [game, identity, lobbyCode, selectedIndex],
  );

  /* ------------------------------------------------------------- scoreboard */

  const scoreboard: ScoreRow[] = useMemo(() => {
    const breakdown = new Map(
      (revealForThisQuestion?.breakdown ?? []).map((entry) => [entry.playerId, entry]),
    );

    return players.map((player) => {
      const entry = breakdown.get(player.id);
      let outcome: AnswerOutcome = "unanswered";
      if (entry) {
        outcome = entry.timedOut ? "timedOut" : entry.isCorrect ? "correct" : "wrong";
      } else if (answeredIds.has(player.id) || (player.id === playerId && selectedIndex !== null)) {
        outcome = "answered";
      }

      return {
        id: player.id,
        name: player.name,
        avatar: player.avatar,
        score: player.score,
        correctCount: player.correctCount,
        connected: player.connected,
        isSelf: player.id === playerId,
        pointsThisRound: entry ? entry.points : null,
        outcome,
      };
    });
  }, [answeredIds, players, playerId, revealForThisQuestion, selectedIndex]);

  const selfBreakdown = revealForThisQuestion?.breakdown.find(
    (entry) => entry.playerId === playerId,
  );

  const waitingNote = useMemo(() => {
    if (revealForThisQuestion) {
      return revealForThisQuestion.isLastQuestion
        ? "Last question — results coming up."
        : "Next question shortly.";
    }
    if (progress) {
      return `${progress.answered} of ${progress.total} ${
        progress.total === 1 ? "player" : "players"
      } answered`;
    }
    if (selectedIndex !== null) return "Answer locked in. Waiting for the others.";
    return null;
  }, [progress, revealForThisQuestion, selectedIndex]);

  const subtitle = useMemo(() => {
    const topic = snapshot?.settings.topic ?? snapshot?.settings.category ?? null;
    return topic ? `${topic} · Lobby ${lobbyCode}` : `Lobby ${lobbyCode}`;
  }, [lobbyCode, snapshot]);

  return {
    mode: "multiplayer",
    phase,
    errorText,
    subtitle,
    question: question
      ? {
          number: question.index,
          text: question.question,
          options: question.options,
          imageUrl: question.imageUrl,
          difficulty: question.difficulty,
        }
      : null,
    questionCount: game?.questionCount ?? snapshot?.questionCount ?? 0,
    selectedIndex:
      selectedIndex ?? (revealForThisQuestion ? (selfBreakdown?.selectedIndex ?? null) : null),
    correctIndex: revealForThisQuestion ? revealForThisQuestion.correctIndex : null,
    explanation: revealForThisQuestion ? revealForThisQuestion.explanation : null,
    pointsThisRound: selfBreakdown ? selfBreakdown.points : null,
    remainingMs: activeDeadline === null ? null : countdown.remainingMs,
    totalMs: revealForThisQuestion ? (revealTimer?.totalMs ?? null) : perQuestionMs,
    score: self?.score ?? 0,
    correctCount: self?.correctCount ?? 0,
    scoreboard,
    waitingNote,
    canAnswer: phase === "question",
    select,
    retry,
  };
}

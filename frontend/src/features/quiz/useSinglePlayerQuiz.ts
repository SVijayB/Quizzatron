import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useCountdown } from "@/hooks/useCountdown";
import type { Difficulty, Question } from "@/types/api";
import type { QuizEngine, QuizPhase } from "./types";

/** How long the answer stays on screen before the next question. */
const REVEAL_MS = 2400;

export interface SoloAnswer {
  /** 1-based, matching `Question.index`. */
  questionIndex: number;
  selectedIndex: number | null;
  isCorrect: boolean;
  timedOut: boolean;
  elapsedMs: number;
}

/** Everything needed to play a solo run. Handed over by the Home page. */
export interface SoloRun {
  topic: string | null;
  difficulty: Difficulty;
  secondsPerQuestion: number;
  questions: Question[];
}

export interface SoloResult extends SoloRun {
  answers: SoloAnswer[];
  correctCount: number;
  totalTimeMs: number;
  completedAt: number;
}

interface Timer {
  kind: "question" | "reveal";
  deadlineMs: number;
  totalMs: number;
}

/**
 * Solo play. This is the one mode that legitimately holds `correct_index`, so it
 * grades locally — no round trip per answer.
 */
export function useSinglePlayerQuiz(
  run: SoloRun | null,
  onFinish: (result: SoloResult) => void,
): QuizEngine {
  const [phase, setPhase] = useState<QuizPhase>("idle");
  const [index, setIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [answers, setAnswers] = useState<SoloAnswer[]>([]);
  const [timer, setTimer] = useState<Timer | null>(null);

  const questionStartedAt = useRef(0);
  const finishedOnce = useRef(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  // Guards a second answer for the same question without making `lockAnswer`
  // depend on `phase` (which would re-arm the countdown on every reveal).
  const answerableRef = useRef(false);

  const perQuestionMs = Math.max(5, run?.secondsPerQuestion ?? 20) * 1000;
  const question = run?.questions[index] ?? null;

  const beginQuestion = useCallback(
    (next: number) => {
      setIndex(next);
      setSelectedIndex(null);
      setPhase("question");
      answerableRef.current = true;
      questionStartedAt.current = Date.now();
      setTimer({
        kind: "question",
        deadlineMs: Date.now() + perQuestionMs,
        totalMs: perQuestionMs,
      });
    },
    [perQuestionMs],
  );

  const lockAnswer = useCallback(
    (chosen: number | null) => {
      const current = run?.questions[index];
      if (!current || !answerableRef.current) return;
      answerableRef.current = false;

      const elapsedMs = Math.max(0, Date.now() - questionStartedAt.current);
      setSelectedIndex(chosen);
      setAnswers((previous) =>
        previous.some((entry) => entry.questionIndex === current.index)
          ? previous
          : [
              ...previous,
              {
                questionIndex: current.index,
                selectedIndex: chosen,
                isCorrect: chosen !== null && chosen === current.correct_index,
                timedOut: chosen === null,
                elapsedMs: Math.min(elapsedMs, perQuestionMs),
              },
            ],
      );
      setPhase("reveal");
      setTimer({
        kind: "reveal",
        deadlineMs: Date.now() + REVEAL_MS,
        totalMs: REVEAL_MS,
      });
    },
    [index, perQuestionMs, run],
  );

  const advance = useCallback(() => {
    const total = run?.questions.length ?? 0;
    const next = index + 1;
    if (next >= total) {
      setTimer(null);
      setPhase("finished");
      return;
    }
    beginQuestion(next);
  }, [beginQuestion, index, run]);

  const countdown = useCountdown({
    deadlineMs: timer?.deadlineMs ?? null,
    intervalMs: 100,
    onExpire: () => {
      if (timer?.kind === "question") lockAnswer(null);
      else if (timer?.kind === "reveal") advance();
    },
  });

  // Report the run exactly once, from state that is guaranteed to include the
  // final answer.
  useEffect(() => {
    if (phase !== "finished" || !run || finishedOnce.current) return;
    finishedOnce.current = true;
    onFinishRef.current({
      ...run,
      answers,
      correctCount: answers.filter((entry) => entry.isCorrect).length,
      totalTimeMs: answers.reduce((sum, entry) => sum + entry.elapsedMs, 0),
      completedAt: Date.now(),
    });
  }, [answers, phase, run]);

  const start = useCallback(() => beginQuestion(0), [beginQuestion]);

  const correctCount = useMemo(
    () => answers.filter((entry) => entry.isCorrect).length,
    [answers],
  );

  const revealed = phase === "reveal";

  return {
    mode: "solo",
    phase,
    errorText: null,
    subtitle: run?.topic ? `${run.topic} · ${run.difficulty}` : null,
    question: question
      ? {
          number: question.index,
          text: question.question,
          options: question.options,
          imageUrl: question.image_url,
          difficulty: question.difficulty,
        }
      : null,
    questionCount: run?.questions.length ?? 0,
    selectedIndex,
    correctIndex: revealed && question ? question.correct_index : null,
    explanation: revealed && question ? question.explanation : null,
    pointsThisRound: null,
    remainingMs: timer ? countdown.remainingMs : null,
    totalMs: timer?.totalMs ?? null,
    score: correctCount,
    correctCount,
    scoreboard: [],
    waitingNote: null,
    canAnswer: phase === "question",
    select: lockAnswer,
    start: phase === "idle" ? start : undefined,
  };
}

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, LogOut, RefreshCw, WifiOff } from "lucide-react";

import {
  Button,
  Panel,
  Progress,
  Skeleton,
  TimerBar,
} from "@/components/ui";
import { AnswerGrid } from "./AnswerGrid";
import { CountdownGate } from "./CountdownGate";
import { FeedbackBanner } from "./FeedbackBanner";
import { QuestionCard } from "./QuestionCard";
import { ScoreBoard } from "./ScoreBoard";
import type { AnswerOutcome, QuizEngine } from "./types";

interface QuizRunnerProps {
  engine: QuizEngine;
  /** The page's single `<h1>`. */
  heading: string;
  onQuit: () => void;
  quitLabel?: string;
  /** Shown when the socket is not currently connected. */
  connectionNote?: string | null;
}

/** Seconds remaining at which the clock is announced. */
const TIME_WARNINGS = [10, 5] as const;

/**
 * Announces the clock a couple of times per question instead of on every tick.
 * `TimerBar` carries `role="timer"`, which assistive tech deliberately does not
 * read continuously, so without this a screen-reader user has no idea the clock
 * is running out.
 */
function useTimeAnnouncement(
  remainingMs: number | null,
  questionNumber: number | undefined,
  active: boolean,
): string {
  const [message, setMessage] = useState("");
  const announced = useRef<Set<number>>(new Set());
  const forQuestion = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (forQuestion.current === questionNumber) return;
    forQuestion.current = questionNumber;
    announced.current.clear();
    setMessage("");
  }, [questionNumber]);

  useEffect(() => {
    if (!active || remainingMs === null) return;
    const seconds = Math.ceil(remainingMs / 1000);
    for (const threshold of TIME_WARNINGS) {
      if (seconds <= threshold && !announced.current.has(threshold)) {
        announced.current.add(threshold);
        setMessage(`${threshold} seconds left`);
        return;
      }
    }
  }, [active, remainingMs]);

  return message;
}

function localOutcome(engine: QuizEngine): AnswerOutcome {
  if (engine.correctIndex === null) {
    return engine.selectedIndex === null ? "unanswered" : "answered";
  }
  if (engine.selectedIndex === null) return "timedOut";
  return engine.selectedIndex === engine.correctIndex ? "correct" : "wrong";
}

/**
 * The whole play experience for both modes, driven entirely by `engine`.
 *
 * This one component replaces `Quiz.tsx` (892 lines) and `MultiplayerQuiz.tsx`
 * (1,200 lines), which shared 165 identical lines, an 88%-identical question
 * card and a character-identical feedback overlay.
 */
export function QuizRunner({
  engine,
  heading,
  onQuit,
  quitLabel = "Quit",
  connectionNote = null,
}: QuizRunnerProps) {
  const {
    phase,
    question,
    questionCount,
    remainingMs,
    totalMs,
    scoreboard,
    errorText,
  } = engine;

  const outcome = localOutcome(engine);
  const revealed = engine.correctIndex !== null;
  const showFeedback = revealed || engine.selectedIndex !== null;
  const correctOption =
    engine.correctIndex !== null && question
      ? (question.options[engine.correctIndex] ?? null)
      : null;

  const timeAnnouncement = useTimeAnnouncement(
    remainingMs,
    question?.number,
    phase === "question",
  );

  const progressValue =
    questionCount > 0 && question
      ? ((question.number - (revealed ? 0 : 1)) / questionCount) * 100
      : 0;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 sm:px-5">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="break-words font-display text-2xl uppercase leading-none tracking-display sm:text-3xl">
              {heading}
            </h1>
            {engine.subtitle ? (
              <p className="mt-1 break-words text-sm text-bone-dim">{engine.subtitle}</p>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <p className="text-right">
              <span className="block text-[10px] font-bold uppercase tracking-widest text-bone-dim">
                Score
              </span>
              <span className="font-mono text-2xl font-bold leading-none text-acid tabular-nums">
                {engine.score}
              </span>
            </p>
            <Button variant="ghost" size="md" onClick={onQuit}>
              <LogOut aria-hidden="true" />
              {quitLabel}
            </Button>
          </div>
        </div>

        {questionCount > 0 ? (
          <Progress
            value={progressValue}
            aria-label={`Progress: question ${question?.number ?? 0} of ${questionCount}`}
          />
        ) : null}

        {connectionNote ? (
          <p
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 rounded border-2 border-ink-line bg-ink-raised px-3 py-2 text-sm font-semibold text-bone-dim"
          >
            <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
            {connectionNote}
          </p>
        ) : null}
      </header>

      {phase === "idle" && engine.start ? (
        <CountdownGate
          onDone={engine.start}
          hint="Answer with the keyboard too: 1-4 or A-D."
        />
      ) : null}

      {phase === "loading" ? (
        <Panel as="section" padded="lg" className="flex flex-col gap-4">
          <p role="status" aria-live="polite" className="font-display text-xl uppercase tracking-display">
            Building your quiz…
          </p>
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-28 w-full" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Skeleton className="min-h-answer" />
            <Skeleton className="min-h-answer" />
            <Skeleton className="min-h-answer" />
            <Skeleton className="min-h-answer" />
          </div>
        </Panel>
      ) : null}

      {phase === "error" ? (
        <Panel as="section" padded="lg" className="flex flex-col gap-4">
          <h2 className="flex items-center gap-2 font-display text-xl uppercase tracking-display text-hot">
            <AlertTriangle className="h-6 w-6 shrink-0" aria-hidden="true" />
            That did not work
          </h2>
          <p role="alert" className="break-words text-sm text-bone">
            {errorText ?? "Something went wrong."}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            {engine.retry ? (
              <Button onClick={engine.retry}>
                <RefreshCw aria-hidden="true" />
                Try again
              </Button>
            ) : null}
            <Button variant="secondary" onClick={onQuit}>
              {quitLabel}
            </Button>
          </div>
        </Panel>
      ) : null}

      {phase === "finished" ? (
        <Panel as="section" padded="lg">
          <p role="status" aria-live="polite" className="font-display text-xl uppercase tracking-display">
            Totting up the scores…
          </p>
        </Panel>
      ) : null}

      {question && (phase === "question" || phase === "waiting" || phase === "reveal") ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="flex min-w-0 flex-col gap-4">
            <p role="status" aria-live="polite" className="sr-only">
              {timeAnnouncement}
            </p>

            {remainingMs !== null && totalMs !== null ? (
              <TimerBar
                remaining={remainingMs / 1000}
                total={totalMs / 1000}
                label={phase === "reveal" ? "Next" : undefined}
              />
            ) : null}

            <QuestionCard question={question} questionCount={questionCount}>
              <AnswerGrid
                options={question.options}
                selectedIndex={engine.selectedIndex}
                correctIndex={engine.correctIndex}
                locked={!engine.canAnswer}
                onSelect={engine.select}
                questionNumber={question.number}
              />
            </QuestionCard>

            {showFeedback ? (
              <FeedbackBanner
                outcome={outcome}
                correctOption={correctOption}
                explanation={revealed ? engine.explanation : null}
                pointsThisRound={revealed ? engine.pointsThisRound : null}
                waitingNote={engine.waitingNote}
              />
            ) : (
              <p className="text-sm text-bone-dim">
                Pick an answer. Keyboard: 1-4 or A-D.
              </p>
            )}
          </div>

          {scoreboard.length > 0 ? (
            <ScoreBoard
              rows={scoreboard}
              showOutcome={phase === "reveal" || phase === "waiting"}
              className="lg:sticky lg:top-4 lg:self-start"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

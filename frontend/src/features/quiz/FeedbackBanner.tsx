import { Check, Hourglass, Info, TimerOff, X } from "lucide-react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { useReducedMotionSafe } from "@/lib/motion";
import type { AnswerOutcome } from "./types";

interface FeedbackBannerProps {
  outcome: AnswerOutcome;
  /** The correct option's text, once revealed. */
  correctOption: string | null;
  explanation: string | null;
  pointsThisRound: number | null;
  /** e.g. "2 of 4 players answered" — shown while the clock is still running. */
  waitingNote: string | null;
}

const OUTCOME_COPY: Record<
  AnswerOutcome,
  { title: string; icon: typeof Check; tone: string }
> = {
  correct: { title: "Correct", icon: Check, tone: "bg-go text-ink" },
  wrong: { title: "Wrong", icon: X, tone: "bg-hot text-ink" },
  timedOut: { title: "Out of time", icon: TimerOff, tone: "bg-hot text-ink" },
  answered: { title: "Answer locked in", icon: Hourglass, tone: "bg-acid text-ink" },
  unanswered: { title: "Pick an answer", icon: Info, tone: "bg-ink-raised text-bone" },
};

/**
 * The single feedback surface, and the only thing that announces the result.
 *
 * Correctness carries an icon *and* a word, never colour alone (WCAG 1.4.1), and
 * the whole thing is a polite live region — v1 never told a screen-reader user
 * whether they had been right.
 */
export function FeedbackBanner({
  outcome,
  correctOption,
  explanation,
  pointsThisRound,
  waitingNote,
}: FeedbackBannerProps) {
  const motionSafe = useReducedMotionSafe();
  const copy = OUTCOME_COPY[outcome];
  const Icon = copy.icon;

  const announcement = [
    copy.title,
    outcome === "wrong" || outcome === "timedOut"
      ? correctOption
        ? `The answer was ${correctOption}.`
        : null
      : null,
    pointsThisRound !== null && pointsThisRound > 0 ? `${pointsThisRound} points.` : null,
    explanation,
    waitingNote,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div role="status" aria-live="polite" aria-atomic="true">
      <span className="sr-only">{announcement}</span>

      <motion.div
        aria-hidden="true"
        variants={motionSafe.slideUp}
        initial="hidden"
        animate="show"
        className={cn(
          "flex flex-col gap-2 rounded-lg border-2 border-ink-line p-3 shadow-hard",
          copy.tone,
        )}
      >
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 shrink-0" />
          <span className="font-display text-lg uppercase leading-none tracking-display">
            {copy.title}
          </span>
          {pointsThisRound !== null && pointsThisRound > 0 ? (
            <span className="ml-auto rounded-full border-2 border-ink-line bg-ink px-2 py-0.5 font-mono text-sm font-bold text-acid">
              +{pointsThisRound}
            </span>
          ) : null}
        </div>

        {(outcome === "wrong" || outcome === "timedOut") && correctOption ? (
          <p className="break-words text-sm font-semibold">
            Answer: <span className="font-bold">{correctOption}</span>
          </p>
        ) : null}

        {explanation ? (
          <p className="break-words text-sm font-medium leading-snug">{explanation}</p>
        ) : null}

        {waitingNote ? (
          <p className="break-words text-xs font-bold uppercase tracking-wide">
            {waitingNote}
          </p>
        ) : null}
      </motion.div>
    </div>
  );
}

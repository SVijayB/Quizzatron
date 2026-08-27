import { Check, Hourglass, TimerOff, WifiOff, X } from "lucide-react";

import {
  AvatarEmojiBadge,
  Badge,
  Panel,
  PanelHeader,
  PanelTitle,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import type { AnswerOutcome, ScoreRow } from "./types";

interface ScoreBoardProps {
  rows: ScoreRow[];
  title?: string;
  /** Show each player's result for the round just revealed. */
  showOutcome?: boolean;
  className?: string;
}

const OUTCOME_META: Record<
  AnswerOutcome,
  { icon: typeof Check; label: string; className: string } | null
> = {
  correct: { icon: Check, label: "Right", className: "text-go" },
  wrong: { icon: X, label: "Wrong", className: "text-hot" },
  timedOut: { icon: TimerOff, label: "No answer", className: "text-hot" },
  answered: { icon: Hourglass, label: "Locked in", className: "text-acid" },
  unanswered: null,
};

/**
 * The one live scoreboard. v1 shipped five separate implementations, three of
 * them inside `MultiplayerQuiz.tsx`, which is why the mobile and desktop lists
 * could disagree about who was winning.
 */
export function ScoreBoard({
  rows,
  title = "Scores",
  showOutcome = false,
  className,
}: ScoreBoardProps) {
  if (rows.length === 0) return null;

  return (
    <Panel as="section" padded="sm" className={className}>
      <PanelHeader className="mb-3">
        <PanelTitle as="h2" className="text-lg sm:text-xl">
          {title}
        </PanelTitle>
        <span className="text-[11px] font-bold uppercase tracking-widest text-bone-dim">
          {rows.length} {rows.length === 1 ? "player" : "players"}
        </span>
      </PanelHeader>

      <ol className="flex flex-col gap-2">
        {rows.map((row, index) => {
          const meta = showOutcome ? OUTCOME_META[row.outcome] : null;
          const OutcomeIcon = meta?.icon;

          return (
            <li
              key={row.id}
              className={cn(
                "flex items-center gap-2 rounded border-2 px-2 py-2",
                row.isSelf
                  ? "border-acid bg-ink-sunken"
                  : "border-ink-line bg-ink-sunken",
                !row.connected && "opacity-60",
              )}
            >
              <span
                aria-hidden="true"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border-2 border-ink-line bg-ink font-mono text-xs font-bold text-bone-dim"
              >
                {index + 1}
              </span>

              {row.avatar ? (
                <AvatarEmojiBadge emoji={row.avatar} size={32} />
              ) : null}

              <span className="min-w-0 flex-1">
                <span className="block break-words text-sm font-bold leading-tight">
                  {row.name}
                  {row.isSelf ? (
                    <span className="ml-1 text-[10px] font-bold uppercase tracking-wide text-acid">
                      (you)
                    </span>
                  ) : null}
                </span>

                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-bone-dim">
                  <span>{row.correctCount} right</span>
                  {!row.connected ? (
                    <Badge variant="outline" className="border-ink-line">
                      <WifiOff aria-hidden="true" />
                      Disconnected
                    </Badge>
                  ) : null}
                  {meta && OutcomeIcon ? (
                    <span className={cn("flex items-center gap-1", meta.className)}>
                      <OutcomeIcon className="h-3 w-3" aria-hidden="true" />
                      {meta.label}
                      {row.pointsThisRound !== null && row.pointsThisRound > 0
                        ? ` +${row.pointsThisRound}`
                        : ""}
                    </span>
                  ) : null}
                </span>
              </span>

              <span className="shrink-0 font-mono text-lg font-bold tabular-nums text-acid">
                {row.score}
                <span className="sr-only"> points</span>
              </span>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

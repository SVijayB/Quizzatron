import { Check, TimerOff, X } from "lucide-react";

import { Badge, Panel } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface ReviewItem {
  /** 1-based question number. */
  number: number;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string | null;
  /** The viewer's pick, or null when they never answered. */
  selectedIndex: number | null;
  timedOut: boolean;
  isCorrect: boolean;
  /** Points scored, for modes that have them. */
  points?: number | null;
}

interface QuestionReviewProps {
  items: ReviewItem[];
  title?: string;
}

const LETTERS = ["A", "B", "C", "D"] as const;

function verdict(item: ReviewItem) {
  if (item.isCorrect) {
    return { icon: Check, label: "Correct", variant: "success" as const };
  }
  if (item.timedOut || item.selectedIndex === null) {
    return { icon: TimerOff, label: "No answer", variant: "danger" as const };
  }
  return { icon: X, label: "Wrong", variant: "danger" as const };
}

/**
 * Per-question review. Distinguishes a wrong pick from running out of time,
 * which v1 conflated into a single red "incorrect".
 */
export function QuestionReview({ items, title = "Question review" }: QuestionReviewProps) {
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="review-heading" className="flex flex-col gap-3">
      <h2
        id="review-heading"
        className="font-display text-xl uppercase tracking-display sm:text-2xl"
      >
        {title}
      </h2>

      <ol className="flex flex-col gap-3">
        {items.map((item) => {
          const meta = verdict(item);
          const Icon = meta.icon;

          return (
            <li key={item.number}>
              <Panel as="article" padded="sm" tone="default">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold uppercase tracking-widest text-bone-dim">
                    Question {item.number}
                  </span>
                  <span className="flex items-center gap-2">
                    {typeof item.points === "number" && item.points > 0 ? (
                      <span className="font-mono text-sm font-bold text-acid tabular-nums">
                        +{item.points}
                      </span>
                    ) : null}
                    <Badge variant={meta.variant}>
                      <Icon aria-hidden="true" />
                      {meta.label}
                    </Badge>
                  </span>
                </div>

                <h3 className="break-words font-sans text-base font-bold leading-snug">
                  {item.text}
                </h3>

                <ul className="mt-3 flex flex-col gap-1.5">
                  {item.options.map((option, index) => {
                    const isCorrect = index === item.correctIndex;
                    const isPicked = index === item.selectedIndex;
                    if (!isCorrect && !isPicked) {
                      return (
                        <li
                          key={index}
                          className="flex gap-2 rounded-sm px-2 py-1.5 text-sm text-bone-dim"
                        >
                          <span aria-hidden="true" className="font-mono font-bold">
                            {LETTERS[index] ?? index + 1}
                          </span>
                          <span className="min-w-0 break-words">{option}</span>
                        </li>
                      );
                    }

                    return (
                      <li
                        key={index}
                        className={cn(
                          "flex items-start gap-2 rounded-sm border-2 border-ink-line px-2 py-1.5 text-sm font-semibold",
                          isCorrect ? "bg-go text-ink" : "bg-hot text-ink",
                        )}
                      >
                        <span aria-hidden="true" className="font-mono font-bold">
                          {LETTERS[index] ?? index + 1}
                        </span>
                        <span className="min-w-0 flex-1 break-words">{option}</span>
                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide">
                          {isCorrect ? "Answer" : "Your pick"}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                {item.explanation ? (
                  <p className="mt-3 break-words border-t-2 border-ink-line pt-2 text-sm text-bone-dim">
                    {item.explanation}
                  </p>
                ) : null}
              </Panel>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

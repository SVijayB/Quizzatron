import * as React from "react";
import { Check, Circle, Minus, X } from "lucide-react";

import { cn } from "@/lib/utils";

export type AnswerLetter = "A" | "B" | "C" | "D";

export type AnswerState =
  /** Live question, not picked. */
  | "idle"
  /** The player picked this, answer not revealed yet. */
  | "selected"
  /** Revealed: this is the right answer. */
  | "correct"
  /** Revealed: the player picked this and it was wrong. */
  | "wrong"
  /** Revealed: neither the right answer nor the player's pick. */
  | "revealed-other";

interface StateStyle {
  shell: string;
  badge: string;
  /** Visible status text. Correctness is never signalled by colour alone. */
  label: string | null;
  icon: React.ComponentType<{ className?: string }> | null;
  /** Extra context for assistive tech. */
  announce: string | null;
}

const STATE_STYLES: Record<AnswerState, StateStyle> = {
  idle: {
    shell: "press bg-ink-raised text-bone hover:bg-ink hover:text-acid",
    badge: "bg-ink-sunken text-acid",
    label: null,
    icon: null,
    announce: null,
  },
  selected: {
    shell: "press bg-acid text-ink focus-visible:outline-bone",
    badge: "bg-ink text-acid",
    label: "Picked",
    icon: Circle,
    announce: "Your answer",
  },
  correct: {
    shell: "bg-go text-ink shadow-hard focus-visible:outline-bone",
    badge: "bg-ink text-go",
    label: "Correct",
    icon: Check,
    announce: "Correct answer",
  },
  wrong: {
    shell: "bg-hot text-ink shadow-hard focus-visible:outline-bone",
    badge: "bg-ink text-hot",
    label: "Wrong",
    icon: X,
    announce: "Wrong answer",
  },
  "revealed-other": {
    shell: "bg-ink-raised text-bone-dim shadow-hard-sm",
    badge: "bg-ink-sunken text-bone-dim",
    label: "Not it",
    icon: Minus,
    announce: "Incorrect option",
  },
};

const REVEALED: ReadonlySet<AnswerState> = new Set<AnswerState>([
  "correct",
  "wrong",
  "revealed-other",
]);

export interface AnswerButtonProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    "onSelect" | "children"
  > {
  letter: AnswerLetter;
  children: React.ReactNode;
  state?: AnswerState;
  /** Hard-disable (e.g. the clock ran out before an answer was locked in). */
  disabled?: boolean;
  onSelect?: () => void;
  /**
   * Whether this option is the player's own pick, for `aria-pressed`. Inferred
   * from `state` when omitted; pass it explicitly for a `correct` option the
   * player actually chose.
   */
  chosen?: boolean;
}

const AnswerButton = React.forwardRef<HTMLButtonElement, AnswerButtonProps>(
  (
    {
      letter,
      children,
      state = "idle",
      disabled = false,
      onSelect,
      chosen,
      className,
      onClick,
      ...props
    },
    ref,
  ) => {
    const style = STATE_STYLES[state];
    const revealed = REVEALED.has(state);
    const interactive = !disabled && !revealed;
    const isPressed =
      chosen ?? (state === "selected" || state === "wrong");
    const Icon = style.icon;

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (!interactive) {
        event.preventDefault();
        return;
      }
      onClick?.(event);
      onSelect?.();
    };

    return (
      <button
        ref={ref}
        type="button"
        // Revealed options stay focusable via aria-disabled so a keyboard or
        // screen-reader user can still read back the whole question.
        disabled={disabled || undefined}
        aria-disabled={interactive ? undefined : true}
        aria-pressed={isPressed}
        onClick={handleClick}
        className={cn(
          "flex w-full min-h-answer items-center gap-3 rounded-lg border-2 border-ink-line",
          "px-3 py-3 text-left",
          "disabled:opacity-60",
          style.shell,
          className,
        )}
        {...props}
      >
        <span
          aria-hidden="true"
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border-2 border-ink-line",
            "font-display text-xl leading-none",
            style.badge,
          )}
        >
          {letter}
        </span>

        <span className="min-w-0 flex-1 whitespace-normal break-words font-sans text-[15px] font-semibold leading-snug sm:text-base">
          <span className="sr-only">{`Option ${letter}: `}</span>
          {children}
        </span>

        {style.label && Icon ? (
          <span className="flex w-14 shrink-0 flex-col items-center gap-1">
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span className="text-[10px] font-bold uppercase tracking-wide leading-none">
              {style.label}
            </span>
          </span>
        ) : null}

        {style.announce ? (
          <span className="sr-only">{style.announce}</span>
        ) : null}
      </button>
    );
  },
);
AnswerButton.displayName = "AnswerButton";

export { AnswerButton };

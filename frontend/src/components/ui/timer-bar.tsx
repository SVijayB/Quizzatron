import * as React from "react";
import { AlarmClock } from "lucide-react";

import { cn } from "@/lib/utils";

export interface TimerBarProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "role"> {
  /** Seconds left. Clamped to [0, total]. */
  remaining: number;
  /** Seconds the question started with. */
  total: number;
  /** Number of lamps in the bar. */
  segments?: number;
  /** Short caption shown beside the readout. */
  label?: string;
}

type Zone = "safe" | "warn" | "danger";

const ZONE_FILL: Record<Zone, string> = {
  safe: "bg-acid",
  warn: "bg-acid-deep",
  danger: "bg-hot",
};

const ZONE_TEXT: Record<Zone, string> = {
  safe: "text-acid",
  warn: "text-acid-deep",
  danger: "text-hot",
};

/** Redundant, non-colour cue for the same information. */
const ZONE_WORD: Record<Zone, string> = {
  safe: "Time",
  warn: "Hurry",
  danger: "Low",
};

function zoneFor(ratio: number): Zone {
  if (ratio > 0.5) return "safe";
  if (ratio > 0.25) return "warn";
  return "danger";
}

/**
 * Segmented depleting timer, styled like a row of cabinet lamps going dark.
 * Colour is backed up by a numeric readout and a word, so the bar is never the
 * only cue (WCAG 1.4.1).
 */
const TimerBar = React.forwardRef<HTMLDivElement, TimerBarProps>(
  (
    { remaining, total, segments = 20, label, className, ...props },
    ref,
  ) => {
    const safeTotal = total > 0 ? total : 1;
    const clamped = Math.min(Math.max(remaining, 0), safeTotal);
    const ratio = clamped / safeTotal;
    const zone = zoneFor(ratio);
    const seconds = Math.ceil(clamped);
    const lit = clamped > 0 ? Math.max(1, Math.round(ratio * segments)) : 0;
    const caption = label ?? ZONE_WORD[zone];

    return (
      <div
        ref={ref}
        role="timer"
        aria-label={`Time remaining: ${seconds} of ${Math.ceil(safeTotal)} seconds`}
        className={cn("flex items-center gap-3", className)}
        {...props}
      >
        <div
          aria-hidden="true"
          className="flex min-w-0 flex-1 gap-[2px] rounded-sm border-2 border-ink-line bg-ink-sunken p-1 shadow-inset"
        >
          {Array.from({ length: segments }, (_, index) => (
            <span
              key={index}
              className={cn(
                "h-3 flex-1 rounded-[1px] transition-colors duration-fast ease-out sm:h-4",
                index < lit ? ZONE_FILL[zone] : "bg-ink-raised",
              )}
            />
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-1.5" aria-hidden="true">
          <AlarmClock className={cn("h-4 w-4", ZONE_TEXT[zone])} />
          <span
            className={cn(
              "font-mono text-lg font-bold leading-none tabular-nums",
              ZONE_TEXT[zone],
            )}
          >
            {seconds.toString().padStart(2, "0")}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wide leading-none text-bone-dim">
            {caption}
          </span>
        </div>
      </div>
    );
  },
);
TimerBar.displayName = "TimerBar";

export { TimerBar };

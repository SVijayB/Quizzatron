import { Crown } from "lucide-react";

import { AvatarEmojiBadge } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface PodiumEntry {
  id: string;
  name: string;
  /** Emoji avatar, or null. */
  avatar: string | null;
  score: number;
  /** Secondary line, e.g. "8 of 10 right". */
  detail?: string;
  isSelf?: boolean;
}

interface PodiumProps {
  /** Pre-ranked; only the first three are placed. */
  entries: PodiumEntry[];
}

/**
 * Visual order is 2-1-3 via flex `order`; heights are explicit so the blocks
 * step down without any absolute positioning.
 */
const PLACEMENT = [
  { order: "order-2", block: "h-24 sm:h-32 bg-acid", label: "1st", tile: "bg-acid" },
  { order: "order-1", block: "h-16 sm:h-24 bg-bone", label: "2nd", tile: "bg-bone" },
  {
    order: "order-3",
    block: "h-12 sm:h-16 bg-bone-dim",
    label: "3rd",
    tile: "bg-bone-dim",
  },
] as const;

/**
 * The 2-1-3 podium, rebuilt in Tailwind.
 *
 * Kept from v1: the arrangement, which was the one piece of real design intent
 * in the old app. Fixed: the blocks were fixed 90px-wide absolute boxes, so on a
 * 375px screen every name was truncated to about five characters. Heights are
 * explicit and the columns flex, names wrap, and the sparkle/shake/pulse-gold
 * animations are gone.
 *
 * DOM order is rank order (1st, 2nd, 3rd) so assistive tech reads the standings
 * correctly; only the visual order is 2-1-3.
 */
export function Podium({ entries }: PodiumProps) {
  const top = entries.slice(0, 3);
  if (top.length === 0) return null;

  return (
    <ol
      aria-label="Top three players"
      className="flex w-full items-end justify-center gap-2 sm:gap-4"
    >
      {top.map((entry, index) => {
        const place = PLACEMENT[index] ?? PLACEMENT[2];
        return (
          <li
            key={entry.id}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center gap-2",
              place.order,
            )}
          >
            {index === 0 ? (
              <Crown className="h-6 w-6 text-acid" aria-hidden="true" />
            ) : null}

            <AvatarEmojiBadge
              emoji={entry.avatar ?? "?"}
              size={48}
              className={place.tile}
            />

            <span className="w-full text-center">
              <span
                className={cn(
                  "block break-words text-sm font-bold leading-tight",
                  entry.isSelf && "text-acid",
                )}
              >
                {entry.name}
                {entry.isSelf ? <span className="sr-only"> (you)</span> : null}
              </span>
              {entry.detail ? (
                <span className="mt-0.5 block break-words text-[11px] font-semibold text-bone-dim">
                  {entry.detail}
                </span>
              ) : null}
            </span>

            <div
              className={cn(
                "flex w-full flex-col items-center justify-center gap-0.5 rounded-t border-2 border-b-0 border-ink-line px-1 pt-2",
                place.block,
              )}
            >
              <span className="font-display text-lg leading-none text-ink sm:text-2xl">
                {place.label}
              </span>
              <span className="font-mono text-xs font-bold leading-none text-ink tabular-nums sm:text-sm">
                {entry.score}
                <span className="sr-only"> points</span>
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

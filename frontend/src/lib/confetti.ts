import { useCallback } from "react";

import { useReducedMotionSafe } from "@/lib/motion";

/**
 * The confetti palette is read from the design tokens at call time rather than
 * duplicated as hex literals, so it cannot drift from `tokens.css`.
 */
const COLOUR_TOKENS = ["--color-acid", "--color-bone", "--color-go"] as const;

function palette(): string[] | undefined {
  const styles = window.getComputedStyle(document.documentElement);
  const values = COLOUR_TOKENS.map((token) =>
    styles.getPropertyValue(token).trim(),
  ).filter((value) => value.length > 0);
  return values.length > 0 ? values : undefined;
}

/**
 * Confetti, gated on `prefers-reduced-motion` and code-split.
 *
 * `canvas-confetti` is only fetched when it is actually going to fire, so users
 * who asked for reduced motion never download it.
 */
export function useConfetti(): () => void {
  const { reduced } = useReducedMotionSafe();

  return useCallback(() => {
    if (reduced) return;
    void import("canvas-confetti")
      .then(({ default: confetti }) => {
        confetti({
          particleCount: 90,
          spread: 70,
          startVelocity: 38,
          ticks: 160,
          origin: { y: 0.7 },
          colors: palette(),
          disableForReducedMotion: true,
        });
      })
      .catch(() => {
        // Decorative only. A failed chunk fetch must never break the page.
      });
  }, [reduced]);
}

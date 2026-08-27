import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A countdown driven by an absolute deadline on the **server's** clock.
 *
 * v1 decremented a float (`setInterval(() => setTime(prev => prev - 0.1), 100)`)
 * which drifted with every dropped frame and rendered values like
 * `6.799999999999999`. This computes the remainder from a fixed deadline on
 * every tick, in whole milliseconds, from a single interval.
 */

export interface CountdownOptions {
  /**
   * Deadline in ms since the epoch, on the server's clock. `null` clears the
   * countdown (between questions, or once the game is over).
   */
  deadlineMs: number | null;
  /**
   * `serverNowMs - Date.now()`, captured when the deadline was received. Keeps
   * a client with a skewed clock in step with everyone else.
   */
  offsetMs?: number;
  /** Tick period in ms. */
  intervalMs?: number;
  /** Fired once when the deadline passes. */
  onExpire?: () => void;
}

export interface Countdown {
  /** Whole milliseconds left, never negative. */
  remainingMs: number;
  /** Whole seconds left, rounded up — what a player expects to read. */
  remainingSeconds: number;
  /** True once the deadline has passed (and only when there was one). */
  expired: boolean;
}

function remainingFor(deadlineMs: number, offsetMs: number): number {
  return Math.max(0, Math.trunc(deadlineMs - (Date.now() + offsetMs)));
}

export function useCountdown({
  deadlineMs,
  offsetMs = 0,
  intervalMs = 200,
  onExpire,
}: CountdownOptions): Countdown {
  const [remainingMs, setRemainingMs] = useState(() =>
    deadlineMs === null ? 0 : remainingFor(deadlineMs, offsetMs),
  );

  // Keeping the callback in a ref means an inline arrow from the caller does not
  // restart the interval on every render.
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const firedFor = useRef<number | null>(null);

  const fireExpiry = useCallback((deadline: number) => {
    if (firedFor.current === deadline) return;
    firedFor.current = deadline;
    onExpireRef.current?.();
  }, []);

  useEffect(() => {
    if (deadlineMs === null) {
      setRemainingMs(0);
      firedFor.current = null;
      return;
    }

    const tick = () => {
      const next = remainingFor(deadlineMs, offsetMs);
      setRemainingMs(next);
      if (next === 0) fireExpiry(deadlineMs);
    };

    tick();
    const id = window.setInterval(tick, Math.max(50, intervalMs));
    return () => window.clearInterval(id);
  }, [deadlineMs, offsetMs, intervalMs, fireExpiry]);

  return {
    remainingMs,
    remainingSeconds: Math.ceil(remainingMs / 1000),
    expired: deadlineMs !== null && remainingMs === 0,
  };
}

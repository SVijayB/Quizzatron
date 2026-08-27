import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import { Button, Panel } from "@/components/ui";
import { useReducedMotionSafe } from "@/lib/motion";

interface CountdownGateProps {
  /** Seconds to count down from. */
  from?: number;
  /** Headline above the digits. */
  title?: string;
  hint?: string;
  onDone: () => void;
}

/**
 * "Get ready" pre-roll. The digits are decorative; the polite live region
 * carries the same information for assistive tech, and a Start now button means
 * nobody is forced to wait out the animation.
 */
export function CountdownGate({
  from = 3,
  title = "Get ready",
  hint,
  onDone,
}: CountdownGateProps) {
  const [remaining, setRemaining] = useState(from);
  const motionSafe = useReducedMotionSafe();

  useEffect(() => {
    if (remaining <= 0) {
      onDone();
      return;
    }
    const id = window.setTimeout(() => setRemaining((value) => value - 1), 1000);
    return () => window.clearTimeout(id);
    // `onDone` is stable in practice; re-running on identity change would reset
    // the timer mid-count.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  return (
    <Panel
      as="section"
      padded="lg"
      className="flex flex-col items-center gap-5 text-center"
    >
      <h2 className="font-display text-2xl uppercase tracking-display sm:text-3xl">
        {title}
      </h2>

      <motion.p
        key={remaining}
        aria-hidden="true"
        variants={motionSafe.pop}
        initial="hidden"
        animate="show"
        className="flex h-28 w-28 items-center justify-center rounded-lg border-3 border-ink-line bg-acid font-display text-6xl leading-none text-ink shadow-hard-lg"
      >
        {Math.max(remaining, 1)}
      </motion.p>

      <p role="status" aria-live="polite" className="text-sm font-semibold text-bone-dim">
        {remaining > 0
          ? `Starting in ${remaining} ${remaining === 1 ? "second" : "seconds"}`
          : "Starting now"}
      </p>

      {hint ? <p className="max-w-prose text-sm text-bone-dim">{hint}</p> : null}

      <Button variant="secondary" onClick={onDone}>
        Start now
      </Button>
    </Panel>
  );
}

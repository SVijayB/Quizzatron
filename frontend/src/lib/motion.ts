import { useMemo } from "react";
import {
  useReducedMotion,
  type Transition,
  type Variants,
} from "framer-motion";

/**
 * Shared motion vocabulary. Every animation in the app should come from here so
 * that (a) timings stay consistent and (b) `prefers-reduced-motion` is honoured
 * in exactly one place.
 *
 * Usage:
 *   const v = useReducedMotionSafe();
 *   <motion.div variants={v.slideUp} initial="hidden" animate="show" />
 */

/* ------------------------------------------------------------- transitions */

/** Snappy, arcade-ish spring. Good for entrances and pops. */
export const springSnappy: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 30,
  mass: 0.7,
};

/** Softer spring for larger surfaces (panels, dialogs). */
export const springSoft: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 26,
};

/** Stiff, near-instant spring matching the physical button press. */
export const springPress: Transition = {
  type: "spring",
  stiffness: 700,
  damping: 34,
};

export const easeOut: Transition = {
  duration: 0.22,
  ease: [0.22, 1, 0.36, 1],
};

/* ---------------------------------------------------------------- variants */

export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: easeOut },
  exit: { opacity: 0, transition: { duration: 0.12 } },
};

export const slideUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: springSoft },
  exit: { opacity: 0, y: 8, transition: { duration: 0.12 } },
};

export const slideDown: Variants = {
  hidden: { opacity: 0, y: -12 },
  show: { opacity: 1, y: 0, transition: springSoft },
  exit: { opacity: 0, y: -8, transition: { duration: 0.12 } },
};

export const pop: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  show: { opacity: 1, scale: 1, transition: springSnappy },
  exit: { opacity: 0, scale: 0.96, transition: { duration: 0.12 } },
};

/** Parent wrapper that cascades its children's `show` state. */
export const stagger: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.05, delayChildren: 0.04 },
  },
  exit: {},
};

/** Child of `stagger`. */
export const staggerItem: Variants = slideUp;

/**
 * Whole-page wrapper: fade plus a small rise. Deliberately understated so
 * route changes never feel like they block input.
 */
export const page: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: easeOut },
  exit: { opacity: 0, transition: { duration: 0.12 } },
};

const VARIANTS = {
  fade,
  slideUp,
  slideDown,
  pop,
  stagger,
  staggerItem,
  page,
} as const;

export type MotionVariantName = keyof typeof VARIANTS;
export type MotionVariantSet = Record<MotionVariantName, Variants>;

/**
 * Inert stand-ins: identical shape, no transform, no duration. Swapping these
 * in means callers never need their own `prefers-reduced-motion` branch.
 */
const INERT_VARIANTS: Variants = {
  hidden: { opacity: 1 },
  show: { opacity: 1, transition: { duration: 0 } },
  exit: { opacity: 1, transition: { duration: 0 } },
};

const INERT_SET: MotionVariantSet = (
  Object.keys(VARIANTS) as MotionVariantName[]
).reduce((acc, key) => {
  acc[key] = key === "stagger" ? { hidden: {}, show: {}, exit: {} } : INERT_VARIANTS;
  return acc;
}, {} as MotionVariantSet);

export interface ReducedMotionSafe extends MotionVariantSet {
  /** True when the user asked for reduced motion. */
  reduced: boolean;
  /** `springSnappy`, or an instant transition under reduced motion. */
  spring: Transition;
  /** `springSoft`, or an instant transition under reduced motion. */
  springSoft: Transition;
  /** `springPress`, or an instant transition under reduced motion. */
  springPress: Transition;
  /**
   * Wrap any ad-hoc transition so it collapses under reduced motion.
   * `transition(springSoft)` -> `{ duration: 0 }` when reduced.
   */
  transition: (value: Transition) => Transition;
}

const INSTANT: Transition = { duration: 0 };

/**
 * The single entry point for animation in this app. Returns the real variants
 * normally and inert ones when the user prefers reduced motion.
 */
export function useReducedMotionSafe(): ReducedMotionSafe {
  const reduced = useReducedMotion() ?? false;

  return useMemo(() => {
    const set = reduced ? INERT_SET : (VARIANTS as unknown as MotionVariantSet);
    return {
      ...set,
      reduced,
      spring: reduced ? INSTANT : springSnappy,
      springSoft: reduced ? INSTANT : springSoft,
      springPress: reduced ? INSTANT : springPress,
      transition: (value: Transition) => (reduced ? INSTANT : value),
    };
  }, [reduced]);
}

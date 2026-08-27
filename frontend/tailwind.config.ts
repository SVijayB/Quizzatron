import type { Config } from "tailwindcss";

/**
 * Quizzatron theme. Every value here resolves to a custom property declared in
 * src/styles/tokens.css — no raw colour literals live in this file.
 *
 * No `darkMode`: the app is dark by default and there is no theme switcher.
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    /*
     * Declared at theme level, not inside `extend`, so Tailwind's stock scales
     * are *removed*. That makes the prohibitions mechanical: `shadow-lg`,
     * `shadow-2xl`, `rounded-2xl` etc. simply do not exist any more.
     */
    borderRadius: {
      none: "0",
      sm: "var(--radius-sm)",
      DEFAULT: "var(--radius)",
      md: "var(--radius)",
      lg: "var(--radius-lg)",
      full: "var(--radius-full)",
    },
    boxShadow: {
      none: "none",
      "hard-sm": "var(--shadow-hard-sm)",
      hard: "var(--shadow-hard)",
      "hard-lg": "var(--shadow-hard-lg)",
      "hard-none": "var(--shadow-hard-none)",
      inset: "var(--shadow-inset)",
    },
    extend: {
      colors: {
        ink: {
          DEFAULT: "var(--color-ink)",
          raised: "var(--color-ink-raised)",
          sunken: "var(--color-ink-sunken)",
          line: "var(--color-ink-line)",
        },
        scrim: "var(--color-scrim)",
        bone: {
          DEFAULT: "var(--color-bone)",
          dim: "var(--color-bone-dim)",
        },
        acid: {
          DEFAULT: "var(--color-acid)",
          deep: "var(--color-acid-deep)",
        },
        hot: "var(--color-hot)",
        go: "var(--color-go)",
        sky: "var(--color-sky)",
      },
      fontFamily: {
        sans: ["Archivo", "system-ui", "-apple-system", "sans-serif"],
        display: ["Anton", "Impact", "system-ui", "sans-serif"],
        mono: ["'Space Mono'", "ui-monospace", "monospace"],
      },
      borderWidth: {
        2: "var(--border-width)",
        3: "var(--border-width-thick)",
      },
      transitionDuration: {
        press: "var(--dur-press)",
        fast: "var(--dur-fast)",
        base: "var(--dur-base)",
        slow: "var(--dur-slow)",
      },
      transitionTimingFunction: {
        out: "var(--ease-out)",
        "in-out": "var(--ease-in-out)",
      },
      letterSpacing: {
        tightest: "-0.03em",
        display: "-0.01em",
        wide: "0.04em",
        widest: "0.18em",
      },
      minHeight: {
        touch: "44px",
        answer: "56px",
      },
      minWidth: {
        touch: "44px",
      },
      zIndex: {
        sticky: "var(--z-sticky)",
        overlay: "var(--z-overlay)",
        toast: "var(--z-toast)",
      },
      keyframes: {
        // Only keyframes that are actually referenced by a component.
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.94)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "shadow-pulse": {
          "0%, 100%": { boxShadow: "var(--shadow-hard)" },
          "50%": { boxShadow: "var(--shadow-hard-lg)" },
        },
      },
      animation: {
        "pop-in": "pop-in var(--dur-base) var(--ease-out) both",
        "slide-up": "slide-up var(--dur-base) var(--ease-out) both",
        "shadow-pulse": "shadow-pulse 1.2s var(--ease-in-out) infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const panelVariants = cva("border-2 border-ink-line rounded-lg", {
  variants: {
    tone: {
      /** Raised surface — the default replacement for the old glass cards. */
      default: "bg-ink-raised text-bone shadow-hard",
      /** Inset well. Reads as carved into the cabinet, so no drop shadow. */
      sunken: "bg-ink-sunken text-bone shadow-inset",
      /** Loud, attention-grabbing panel. Ink text, never white. */
      accent: "bg-acid text-ink shadow-hard",
    },
    padded: {
      none: "",
      sm: "p-3",
      md: "p-4 sm:p-5",
      lg: "p-5 sm:p-7",
    },
  },
  defaultVariants: {
    tone: "default",
    padded: "md",
  },
});

type PanelTone = NonNullable<VariantProps<typeof panelVariants>["tone"]>;
type PanelPadding = NonNullable<VariantProps<typeof panelVariants>["padded"]>;

export interface PanelProps extends React.HTMLAttributes<HTMLElement> {
  /** Element to render. Use `section`/`article`/`li` to keep the outline sane. */
  as?: React.ElementType;
  tone?: PanelTone;
  /** `true` is shorthand for `"md"`; `false` for `"none"`. */
  padded?: PanelPadding | boolean;
}

function resolvePadding(padded: PanelProps["padded"]): PanelPadding {
  if (padded === true) return "md";
  if (padded === false) return "none";
  return padded ?? "md";
}

const Panel = React.forwardRef<HTMLElement, PanelProps>(
  ({ as: Comp = "div", className, tone, padded, ...props }, ref) => (
    <Comp
      ref={ref}
      className={cn(
        panelVariants({ tone, padded: resolvePadding(padded) }),
        className,
      )}
      {...props}
    />
  ),
);
Panel.displayName = "Panel";

/** Optional header row: title on the left, actions on the right. */
const PanelHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "mb-4 flex items-center justify-between gap-3 border-b-2 border-ink-line pb-3",
      className,
    )}
    {...props}
  />
));
PanelHeader.displayName = "PanelHeader";

const PanelTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement> & { as?: React.ElementType }
>(({ className, as: Comp = "h2", ...props }, ref) => (
  <Comp
    ref={ref}
    className={cn(
      "font-display text-xl uppercase tracking-display sm:text-2xl",
      className,
    )}
    {...props}
  />
));
PanelTitle.displayName = "PanelTitle";

export { Panel, PanelHeader, PanelTitle, panelVariants };

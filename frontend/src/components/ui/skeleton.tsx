import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Loading placeholder. `motion-safe:animate-pulse` keeps it still for users who
 * asked for reduced motion; the shape alone still reads as "loading".
 */
const Skeleton = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    aria-hidden="true"
    className={cn(
      "rounded border-2 border-ink-line bg-ink-raised motion-safe:animate-pulse",
      className,
    )}
    {...props}
  />
));
Skeleton.displayName = "Skeleton";

export { Skeleton };

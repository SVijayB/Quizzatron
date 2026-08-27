import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => {
  const pct = Math.min(Math.max(value ?? 0, 0), 100);
  return (
    <ProgressPrimitive.Root
      ref={ref}
      value={value}
      className={cn(
        "relative h-4 w-full overflow-hidden rounded-sm border-2 border-ink-line bg-ink-sunken shadow-inset",
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className="h-full w-full flex-1 bg-acid transition-transform duration-base ease-out"
        style={{ transform: `translateX(-${100 - pct}%)` }}
      />
    </ProgressPrimitive.Root>
  );
});
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };

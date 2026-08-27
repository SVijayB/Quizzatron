import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

export interface SliderProps
  extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  /**
   * Accessible name for the draggable thumb. Radix only reads `aria-label` off
   * the Thumb itself (the Root's is ignored and the thumb falls back to the
   * generic "Value"), so it has to be threaded through explicitly.
   */
  thumbLabel?: string;
}

/**
 * Sunken track with a chunky square thumb. The root is 44px tall so the whole
 * strip is a usable touch target even though the track itself is thin.
 */
const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, thumbLabel, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex min-h-touch w-full touch-none select-none items-center",
      "data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-3 w-full grow overflow-hidden rounded-sm border-2 border-ink-line bg-ink-sunken shadow-inset">
      <SliderPrimitive.Range className="absolute h-full bg-acid" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      aria-label={thumbLabel}
      className={cn(
        "block h-7 w-7 rounded-sm border-2 border-ink-line bg-bone shadow-hard-sm",
        "transition-transform duration-press ease-out",
        "hover:bg-acid active:translate-x-[1px] active:translate-y-[1px] active:shadow-hard-none",
        "data-[disabled]:pointer-events-none",
      )}
    />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };

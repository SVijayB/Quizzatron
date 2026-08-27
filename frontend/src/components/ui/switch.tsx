import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

/**
 * Chunky cabinet rocker switch. 44px tall so it is a legitimate touch target
 * (the old 20px toggle was not), and the ON/OFF wording means state is never
 * carried by colour alone.
 */
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    ref={ref}
    className={cn(
      "group relative inline-flex h-11 w-[84px] shrink-0 cursor-pointer items-center",
      "rounded-sm border-2 border-ink-line px-[2px] shadow-inset",
      "bg-ink-sunken transition-colors duration-fast ease-out",
      "data-[state=checked]:bg-acid",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    <span
      aria-hidden="true"
      className="pointer-events-none absolute left-2.5 text-[10px] font-bold uppercase leading-none tracking-wide text-ink opacity-0 group-data-[state=checked]:opacity-100"
    >
      On
    </span>
    <span
      aria-hidden="true"
      className="pointer-events-none absolute right-2 text-[10px] font-bold uppercase leading-none tracking-wide text-bone-dim group-data-[state=checked]:opacity-0"
    >
      Off
    </span>

    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none relative z-10 block h-9 w-9 rounded-sm",
        "border-2 border-ink-line bg-bone shadow-hard-sm",
        "transition-transform duration-press ease-out",
        "translate-x-0 data-[state=checked]:translate-x-[40px]",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };

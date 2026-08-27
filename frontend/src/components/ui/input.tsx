import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex min-h-touch w-full rounded border-2 border-ink-line bg-ink-sunken px-3 py-2",
        "font-sans text-base text-bone shadow-inset",
        // 16px keeps iOS Safari from zooming the viewport on focus.
        "placeholder:text-bone-dim",
        "transition-colors duration-fast ease-out",
        "hover:border-ink-line focus:border-acid",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-bold file:uppercase file:text-acid",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  [
    "inline-flex items-center gap-1 whitespace-nowrap",
    "rounded-full border-2 border-ink-line px-2.5 py-0.5",
    "font-sans text-[11px] font-bold uppercase tracking-wide leading-tight",
    "[&_svg]:size-3 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        default: "bg-bone text-ink",
        accent: "bg-acid text-ink",
        success: "bg-go text-ink",
        danger: "bg-hot text-ink",
        /** Host / informational. */
        info: "bg-sky text-ink",
        outline: "bg-transparent text-bone",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  ),
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };

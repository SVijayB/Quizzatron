import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Chunky arcade button. Sits on a hard offset shadow, lifts on hover and
 * physically drops into the page when pressed (see the `.press` utility in
 * src/index.css).
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 select-none",
    "rounded border-2 border-ink-line",
    "font-sans font-bold uppercase tracking-wide leading-none",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary:
          "press bg-acid text-ink hover:bg-acid-deep active:bg-acid-deep focus-visible:outline-bone",
        secondary: "press bg-bone text-ink hover:bg-bone-dim active:bg-bone-dim",
        ghost:
          "border-transparent bg-transparent text-bone transition-colors duration-fast ease-out hover:bg-ink-raised hover:text-acid active:bg-ink-sunken",
        danger:
          "press bg-hot text-ink hover:brightness-110 active:brightness-95 focus-visible:outline-bone",
        success:
          "press bg-go text-ink hover:brightness-110 active:brightness-95 focus-visible:outline-bone",
      },
      size: {
        sm: "h-9 px-3 text-xs",
        md: "min-h-touch px-4 py-2 text-sm",
        lg: "min-h-[52px] border-3 px-6 py-3 text-base [&_svg]:size-5",
        icon: "h-11 w-11 shrink-0 p-0",
      },
      /** Stretch to the container. Handy for stacked mobile CTAs. */
      block: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      block: false,
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render the styles onto the single child element instead of a <button>. */
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, block, asChild = false, type, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        // Buttons inside a form default to submit, which is nearly always
        // wrong for the interactive controls in this app.
        type={asChild ? type : (type ?? "button")}
        className={cn(buttonVariants({ variant, size, block }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };

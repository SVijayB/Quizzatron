import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const ToastProvider = ToastPrimitives.Provider;

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed inset-x-0 top-0 z-toast flex max-h-dvh w-full flex-col gap-3 p-4",
      "pt-[max(1rem,env(safe-area-inset-top))]",
      "sm:inset-x-auto sm:bottom-0 sm:right-0 sm:top-auto sm:max-w-[400px]",
      "sm:flex-col-reverse sm:pb-[max(1rem,env(safe-area-inset-bottom))] sm:pr-[max(1rem,env(safe-area-inset-right))]",
      className,
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

const toastVariants = cva(
  [
    "group pointer-events-auto relative flex w-full items-start justify-between gap-3",
    "rounded-lg border-2 border-ink-line p-4 pr-12 shadow-hard",
    "data-[swipe=cancel]:translate-x-0",
    "data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]",
    "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]",
    "data-[swipe=move]:transition-none",
    "motion-safe:data-[state=open]:animate-slide-up",
  ],
  {
    variants: {
      variant: {
        default: "bg-ink-raised text-bone",
        /** Kept for API compatibility with the shadcn toast hook. */
        destructive: "destructive bg-hot text-ink",
        success: "bg-go text-ink",
        info: "bg-sky text-ink",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => (
  <ToastPrimitives.Root
    ref={ref}
    className={cn(toastVariants({ variant }), className)}
    {...props}
  />
));
Toast.displayName = ToastPrimitives.Root.displayName;

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "press inline-flex min-h-touch shrink-0 items-center justify-center",
      "rounded border-2 border-ink-line bg-acid px-3",
      "text-xs font-bold uppercase tracking-wide text-ink",
      "hover:bg-acid-deep",
      className,
    )}
    {...props}
  />
));
ToastAction.displayName = ToastPrimitives.Action.displayName;

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    toast-close=""
    aria-label="Dismiss"
    className={cn(
      // Always visible: an opacity-0-until-hover close button is unusable on
      // touch and invisible to keyboard users.
      "absolute right-2 top-2 flex h-9 w-9 items-center justify-center",
      "rounded-sm border-2 border-ink-line bg-ink-sunken text-bone",
      "transition-colors duration-fast ease-out hover:bg-hot hover:text-ink",
      className,
    )}
    {...props}
  >
    <X className="h-4 w-4" aria-hidden="true" />
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn(
      "font-display text-base uppercase leading-tight tracking-display",
      className,
    )}
    {...props}
  />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn(
      "text-sm font-medium leading-snug group-[.destructive]:text-ink",
      className,
    )}
    {...props}
  />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>;
type ToastActionElement = React.ReactElement<typeof ToastAction>;

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
  toastVariants,
};

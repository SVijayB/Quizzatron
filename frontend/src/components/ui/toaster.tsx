import { AlertTriangle, CheckCircle2, Info, Megaphone } from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

const VARIANT_ICON = {
  default: Megaphone,
  destructive: AlertTriangle,
  success: CheckCircle2,
  info: Info,
} as const;

type ToastVariant = keyof typeof VARIANT_ICON;

/**
 * The app's single toast surface. Each toast carries an icon so severity is not
 * communicated by colour alone.
 */
export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, action, variant, ...props }) => {
        const key: ToastVariant =
          variant && variant in VARIANT_ICON
            ? (variant as ToastVariant)
            : "default";
        const Icon = VARIANT_ICON[key];

        return (
          <Toast key={id} variant={variant} {...props}>
            <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div className="grid min-w-0 flex-1 gap-1">
              {title ? <ToastTitle>{title}</ToastTitle> : null}
              {description ? (
                <ToastDescription>{description}</ToastDescription>
              ) : null}
              {action}
            </div>
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}

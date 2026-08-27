import * as React from "react";
import { Check, Copy } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface CodeDisplayProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The lobby code, typically 6 characters. */
  code: string;
  /** Caption above the code. */
  label?: string;
  onCopied?: (code: string) => void;
}

type CopyState = "idle" | "copied" | "failed";

async function writeToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through: clipboard access can be denied or unavailable on http.
    }
  }
  return false;
}

/**
 * Big, readable lobby code with a copy affordance. Feedback is inline and
 * announced politely — never an `alert()`.
 */
const CodeDisplay = React.forwardRef<HTMLDivElement, CodeDisplayProps>(
  ({ code, label = "Lobby code", onCopied, className, ...props }, ref) => {
    const [copyState, setCopyState] = React.useState<CopyState>("idle");
    const resetTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(
      undefined,
    );

    React.useEffect(
      () => () => {
        if (resetTimer.current) clearTimeout(resetTimer.current);
      },
      [],
    );

    const handleCopy = async () => {
      const ok = await writeToClipboard(code);
      setCopyState(ok ? "copied" : "failed");
      if (ok) onCopied?.(code);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopyState("idle"), 2000);
    };

    const message =
      copyState === "copied"
        ? "Code copied to clipboard"
        : copyState === "failed"
          ? "Copy failed — select the code and copy it manually"
          : "";

    return (
      <div ref={ref} className={cn("flex flex-col gap-2", className)} {...props}>
        <span className="text-[11px] font-bold uppercase tracking-widest text-bone-dim">
          {label}
        </span>

        <div className="flex flex-wrap items-center gap-3">
          <output
            className={cn(
              "rounded-lg border-2 border-ink-line bg-ink-sunken px-4 py-2 shadow-inset",
              "font-mono text-3xl font-bold tracking-widest text-acid sm:text-4xl",
            )}
          >
            {code}
          </output>

          <Button
            variant="secondary"
            size="md"
            onClick={handleCopy}
            aria-label={`Copy lobby code ${code.split("").join(" ")}`}
          >
            {copyState === "copied" ? <Check /> : <Copy />}
            {copyState === "copied" ? "Copied" : "Copy"}
          </Button>
        </div>

        <span
          role="status"
          aria-live="polite"
          className={cn(
            "min-h-[1rem] text-xs font-semibold",
            copyState === "failed" ? "text-hot" : "text-go",
          )}
        >
          {message}
        </span>
      </div>
    );
  },
);
CodeDisplay.displayName = "CodeDisplay";

export { CodeDisplay };

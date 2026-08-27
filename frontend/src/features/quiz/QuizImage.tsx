import { useEffect, useState } from "react";

import { Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";

interface QuizImageProps {
  /** Often null — a text-only question. Renders nothing at all in that case. */
  src: string | null;
  /** Question text, used to describe the image in context. */
  questionText: string;
  className?: string;
}

type LoadState = "loading" | "ready" | "failed";

/**
 * Question illustration. Three states, all handled: a skeleton while it loads,
 * the image once decoded, and *nothing* when there is no URL or the fetch fails.
 *
 * v1 rendered `<img src={image_url}>` unconditionally with no `onError`, so a
 * dead hotlink left a broken-image glyph and a reserved gap on the card.
 */
export function QuizImage({ src, questionText, className }: QuizImageProps) {
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    setState("loading");
  }, [src]);

  if (!src || state === "failed") return null;

  return (
    <figure
      className={cn(
        "relative overflow-hidden rounded border-2 border-ink-line bg-ink-sunken",
        className,
      )}
    >
      {state === "loading" ? (
        <Skeleton className="h-40 w-full rounded-none border-0 sm:h-56" />
      ) : null}

      <img
        src={src}
        alt={`Illustration for the question: ${questionText}`}
        loading="lazy"
        decoding="async"
        onLoad={() => setState("ready")}
        onError={() => setState("failed")}
        className={cn(
          "mx-auto max-h-[28dvh] w-full object-contain",
          state === "loading" && "absolute inset-0 opacity-0",
        )}
      />
    </figure>
  );
}

import * as React from "react";
import { ChevronDown, Dices } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  AVATAR_CATEGORIES,
  DEFAULT_AVATAR_EMOJI,
  getRandomEmoji,
} from "@/lib/avatars";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

/* ------------------------------------------------------------------ badge */

export interface AvatarEmojiBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  emoji: string;
  /** Edge length in px. Never rendered below 44 when interactive. */
  size?: number;
}

/** Static avatar tile. Emoji here are user avatars, not UI iconography. */
const AvatarEmojiBadge = React.forwardRef<
  HTMLSpanElement,
  AvatarEmojiBadgeProps
>(({ emoji, size = 44, className, style, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      "inline-flex shrink-0 select-none items-center justify-center",
      "rounded-sm border-2 border-ink-line bg-acid shadow-hard-sm",
      className,
    )}
    style={{ width: size, height: size, fontSize: size * 0.55, ...style }}
    {...props}
  >
    <span aria-hidden="true">{emoji}</span>
  </span>
));
AvatarEmojiBadge.displayName = "AvatarEmojiBadge";

/* ----------------------------------------------------------------- picker */

export interface AvatarPickerProps {
  /** Currently selected emoji. */
  value?: string;
  onChange?: (emoji: string) => void;
  /** Edge length of the trigger tile in px. Clamped to >= 44. */
  size?: number;
  disabled?: boolean;
  /** Accessible name for the trigger. */
  label?: string;
  className?: string;
}

/**
 * Avatar chooser. The trigger is a real `<button>` (the previous implementation
 * wrapped `DialogTrigger asChild` around a plain `<div>`, which no keyboard user
 * could reach).
 */
function AvatarPicker({
  value = DEFAULT_AVATAR_EMOJI,
  onChange,
  size = 56,
  disabled = false,
  label = "Change your avatar",
  className,
}: AvatarPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [activeCategory, setActiveCategory] = React.useState(0);
  const tile = Math.max(size, 44);

  const select = (emoji: string) => {
    onChange?.(emoji);
    setOpen(false);
  };

  const category = AVATAR_CATEGORIES[activeCategory];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={label}
          aria-haspopup="dialog"
          className={cn(
            "press relative inline-flex shrink-0 items-center justify-center",
            "rounded-sm border-2 border-ink-line bg-acid",
            "disabled:pointer-events-none disabled:opacity-50",
            className,
          )}
          style={{ width: tile, height: tile, fontSize: tile * 0.5 }}
        >
          <span aria-hidden="true" className="select-none leading-none">
            {value}
          </span>
          <span
            aria-hidden="true"
            className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-sm border-2 border-ink-line bg-ink text-acid"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </span>
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Pick an avatar</DialogTitle>
          <DialogDescription>
            Choose a character to represent you in the lobby.
          </DialogDescription>
        </DialogHeader>

        <div
          role="tablist"
          aria-label="Avatar categories"
          className="mb-3 flex flex-wrap gap-2"
        >
          {AVATAR_CATEGORIES.map((entry, index) => {
            const selected = index === activeCategory;
            return (
              <button
                key={entry.name}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveCategory(index)}
                className={cn(
                  "min-h-touch rounded-full border-2 border-ink-line px-3",
                  "text-xs font-bold uppercase tracking-wide",
                  "transition-colors duration-fast ease-out",
                  selected
                    ? "bg-acid text-ink"
                    : "bg-ink-sunken text-bone-dim hover:text-bone",
                )}
              >
                {entry.name}
              </button>
            );
          })}
        </div>

        <ScrollArea className="h-[46dvh] rounded border-2 border-ink-line bg-ink-sunken">
          <div className="grid grid-cols-5 gap-2 p-2 sm:grid-cols-6">
            {category?.emojis.map((emoji) => {
              const selected = emoji === value;
              return (
                <button
                  key={emoji}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`Avatar ${emoji}`}
                  onClick={() => select(emoji)}
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-sm border-2 text-xl",
                    "transition-colors duration-fast ease-out",
                    selected
                      ? "border-ink-line bg-acid"
                      : "border-transparent bg-ink-raised hover:border-ink-line hover:bg-ink",
                  )}
                >
                  <span aria-hidden="true" className="select-none">
                    {emoji}
                  </span>
                </button>
              );
            })}
          </div>
        </ScrollArea>

        <Button
          variant="secondary"
          block
          className="mt-3"
          onClick={() => select(getRandomEmoji())}
        >
          <Dices aria-hidden="true" />
          Surprise me
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export { AvatarPicker, AvatarEmojiBadge };

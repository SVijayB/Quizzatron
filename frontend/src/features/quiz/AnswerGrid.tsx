import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { AnswerButton, type AnswerLetter, type AnswerState } from "@/components/ui";

const LETTERS: readonly AnswerLetter[] = ["A", "B", "C", "D"];

interface AnswerGridProps {
  options: string[];
  /** The local player's pick, or null. */
  selectedIndex: number | null;
  /** Set only once the answer is revealed. */
  correctIndex: number | null;
  /** True when the player can no longer change their answer. */
  locked: boolean;
  onSelect: (index: number) => void;
  /**
   * Bumps on every new question so the roving tab index resets instead of
   * pointing at whatever was focused last round.
   */
  questionNumber: number;
}

function stateFor(
  index: number,
  selectedIndex: number | null,
  correctIndex: number | null,
): AnswerState {
  if (correctIndex === null) {
    return selectedIndex === index ? "selected" : "idle";
  }
  if (index === correctIndex) return "correct";
  if (index === selectedIndex) return "wrong";
  return "revealed-other";
}

/** Should a bare letter/number keypress be treated as an answer shortcut? */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

/**
 * The four options as a real radio group: arrow keys move, Space/Enter picks,
 * and 1–4 / A–D are shortcuts. v1 rendered `<div onClick>` wrappers, so none of
 * this was reachable without a mouse.
 */
export function AnswerGrid({
  options,
  selectedIndex,
  correctIndex,
  locked,
  onSelect,
  questionNumber,
}: AnswerGridProps) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const revealed = correctIndex !== null;

  useEffect(() => {
    setActiveIndex(0);
  }, [questionNumber]);

  const focusOption = useCallback((index: number) => {
    const bounded = (index + options.length) % options.length;
    setActiveIndex(bounded);
    buttons.current[bounded]?.focus();
  }, [options.length]);

  const pick = useCallback(
    (index: number) => {
      if (locked) return;
      setActiveIndex(index);
      onSelect(index);
    },
    [locked, onSelect],
  );

  // 1–4 and A–D work wherever focus is, as long as the player is not typing.
  useEffect(() => {
    if (locked) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      const key = event.key.toUpperCase();
      const byLetter = LETTERS.indexOf(key as AnswerLetter);
      const byNumber = /^[1-9]$/.test(key) ? Number(key) - 1 : -1;
      const index = byLetter >= 0 ? byLetter : byNumber;

      if (index >= 0 && index < options.length) {
        event.preventDefault();
        pick(index);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [locked, options.length, pick]);

  const onGridKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight":
        event.preventDefault();
        focusOption(activeIndex + 1);
        break;
      case "ArrowUp":
      case "ArrowLeft":
        event.preventDefault();
        focusOption(activeIndex - 1);
        break;
      case "Home":
        event.preventDefault();
        focusOption(0);
        break;
      case "End":
        event.preventDefault();
        focusOption(options.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="Answer options"
      onKeyDown={onGridKeyDown}
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      {options.map((option, index) => {
        const isSelected = selectedIndex === index;
        return (
          <AnswerButton
            key={`${questionNumber}-${index}`}
            ref={(node) => {
              buttons.current[index] = node;
            }}
            role="radio"
            aria-checked={isSelected}
            // AnswerButton sets aria-pressed by default; a radio must not carry it.
            aria-pressed={undefined}
            tabIndex={index === activeIndex ? 0 : -1}
            letter={LETTERS[index] ?? "A"}
            state={stateFor(index, selectedIndex, correctIndex)}
            chosen={isSelected}
            onSelect={() => pick(index)}
            onFocus={() => setActiveIndex(index)}
            aria-keyshortcuts={revealed ? undefined : `${index + 1} ${LETTERS[index]}`}
          >
            {option}
          </AnswerButton>
        );
      })}
    </div>
  );
}

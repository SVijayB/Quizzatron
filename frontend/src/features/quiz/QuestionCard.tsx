import { useEffect, useRef, type ReactNode } from "react";

import { Badge, Panel } from "@/components/ui";
import { QuizImage } from "./QuizImage";
import type { RunnerQuestion } from "./types";

interface QuestionCardProps {
  question: RunnerQuestion;
  questionCount: number;
  children: ReactNode;
}

const DIFFICULTY_TONE = {
  easy: "success",
  medium: "accent",
  hard: "danger",
} as const;

type DifficultyKey = keyof typeof DIFFICULTY_TONE;

function difficultyVariant(value: string | null) {
  if (value && value in DIFFICULTY_TONE) {
    return DIFFICULTY_TONE[value as DifficultyKey];
  }
  return "outline" as const;
}

/**
 * One question: counter, difficulty, optional illustration, the text, and
 * whatever control the caller passes as children.
 *
 * Question text is rendered as text. v1 used `dangerouslySetInnerHTML` on model
 * output here and at four other sites.
 */
export function QuestionCard({ question, questionCount, children }: QuestionCardProps) {
  const heading = useRef<HTMLDivElement | null>(null);

  // Deliberate focus move on every new question. v1 left focus on the answer
  // button the player had just pressed, which the reveal then disabled — so a
  // keyboard user was stranded and a screen reader announced nothing.
  useEffect(() => {
    heading.current?.focus();
  }, [question.number]);

  return (
    <Panel as="section" padded="md" aria-labelledby="question-text">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-bone-dim">
          Question{" "}
          <span className="text-acid">{question.number}</span>
          {questionCount > 0 ? ` / ${questionCount}` : null}
        </p>
        {question.difficulty ? (
          <Badge variant={difficultyVariant(question.difficulty)}>
            {question.difficulty}
          </Badge>
        ) : null}
      </div>

      <QuizImage
        src={question.imageUrl}
        questionText={question.text}
        className="mb-4"
      />

      {/* Anton, but not uppercased: a two-line question in all-caps is a wall. */}
      <div ref={heading} tabIndex={-1} className="outline-offset-4">
        <h2
          id="question-text"
          className="whitespace-pre-line break-words font-display text-xl leading-snug tracking-display sm:text-2xl"
        >
          {question.text}
        </h2>
      </div>

      <div className="mt-4">{children}</div>
    </Panel>
  );
}

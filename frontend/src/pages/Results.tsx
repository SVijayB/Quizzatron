import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home as HomeIcon, RotateCcw, Users } from "lucide-react";

import { Button, Panel, PanelTitle } from "@/components/ui";
import { QuestionReview, type ReviewItem } from "@/features/results/QuestionReview";
import { loadSoloResult, parseSoloResult } from "@/features/quiz/soloRunStore";
import { useConfetti } from "@/lib/confetti";

function resultFromLocationState(state: unknown) {
  if (typeof state !== "object" || state === null) return null;
  return parseSoloResult((state as { result?: unknown }).result);
}

/**
 * Solo results.
 *
 * v1's version carried an `isMultiplayer` branch — a podium, a standings table
 * and a rematch button, about 90 lines — behind a flag that nothing could ever
 * set to true. Multiplayer results have their own route.
 */
export default function Results() {
  const location = useLocation();
  const [result] = useState(() => resultFromLocationState(location.state) ?? loadSoloResult());
  const fireConfetti = useConfetti();

  const total = result?.questions.length ?? 0;
  const correct = result?.correctCount ?? 0;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  useEffect(() => {
    if (result && correct > 0) fireConfetti();
  }, [correct, fireConfetti, result]);

  const review = useMemo<ReviewItem[]>(() => {
    if (!result) return [];
    return result.questions.map((question) => {
      const answer = result.answers.find(
        (entry) => entry.questionIndex === question.index,
      );
      return {
        number: question.index,
        text: question.question,
        options: question.options,
        correctIndex: question.correct_index,
        explanation: question.explanation,
        selectedIndex: answer?.selectedIndex ?? null,
        timedOut: answer?.timedOut ?? true,
        isCorrect: answer?.isCorrect ?? false,
      };
    });
  }, [result]);

  if (!result) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-3 pt-8 sm:px-5">
        <Panel as="section" padded="lg" className="flex flex-col gap-4">
          <h1 className="font-display text-2xl uppercase tracking-display">
            No results to show
          </h1>
          <p className="text-sm text-bone-dim">
            Finish a quiz and your score lands here.
          </p>
          <Button asChild size="lg" block>
            <Link to="/">
              <HomeIcon aria-hidden="true" />
              Build a quiz
            </Link>
          </Button>
        </Panel>
      </div>
    );
  }

  const averageSeconds =
    result.answers.length > 0
      ? Math.round(result.totalTimeMs / result.answers.length / 100) / 10
      : 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-3 pb-[max(2rem,env(safe-area-inset-bottom))] pt-6 sm:px-5">
      <h1 className="font-display text-3xl uppercase leading-none tracking-tightest sm:text-5xl">
        Results
      </h1>

      <Panel as="section" tone="accent" padded="lg" className="flex flex-col gap-4">
        <p role="status" aria-live="polite" className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-widest">
            You scored
          </span>
          <span className="font-display text-5xl leading-none sm:text-6xl">
            {correct}
            <span className="text-3xl sm:text-4xl"> / {total}</span>
          </span>
          <span className="text-sm font-bold uppercase tracking-wide">
            {accuracy}% correct
            {result.topic ? ` · ${result.topic}` : ""}
          </span>
        </p>

        <dl className="grid grid-cols-2 gap-3 border-t-2 border-ink-line pt-3 text-ink sm:grid-cols-3">
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-widest">Difficulty</dt>
            <dd className="font-mono text-lg font-bold capitalize">{result.difficulty}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-widest">Avg. time</dt>
            <dd className="font-mono text-lg font-bold tabular-nums">{averageSeconds}s</dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-widest">Missed</dt>
            <dd className="font-mono text-lg font-bold tabular-nums">{total - correct}</dd>
          </div>
        </dl>
      </Panel>

      <Panel as="section" padded="md" className="flex flex-col gap-3">
        <PanelTitle as="h2">What next</PanelTitle>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="flex-1">
            <Link to="/">
              <RotateCcw aria-hidden="true" />
              Another quiz
            </Link>
          </Button>
          <Button asChild size="lg" variant="secondary" className="flex-1">
            <Link to="/multiplayer">
              <Users aria-hidden="true" />
              Play with friends
            </Link>
          </Button>
        </div>
      </Panel>

      <QuestionReview items={review} />
    </div>
  );
}

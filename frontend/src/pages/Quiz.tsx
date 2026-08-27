import { useCallback, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home as HomeIcon } from "lucide-react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button, Panel } from "@/components/ui";
import { QuizRunner } from "@/features/quiz/QuizRunner";
import {
  clearSoloRun,
  loadSoloRun,
  parseSoloRun,
  saveSoloResult,
} from "@/features/quiz/soloRunStore";
import {
  useSinglePlayerQuiz,
  type SoloResult,
} from "@/features/quiz/useSinglePlayerQuiz";

function runFromLocationState(state: unknown): ReturnType<typeof parseSoloRun> {
  if (typeof state !== "object" || state === null) return null;
  return parseSoloRun((state as { run?: unknown }).run);
}

/**
 * Solo play.
 *
 * v1's version read a `multiplayerQuizData` localStorage key that nothing ever
 * wrote, along with `isMultiplayer`, `playerName` and `lobbyCode` — roughly 120
 * lines that could never execute. Multiplayer lives on its own route now.
 */
export default function Quiz() {
  const navigate = useNavigate();
  const location = useLocation();
  const [confirmQuit, setConfirmQuit] = useState(false);

  // Router state is the hand-off; session storage covers a reload.
  const [run] = useState(() => runFromLocationState(location.state) ?? loadSoloRun());

  const onFinish = useCallback(
    (result: SoloResult) => {
      saveSoloResult(result);
      clearSoloRun();
      navigate("/results", { state: { result }, replace: true });
    },
    [navigate],
  );

  const engine = useSinglePlayerQuiz(run, onFinish);

  if (!run) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-3 pt-8 sm:px-5">
        <Panel as="section" padded="lg" className="flex flex-col gap-4">
          <h1 className="font-display text-2xl uppercase tracking-display">
            No quiz loaded
          </h1>
          <p className="text-sm text-bone-dim">
            This page needs a quiz to run. Build one from the home screen and it
            will start straight away.
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

  return (
    <>
      <QuizRunner
        engine={engine}
        heading="Solo run"
        quitLabel="Quit"
        onQuit={() => setConfirmQuit(true)}
      />

      <ConfirmDialog
        open={confirmQuit}
        onOpenChange={setConfirmQuit}
        title="Quit this quiz?"
        description="Your progress on this run will be lost."
        confirmLabel="Quit"
        destructive
        onConfirm={() => {
          clearSoloRun();
          navigate("/");
        }}
      />
    </>
  );
}

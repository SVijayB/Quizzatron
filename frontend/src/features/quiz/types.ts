/**
 * The contract `QuizRunner` renders against.
 *
 * One runner drives both modes. `useSinglePlayerQuiz` grades locally (solo
 * legitimately has `correct_index`); `useMultiplayerQuiz` only ever reports what
 * the server said. Neither of them owns any layout, which is what collapses v1's
 * 2,092 duplicated lines across `Quiz.tsx` and `MultiplayerQuiz.tsx`.
 */

export type QuizMode = "solo" | "multiplayer";

export type QuizPhase =
  /** Pre-roll: waiting for the player to start (solo only). */
  | "idle"
  /** Waiting for the first question, or for the server to build the quiz. */
  | "loading"
  /** A question is live and answerable. */
  | "question"
  /** The answer is on screen. */
  | "reveal"
  /** Answered, clock still running, waiting on other players. */
  | "waiting"
  /** The run is over; the page navigates away. */
  | "finished"
  /** Unrecoverable for now; `errorText` explains and `retry` may exist. */
  | "error";

export interface RunnerQuestion {
  /** 1-based position, as shown to the player. */
  number: number;
  text: string;
  options: string[];
  imageUrl: string | null;
  difficulty: string | null;
}

export type AnswerOutcome =
  | "unanswered"
  | "answered"
  | "correct"
  | "wrong"
  | "timedOut";

export interface ScoreRow {
  id: string;
  name: string;
  /** Emoji avatar, or null when the mode has no avatars. */
  avatar: string | null;
  score: number;
  correctCount: number;
  connected: boolean;
  isSelf: boolean;
  /** Points earned on the question just revealed, when known. */
  pointsThisRound: number | null;
  outcome: AnswerOutcome;
}

export interface QuizEngine {
  mode: QuizMode;
  phase: QuizPhase;
  /** Server or client error message, shown verbatim. */
  errorText: string | null;
  /** Topic, category or lobby code — whatever names this run. */
  subtitle: string | null;
  question: RunnerQuestion | null;
  questionCount: number;
  /** The local player's pick for the live question. */
  selectedIndex: number | null;
  /** Only ever set at reveal. Solo knows it locally; multiplayer is told. */
  correctIndex: number | null;
  explanation: string | null;
  /** Points the local player earned on the revealed question. */
  pointsThisRound: number | null;
  /** Whole ms left on the clock, or null when there is no clock. */
  remainingMs: number | null;
  /** The question's full allowance in ms, for the timer's denominator. */
  totalMs: number | null;
  score: number;
  correctCount: number;
  /** Empty in solo. Never recomputed per-screen — this is the only source. */
  scoreboard: ScoreRow[];
  /** e.g. "3 of 5 players answered". */
  waitingNote: string | null;
  canAnswer: boolean;
  select: (index: number) => void;
  /** Present only while `phase === "idle"`. */
  start?: () => void;
  retry?: () => void;
}

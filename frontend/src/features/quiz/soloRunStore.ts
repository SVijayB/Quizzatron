/**
 * Hand-off storage for a solo run.
 *
 * Router state is the primary channel (Home -> Quiz -> Results); these two
 * `sessionStorage` keys exist so a reload mid-run or on the results screen still
 * has something to show.
 *
 * v1 used eleven unnamespaced `localStorage` keys as a general-purpose event bus
 * between pages — two of them read but never written, one written but never
 * read. There are exactly two keys here, both namespaced, both a hand-off of one
 * payload, and both validated on the way out because storage is untrusted input.
 */

import type { Difficulty, Question, QuestionSource } from "@/types/api";
import type { SoloAnswer, SoloResult, SoloRun } from "./useSinglePlayerQuiz";

const RUN_KEY = "quizzatron:solo-run";
const RESULT_KEY = "quizzatron:solo-result";

function read(key: string): unknown {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be full or blocked; the router state still carries the payload.
  }
}

function remove(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Nothing to do.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const DIFFICULTIES = new Set<string>(["easy", "medium", "hard"]);
const SOURCES = new Set<string>(["llm", "opentdb", "mongo"]);

function parseQuestion(value: unknown): Question | null {
  if (!isRecord(value)) return null;
  const { index, question, options, correct_index, difficulty, source } = value;
  if (typeof index !== "number" || typeof question !== "string") return null;
  if (!Array.isArray(options) || options.length !== 4) return null;
  if (!options.every((option): option is string => typeof option === "string")) return null;
  if (typeof correct_index !== "number" || correct_index < 0 || correct_index > 3) {
    return null;
  }
  return {
    index,
    question,
    options: [options[0], options[1], options[2], options[3]],
    correct_index,
    difficulty: (typeof difficulty === "string" && DIFFICULTIES.has(difficulty)
      ? difficulty
      : "medium") as Difficulty,
    source: (typeof source === "string" && SOURCES.has(source)
      ? source
      : "llm") as QuestionSource,
    image_url: typeof value.image_url === "string" ? value.image_url : null,
    explanation: typeof value.explanation === "string" ? value.explanation : null,
  };
}

/** Validate an untrusted value (router state, storage) as a solo run. */
export function parseSoloRun(value: unknown): SoloRun | null {
  if (!isRecord(value)) return null;
  if (!Array.isArray(value.questions)) return null;
  const questions = value.questions
    .map(parseQuestion)
    .filter((question): question is Question => question !== null);
  if (questions.length === 0) return null;

  return {
    topic: typeof value.topic === "string" ? value.topic : null,
    difficulty: (typeof value.difficulty === "string" && DIFFICULTIES.has(value.difficulty)
      ? value.difficulty
      : "medium") as Difficulty,
    secondsPerQuestion:
      typeof value.secondsPerQuestion === "number" && value.secondsPerQuestion >= 5
        ? value.secondsPerQuestion
        : 20,
    questions,
  };
}

function parseAnswer(value: unknown): SoloAnswer | null {
  if (!isRecord(value)) return null;
  const { questionIndex, selectedIndex, isCorrect, timedOut, elapsedMs } = value;
  if (typeof questionIndex !== "number") return null;
  return {
    questionIndex,
    selectedIndex: typeof selectedIndex === "number" ? selectedIndex : null,
    isCorrect: isCorrect === true,
    timedOut: timedOut === true,
    elapsedMs: typeof elapsedMs === "number" ? elapsedMs : 0,
  };
}

export function saveSoloRun(run: SoloRun): void {
  write(RUN_KEY, run);
}

export function loadSoloRun(): SoloRun | null {
  return parseSoloRun(read(RUN_KEY));
}

export function clearSoloRun(): void {
  remove(RUN_KEY);
}

export function saveSoloResult(result: SoloResult): void {
  write(RESULT_KEY, result);
}

/** Validate an untrusted value (router state, storage) as a finished run. */
export function parseSoloResult(value: unknown): SoloResult | null {
  const run = parseSoloRun(value);
  if (!run || !isRecord(value)) return null;

  const answers = Array.isArray(value.answers)
    ? value.answers.map(parseAnswer).filter((entry): entry is SoloAnswer => entry !== null)
    : [];

  return {
    ...run,
    answers,
    correctCount: answers.filter((entry) => entry.isCorrect).length,
    totalTimeMs: answers.reduce((sum, entry) => sum + entry.elapsedMs, 0),
    completedAt: typeof value.completedAt === "number" ? value.completedAt : Date.now(),
  };
}

export function loadSoloResult(): SoloResult | null {
  return parseSoloResult(read(RESULT_KEY));
}

export function clearSoloResult(): void {
  remove(RESULT_KEY);
}

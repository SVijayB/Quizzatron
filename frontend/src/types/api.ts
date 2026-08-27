/**
 * The Quizzatron v2 API contract, as types.
 *
 * Every shape here mirrors exactly one server serialiser. Nothing in this file
 * is `any` — including the Socket.IO payloads, which v1 typed as `any` in nine
 * places and consequently mis-read (`playerEmoji` vs `playerAvatar`, a
 * `correct_answer` letter vs an index, and so on).
 */

/* -------------------------------------------------------------- primitives */

export type Difficulty = "easy" | "medium" | "hard";

export const DIFFICULTIES: readonly Difficulty[] = ["easy", "medium", "hard"];

export type QuestionSource = "llm" | "opentdb" | "mongo";

/** Options always arrive as exactly four clean strings — no `"A) "` prefixes. */
export type QuestionOptions = [string, string, string, string];

/* ------------------------------------------------------------------- quiz */

/** One question, identical from every source. */
export interface Question {
  /** 1-based position within the quiz. */
  index: number;
  question: string;
  options: QuestionOptions;
  /** 0..3. Present for single-player only; never for an in-play multiplayer question. */
  correct_index: number;
  difficulty: Difficulty;
  source: QuestionSource;
  /** Absolute URL, or null for a text-only question. */
  image_url: string | null;
  explanation: string | null;
}

/** `POST /api/quiz/generate` and `POST /api/quiz/category` both return this. */
export interface Quiz {
  questions: Question[];
  topic: string | null;
  difficulty: Difficulty;
  source: QuestionSource;
  model: string | null;
}

/* ------------------------------------------------------------------ models */

export interface ModelInfo {
  key: string;
  label: string;
  provider: string;
  available: boolean;
  requires_key: boolean;
  key_env: string | null;
  notes: string | null;
}

export interface ModelsResponse {
  models: ModelInfo[];
  default: string | null;
}

/* -------------------------------------------------------------- categories */

export interface Category {
  name: string;
  source: QuestionSource;
  ref: string;
}

export interface CategoriesResponse {
  categories: Category[];
  count: number;
}

/* ---------------------------------------------------------------- dev info */

export interface TeamMember {
  name: string;
  role: string;
  linkedin: string;
  image: string;
}

export interface DevInfoResponse {
  team: TeamMember[];
}

/* --------------------------------------------------------------- requests */

export interface GenerateQuizInput {
  topic: string;
  difficulty: Difficulty;
  num_questions: number;
  include_images: boolean;
  model: string | null;
}

export interface GenerateQuizFromPdfInput extends Omit<GenerateQuizInput, "topic"> {
  file: File;
  /** Optional override; the server derives a topic from the text when absent. */
  topic?: string;
}

export interface GenerateQuizFromCategoryInput {
  category: string;
  num_questions: number;
  difficulty: Difficulty;
}

/* ------------------------------------------------------------ multiplayer */

export type LobbyPhase = "lobby" | "question" | "reveal" | "game_over";

/** Host-configurable game settings. `numQuestions` 1..30, `timePerQuestion` 5..60. */
export interface LobbySettings {
  numQuestions: number;
  difficulty: Difficulty;
  timePerQuestion: number;
  includeImages: boolean;
  topic: string | null;
  category: string | null;
  model: string | null;
}

export const SETTINGS_LIMITS = {
  numQuestions: { min: 1, max: 30 },
  timePerQuestion: { min: 5, max: 60 },
} as const;

export interface MpAnswer {
  questionIndex: number;
  selectedIndex: number | null;
  isCorrect: boolean;
  points: number;
  elapsedMs: number;
  timedOut: boolean;
}

export interface MpPlayer {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  ready: boolean;
  connected: boolean;
  score: number;
  correctCount: number;
  answeredCount: number;
  /** Only present in the results payload. */
  answers?: MpAnswer[];
}

/** Snapshot for the lobby screen (`as_lobby_dict`). */
export interface LobbyState {
  lobbyCode: string;
  hostId: string;
  state: LobbyPhase;
  started: boolean;
  generating: boolean;
  settings: LobbySettings;
  players: MpPlayer[];
  questionCount: number;
}

/**
 * A question while it is in play. Deliberately carries **no** correct index —
 * the answer only arrives with `game:reveal`, so there is nothing to grade
 * against locally and no way to cheat from devtools.
 */
export interface InPlayQuestion {
  index: number;
  question: string;
  options: string[];
  imageUrl: string | null;
  difficulty: string;
}

/** Snapshot for the in-game screen (`as_game_dict`). */
export interface GameState {
  lobbyCode: string;
  hostId: string;
  state: LobbyPhase;
  settings: LobbySettings;
  players: MpPlayer[];
  questionIndex: number;
  questionCount: number;
  maxPointsPerQuestion: number;
  question: InPlayQuestion | null;
  deadlineMs: number;
  serverNowMs: number;
}

export interface ResultsQuestion {
  index: number;
  question: string;
  options: string[];
  correctIndex: number;
  imageUrl: string | null;
  explanation: string | null;
}

/** `GET /api/multiplayer/results/:code` and the `game:over` payload. */
export interface MpResults {
  lobbyCode: string;
  state: LobbyPhase;
  questionCount: number;
  questions: ResultsQuestion[];
  /** Always carries `answers`. */
  players: MpPlayer[];
}

/**
 * The fields common to both snapshot shapes, all optional. `lobby:joined` sends
 * whichever of the two the lobby can produce (and `{}` in the worst case), so
 * consumers narrow with the guards in `@/services/socket`.
 */
export type AnySnapshot = Partial<LobbyState> & Partial<GameState>;

/* ------------------------------------------------ multiplayer REST bodies */

export interface CreateLobbyResponse {
  lobbyCode: string;
  playerId: string;
  lobby: LobbyState;
}

export type JoinLobbyResponse = CreateLobbyResponse;

export interface LobbyMutationResponse {
  ok: boolean;
  lobby: LobbyState;
}

export interface AnswerResponse {
  ok: boolean;
  answer: MpAnswer;
}

export interface OkResponse {
  ok: boolean;
}

/* ------------------------------------------------------- socket payloads */

export interface ConnectionReadyPayload {
  sessionId: string;
}

export interface LobbyClosedPayload {
  lobbyCode: string;
  reason: string;
}

export interface GameAnsweredPayload {
  playerId: string;
  playerName: string;
  questionIndex: number;
  answeredCount: number;
  totalPlayers: number;
}

export interface RevealBreakdownEntry {
  playerId: string;
  selectedIndex: number | null;
  isCorrect: boolean;
  points: number;
  timedOut: boolean;
}

export interface GameRevealPayload {
  /** 0-based index of the question just closed. */
  questionIndex: number;
  correctIndex: number;
  correctOption: string;
  explanation: string | null;
  isLastQuestion: boolean;
  nextInMs: number;
  players: MpPlayer[];
  breakdown: RevealBreakdownEntry[];
}

export interface SocketErrorPayload {
  message: string;
}

/** Server -> client events, keyed by name. */
export interface ServerEvents {
  "connection:ready": ConnectionReadyPayload;
  "lobby:joined": AnySnapshot;
  "lobby:update": LobbyState;
  "lobby:closed": LobbyClosedPayload;
  "game:started": LobbyState;
  "game:question": GameState;
  "game:answered": GameAnsweredPayload;
  "game:reveal": GameRevealPayload;
  "game:over": MpResults;
  error: SocketErrorPayload;
}

export type ServerEventName = keyof ServerEvents;

interface LobbyIdentityPayload {
  lobbyCode: string;
  playerId: string;
}

/** Client -> server events, keyed by name. */
export interface ClientEvents {
  "lobby:join": LobbyIdentityPayload;
  "lobby:leave": LobbyIdentityPayload;
  "lobby:ready": LobbyIdentityPayload & { ready: boolean };
  "lobby:settings": LobbyIdentityPayload & { settings: Partial<LobbySettings> };
  "lobby:avatar": LobbyIdentityPayload & { avatar: string };
  "game:start": LobbyIdentityPayload;
  "game:answer": LobbyIdentityPayload & {
    questionIndex: number;
    selectedIndex: number | null;
  };
  "game:restart": LobbyIdentityPayload;
}

export type ClientEventName = keyof ClientEvents;

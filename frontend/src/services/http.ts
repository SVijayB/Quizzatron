/**
 * The one place the app talks HTTP.
 *
 * v1 had two service modules that each hardcoded `https://quizzatron.onrender.com`,
 * built URLs by string concatenation, and handled failures by logging and
 * returning `null` — so a 500 and an empty result were indistinguishable to
 * every caller. Here a failure is always a thrown `ApiError` carrying the
 * server's own `message`, which the UI is expected to show verbatim.
 */

import { apiUrl } from "./config";

/** Server error envelope: `{ error: { message, code, retryable } }`. */
interface ErrorEnvelope {
  error: {
    message?: unknown;
    code?: unknown;
    retryable?: unknown;
  };
}

function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as { error: unknown }).error === "object" &&
    (value as { error: unknown }).error !== null
  );
}

export class ApiError extends Error {
  /** Machine-readable code, e.g. `invalid_request`, `lobby_error`. */
  readonly code: string;
  /** Whether retrying the exact same call could plausibly succeed. */
  readonly retryable: boolean;
  /** HTTP status, or 0 when the request never reached the server. */
  readonly status: number;

  constructor(
    message: string,
    options: { code?: string; retryable?: boolean; status?: number } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.code = options.code ?? "request_failed";
    this.retryable = options.retryable ?? false;
    this.status = options.status ?? 0;
  }
}

/** True for the `AbortError` a cancelled request throws. Callers should ignore those. */
export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/** Turn anything thrown into a message safe to render. */
export function errorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export interface RequestOptions {
  method?: "GET" | "POST";
  /** JSON body. Mutually exclusive with `form`. */
  json?: unknown;
  /** `multipart/form-data` body. The browser sets the boundary itself. */
  form?: FormData;
  signal?: AbortSignal;
}

/** Everything is mounted under `/api` on the backend. */
function buildUrl(path: string): string {
  return apiUrl(`api/${path.replace(/^\/+/, "")}`);
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    // A proxy or a crashed worker can return HTML; keep the text for the message.
    return text;
  }
}

function toApiError(body: unknown, status: number): ApiError {
  if (isErrorEnvelope(body)) {
    const { message, code, retryable } = body.error;
    return new ApiError(
      typeof message === "string" && message ? message : `Request failed (${status}).`,
      {
        code: typeof code === "string" ? code : undefined,
        retryable: typeof retryable === "boolean" ? retryable : status >= 500,
        status,
      },
    );
  }

  if (typeof body === "string" && body.trim() && body.length < 300) {
    return new ApiError(body.trim(), { status, retryable: status >= 500 });
  }

  return new ApiError(`Request failed (${status}).`, {
    status,
    retryable: status >= 500 || status === 429,
  });
}

/**
 * Perform one API call. Resolves with the parsed body, or throws `ApiError`.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method, json, form, signal } = options;
  const headers: Record<string, string> = { Accept: "application/json" };
  let body: BodyInit | undefined;

  if (form !== undefined) {
    body = form;
  } else if (json !== undefined) {
    body = JSON.stringify(json);
    headers["Content-Type"] = "application/json";
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path), {
      method: method ?? (body === undefined ? "GET" : "POST"),
      headers,
      body,
      signal,
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new ApiError(
      "Could not reach the Quizzatron server. Check your connection and try again.",
      { code: "network_error", retryable: true, status: 0 },
    );
  }

  const parsed = await readBody(response);

  if (!response.ok) {
    throw toApiError(parsed, response.status);
  }

  return parsed as T;
}

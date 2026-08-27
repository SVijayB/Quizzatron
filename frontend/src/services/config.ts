/**
 * Single place the frontend learns where the backend lives.
 *
 * Override with VITE_API_BASE_URL (see .env.example). Leaving it unset gives
 * you a local Flask backend in dev and the hosted deployment in a production
 * build, so `npm run dev` works against localhost without editing source.
 */

const DEFAULT_DEV_API = "http://localhost:5000";
const DEFAULT_PROD_API = "https://quizzatron.onrender.com";

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function resolveApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL;
  if (typeof fromEnv === "string" && fromEnv.trim().length > 0) {
    return stripTrailingSlash(fromEnv.trim());
  }
  return import.meta.env.PROD ? DEFAULT_PROD_API : DEFAULT_DEV_API;
}

/** Base URL for REST calls. Never ends in a slash. */
export const API_BASE_URL: string = resolveApiBaseUrl();

/** Socket.IO endpoint. Same origin as the REST API. */
export const SOCKET_URL: string = API_BASE_URL;

/** Join a path onto the API base without doubling or dropping slashes. */
export function apiUrl(path: string): string {
  return `${API_BASE_URL}/${path.replace(/^\/+/, "")}`;
}

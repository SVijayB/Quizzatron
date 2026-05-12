/**
 * Shared API configuration.
 * Uses localhost in development mode and the production Render URL otherwise.
 */

const PROD_URL = "https://quizzatron.onrender.com";
const DEV_BACKEND_PORT = import.meta.env.VITE_API_PORT || "5001";

function getDevBaseUrl() {
  if (typeof window === "undefined" || !window.location.hostname) {
    return `http://127.0.0.1:${DEV_BACKEND_PORT}`;
  }

  const hostname = window.location.hostname;
  const host = hostname.includes(":") ? `[${hostname}]` : hostname;
  return `http://${host}:${DEV_BACKEND_PORT}`;
}

export const BASE_URL = import.meta.env.DEV ? getDevBaseUrl() : PROD_URL;
export const API_BASE_URL = `${BASE_URL}/api`;
export const MULTIPLAYER_API_URL = `${API_BASE_URL}/multiplayer`;

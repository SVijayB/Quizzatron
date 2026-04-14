/**
 * Shared API configuration.
 * Uses localhost in development mode and the production Render URL otherwise.
 */

const PROD_URL = "https://quizzatron.onrender.com";
const DEV_URL = "http://127.0.0.1:5000";

export const BASE_URL = import.meta.env.DEV ? DEV_URL : PROD_URL;
export const API_BASE_URL = `${BASE_URL}/api`;
export const MULTIPLAYER_API_URL = `${API_BASE_URL}/multiplayer`;

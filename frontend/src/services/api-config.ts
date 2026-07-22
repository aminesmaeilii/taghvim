const DEV_API_BASE_URL = import.meta.env.DEV && import.meta.env.MODE !== "test" ? "http://localhost:3000" : "";
const ENV_API_BASE_URL = import.meta.env.VITE_API_URL || DEV_API_BASE_URL;

function isVercelRuntime(): boolean {
  return typeof window !== "undefined" && window.location.hostname.endsWith("vercel.app");
}

const vercelRuntime = isVercelRuntime();

export const API_BASE_URL = (vercelRuntime ? "" : ENV_API_BASE_URL).replace(/\/$/, "");

// On Vercel, API_BASE_URL is intentionally "" (same-origin relative fetch through vercel.json's
// rewrite), which is falsy — so callers must check this flag instead of truthiness of API_BASE_URL
// to decide whether to talk to the shared backend at all.
export const USE_REMOTE_API = vercelRuntime || Boolean(ENV_API_BASE_URL);

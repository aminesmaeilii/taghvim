const DEV_API_BASE_URL = import.meta.env.DEV && import.meta.env.MODE !== "test" ? "http://localhost:3000" : "";
const ENV_API_BASE_URL = import.meta.env.VITE_API_URL || DEV_API_BASE_URL;
const productionRuntime = import.meta.env.PROD && import.meta.env.MODE !== "test";

export const API_BASE_URL = ENV_API_BASE_URL.replace(/\/$/, "");

// An empty API_BASE_URL means "call /api/* on this same origin" (e.g. a reverse
// proxy forwards those paths to the backend) — callers must check this flag
// instead of the truthiness of API_BASE_URL to decide whether to talk to the
// backend at all. In production, missing API configuration is treated as an
// integration error instead of silently falling back to browser IndexedDB as
// the business-data source of truth.
export const USE_REMOTE_API = Boolean(ENV_API_BASE_URL) || productionRuntime;

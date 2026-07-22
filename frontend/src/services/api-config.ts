const DEV_API_BASE_URL = import.meta.env.DEV && import.meta.env.MODE !== "test" ? "http://localhost:3000" : "";
const ENV_API_BASE_URL = import.meta.env.VITE_API_URL || DEV_API_BASE_URL;

function isVercelRuntime(): boolean {
  return typeof window !== "undefined" && window.location.hostname.endsWith("vercel.app");
}

export const API_BASE_URL = (isVercelRuntime() ? "" : ENV_API_BASE_URL).replace(/\/$/, "");

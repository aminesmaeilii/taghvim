const LOG_KEY = "rooznegar.notified-tasks";
const RETENTION_MS = 24 * 60 * 60 * 1000;

type NotifiedLog = Record<string, number>;

function readLog(): NotifiedLog {
  try { return JSON.parse(localStorage.getItem(LOG_KEY) ?? "{}") as NotifiedLog; } catch { return {}; }
}

function writeLog(log: NotifiedLog): void {
  localStorage.setItem(LOG_KEY, JSON.stringify(log));
}

export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  return isNotificationSupported() ? Notification.permission : "unsupported";
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!isNotificationSupported()) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}

export function hasNotified(key: string): boolean {
  const timestamp = readLog()[key];
  return typeof timestamp === "number" && Date.now() - timestamp < RETENTION_MS;
}

export function markNotified(key: string): void {
  const log = readLog();
  log[key] = Date.now();
  const cutoff = Date.now() - RETENTION_MS;
  for (const entryKey of Object.keys(log)) if (log[entryKey] < cutoff) delete log[entryKey];
  writeLog(log);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([promise, new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error("timeout")), ms))]);
}

// Android Chrome/Firefox throw on `new Notification()` outside a service worker
// context, so a registered worker's showNotification() is tried first; desktop
// browsers (and any environment without a controlling worker) fall back below.
async function showViaServiceWorker(title: string, options?: NotificationOptions): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  try {
    const registration = await withTimeout(navigator.serviceWorker.ready, 3000);
    await registration.showNotification(title, options);
    return true;
  } catch { return false; }
}

function showViaConstructor(title: string, options?: NotificationOptions): boolean {
  try {
    const notification = new Notification(title, options);
    notification.onclick = () => { window.focus(); notification.close(); };
    return true;
  } catch { return false; }
}

export async function showBrowserNotification(title: string, options?: NotificationOptions): Promise<boolean> {
  if (getNotificationPermission() !== "granted") return false;
  if (await showViaServiceWorker(title, options)) return true;
  return showViaConstructor(title, options);
}

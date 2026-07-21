import { tauriPlatformAdapter } from "./tauri.adapter";
import { webPlatformAdapter } from "./web.adapter";
import type { PlatformAdapter } from "./platform.types";

function detectDesktopRuntime(): boolean {
  return "__TAURI_INTERNALS__" in globalThis;
}

export const platformAdapter: PlatformAdapter = detectDesktopRuntime()
  ? tauriPlatformAdapter
  : webPlatformAdapter;

export const isDesktopRuntime = platformAdapter.isDesktop;
export const platformInvoke = platformAdapter.invoke.bind(platformAdapter);

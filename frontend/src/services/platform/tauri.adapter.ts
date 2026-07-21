import type { PlatformAdapter } from "./platform.types";

export const tauriPlatformAdapter: PlatformAdapter = {
  isDesktop: true,
  async invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<T>(command, args);
  },
};

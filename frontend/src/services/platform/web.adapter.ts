import type { PlatformAdapter } from "./platform.types";

export const webPlatformAdapter: PlatformAdapter = {
  isDesktop: false,
  async invoke() {
    throw new Error("Tauri command is not available in the web runtime.");
  },
};

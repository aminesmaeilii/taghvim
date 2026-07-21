import { describe, expect, it } from "vitest";
import { contentRepository } from "./content-repository";

describe("content repository import", () => {
  it("merges workspace collections and settings", async () => {
    const result = await contentRepository.importWorkspace(JSON.stringify({
      workspace: {
        contents: [{ id: "imported-content", title: "محتوای واردشده" }],
        campaigns: [{ id: "imported-campaign", title: "کمپین واردشده" }],
        ideas: [{ id: "imported-idea", title: "ایده واردشده" }],
      },
      settings: { theme: "dark" },
    }));

    expect(result.imported).toBe(3);
    const workspace = await contentRepository.bootstrap();
    expect(workspace.contents.some((item) => item.id === "imported-content")).toBe(true);
    expect(workspace.campaigns.some((item) => item.id === "imported-campaign")).toBe(true);
    expect(workspace.ideas.some((item) => item.id === "imported-idea")).toBe(true);
    expect(await contentRepository.getSettings()).toEqual({ theme: "dark" });
  });
});

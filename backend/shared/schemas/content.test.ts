import { describe, expect, it } from "vitest";
import { contentSchema } from "./content";

const valid = { title: "راهنمای تقویم محتوا", platformId: "platform-1", typeId: "type-1", status: "draft", priority: "normal", publicationDate: "2026-07-19", publicationTime: "09:30", link: "" };

describe("content validation", () => {
  it("accepts a concise content item", () => { expect(contentSchema.safeParse(valid).success).toBe(true); });
  it("returns a Persian message for missing title", () => { const result = contentSchema.safeParse({ ...valid, title: "" }); expect(result.success).toBe(false); if (!result.success) expect(result.error.issues[0].message).toContain("عنوان"); });
  it("rejects invalid publication time", () => { expect(contentSchema.safeParse({ ...valid, publicationTime: "9:3" }).success).toBe(false); });
});

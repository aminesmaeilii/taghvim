import { describe, expect, it } from "vitest";
import { scoreIdea } from "./idea-scoring";

describe("scoreIdea", () => {
  it("rewards Zambil capture, seller value, trust, and measurable outcomes", () => {
    const strategic = scoreIdea({
      title: "پیامک بازگشت خریدار قبلی با لینک خرید امن",
      description: "برای زمبیلدارهای سایلنت، به مشتری قبلی پیامک بدهیم و او را به سبد خرید امن زمبیل برگردانیم تا سفارش، capture rate و تکرار خرید اندازه گیری شود.",
      notes: "تمرکز روی فروشنده، پرداخت امن، کاهش نشت به DM و گزارش فروش.",
      priority: "high",
    });
    const vanity = scoreIdea({
      title: "کمپین وایرال برای افزایش فالوور",
      description: "تبلیغات گسترده برای آگاهی از برند و بازدید بیشتر در اینستاگرام.",
      notes: "",
      priority: "normal",
    });

    expect(strategic.total).toBeGreaterThan(vanity.total);
    expect(strategic.total).toBeGreaterThanOrEqual(70);
    expect(vanity.risks.some((risk) => risk.includes("آگاهی"))).toBe(true);
  });
});

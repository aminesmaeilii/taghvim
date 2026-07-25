import { describe, expect, it } from "vitest";
import { addJalaliMonths, jalaliMonthDays, jalaliToIso, parseJalaliDate, toLatinDigits, toPersianDigits } from "./jalali";

describe("Jalali date utilities", () => {
  it("converts Nowruz 1403 accurately", () => { expect(jalaliToIso(1403, 1, 1)).toBe("2024-03-20"); });
  it("handles leap-year Esfand boundaries", () => { expect(jalaliToIso(1399, 12, 30)).toBe("2021-03-20"); });
  it("creates complete Saturday-first calendar grids", () => { const days = jalaliMonthDays(1403, 1); expect(days.length).toBeGreaterThanOrEqual(35); expect(days.length % 7).toBe(0); });
  it("normalizes Persian date digits", () => { expect(parseJalaliDate("۱۴۰۳/۰۱/۰۱")).toBe("2024-03-20"); expect(toLatinDigits("۱۴۰۳")).toBe("1403"); expect(toPersianDigits("1403")).toBe("۱۴۰۳"); });
  it("moves between Jalali years", () => { expect(addJalaliMonths(1403, 12, 1)).toEqual({ year: 1404, month: 1 }); });
});

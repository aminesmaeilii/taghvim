import { isValidJalaaliDate, jalaaliMonthLength, toGregorian, toJalaali } from "jalaali-js";

export const JALALI_MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"] as const;
export const JALALI_WEEKDAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه شنبه", "چهارشنبه", "پنجشنبه", "جمعه"] as const;

const formatter = new Intl.NumberFormat("fa-IR", { useGrouping: false });
const latinFormatter = new Intl.NumberFormat("en-US", { useGrouping: false });
const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
const latinDigits = "0123456789";

export function toPersianDigits(value: number | string): string {
  return String(value).replace(/\d/g, (digit) => persianDigits[Number(digit)] ?? digit);
}

export function toLatinDigits(value: string): string {
  return value.replace(/[۰-۹]/g, (digit) => latinDigits[persianDigits.indexOf(digit)] ?? digit).replace(/[٠-٩]/g, (digit) => latinDigits["٠١٢٣٤٥٦٧٨٩".indexOf(digit)] ?? digit);
}

function noonDate(isoDate: string): Date {
  return new Date(`${isoDate.slice(0, 10)}T12:00:00`);
}

export function todayIso(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function isoToJalaliParts(isoDate: string) {
  const date = noonDate(isoDate);
  return toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function formatJalaliDate(isoDate: string, options: { includeWeekday?: boolean; numerals?: "persian" | "english" } = {}): string {
  const { jy, jm, jd } = isoToJalaliParts(isoDate);
  const digits = options.numerals === "english" ? latinFormatter : formatter;
  const date = noonDate(isoDate);
  const core = `${digits.format(jd)} ${JALALI_MONTHS[jm - 1]} ${digits.format(jy)}`;
  return options.includeWeekday ? `${JALALI_WEEKDAYS[(date.getDay() + 1) % 7]}، ${core}` : core;
}

export function formatJalaliMonth(year: number, month: number, numerals: "persian" | "english" = "persian"): string {
  const digits = numerals === "english" ? latinFormatter : formatter;
  return `${JALALI_MONTHS[month - 1]} ${digits.format(year)}`;
}

export function jalaliToIso(year: number, month: number, day: number): string {
  if (!isValidJalaaliDate(year, month, day)) throw new Error("تاریخ جلالی وارد شده معتبر نیست.");
  const { gy, gm, gd } = toGregorian(year, month, day);
  return `${gy}-${String(gm).padStart(2, "0")}-${String(gd).padStart(2, "0")}`;
}

export function parseJalaliDate(value: string): string | null {
  const parts = toLatinDigits(value).trim().split(/[/-]/).map(Number);
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return null;
  try { return jalaliToIso(parts[0], parts[1], parts[2]); } catch { return null; }
}

export function getCurrentJalaliMonth() {
  const { jy, jm } = isoToJalaliParts(todayIso());
  return { year: jy, month: jm };
}

export function addJalaliMonths(year: number, month: number, delta: number) {
  const absolute = year * 12 + (month - 1) + delta;
  return { year: Math.floor(absolute / 12), month: (absolute % 12) + 1 };
}

export function jalaliMonthDays(year: number, month: number): string[] {
  const first = jalaliToIso(year, month, 1);
  const firstDate = noonDate(first);
  const leading = (firstDate.getDay() + 1) % 7;
  const start = new Date(firstDate);
  start.setDate(start.getDate() - leading);
  const count = Math.ceil((leading + jalaaliMonthLength(year, month)) / 7) * 7;
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  });
}

export function isSameJalaliMonth(isoDate: string, year: number, month: number): boolean {
  const { jy, jm } = isoToJalaliParts(isoDate);
  return jy === year && jm === month;
}

export function addDays(isoDate: string, amount: number): string {
  const date = noonDate(isoDate);
  date.setDate(date.getDate() + amount);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function startOfJalaliWeek(isoDate: string): string {
  const date = noonDate(isoDate);
  return addDays(isoDate, -((date.getDay() + 1) % 7));
}

export function formatNumber(value: number, numerals: "persian" | "english" = "persian"): string {
  return (numerals === "persian" ? formatter : latinFormatter).format(value);
}

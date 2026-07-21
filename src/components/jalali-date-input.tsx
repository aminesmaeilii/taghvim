import { useEffect, useState } from "react";
import { formatNumber, isoToJalaliParts, parseJalaliDate, toPersianDigits } from "../utils/jalali";

interface JalaliDateInputProps {
  value?: string;
  onChange: (value: string) => void;
  name?: string;
  id?: string;
  "aria-invalid"?: boolean;
}

function formatInputValue(value?: string): string {
  if (!value) return "";
  const { jy, jm, jd } = isoToJalaliParts(value);
  return toPersianDigits(`${formatNumber(jy, "english")}/${String(jm).padStart(2, "0")}/${String(jd).padStart(2, "0")}`);
}

export function JalaliDateInput({ value, onChange, ...props }: JalaliDateInputProps) {
  const [text, setText] = useState(() => formatInputValue(value));
  useEffect(() => { setText(formatInputValue(value)); }, [value]);
  return <input
    {...props}
    className="input jalali-date-input"
    inputMode="numeric"
    dir="ltr"
    placeholder="۱۴۰۵/۰۴/۲۸"
    value={text}
    onChange={(event) => {
      const next = event.target.value;
      setText(next);
      if (!next.trim()) { onChange(""); return; }
      const parsed = parseJalaliDate(next);
      if (parsed) onChange(parsed);
    }}
  />;
}

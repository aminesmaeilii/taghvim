export function Sparkline({ values, tone = "primary" }: { values: number[]; tone?: "primary" | "violet" | "teal" | "amber" }) {
  const max = Math.max(1, ...values);
  return <div className={`sparkline sparkline-${tone}`}>{values.map((value, index) => <span key={index} style={{ height: `${value <= 0 ? 4 : Math.max(10, Math.round((value / max) * 100))}%` }} />)}</div>;
}

export function DonutGauge({ percent, sublabel, tone = "primary" }: { percent: number; sublabel?: string; tone?: "primary" | "violet" | "teal" }) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const circumference = 2 * Math.PI * 38;
  const dash = (clamped / 100) * circumference;
  return <div className={`donut-gauge donut-gauge-${tone}`}>
    <svg viewBox="0 0 96 96" width="76" height="76">
      <circle cx="48" cy="48" r="38" className="donut-track" />
      <circle cx="48" cy="48" r="38" className="donut-value" strokeDasharray={`${dash} ${circumference - dash}`} strokeLinecap="round" transform="rotate(-90 48 48)" />
    </svg>
    <div className="donut-gauge-label"><strong>{clamped.toLocaleString("fa-IR")}%</strong>{sublabel && <span>{sublabel}</span>}</div>
  </div>;
}

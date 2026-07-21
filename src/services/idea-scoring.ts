import type { ContentIdea, IdeaScore, IdeaScoreBreakdown } from "../types/domain";

type Criterion = {
  key: string;
  label: string;
  maxPoints: number;
  keywords: string[];
  guidance: string;
};

const criteria: Criterion[] = [
  {
    key: "capture",
    label: "کمک به Capture",
    maxPoints: 20,
    keywords: ["capture", "کپچر", "خرید امن", "پرداخت", "سبد", "checkout", "چک اوت", "لینک خرید", "z-pool", "زی پول", "dm", "دایرکت", "نشت", "کانال"],
    guidance: "ایده باید کمک کند تقاضایی که زمبیل کشف می کند داخل مسیر خرید زمبیل بماند.",
  },
  {
    key: "seller",
    label: "ارزش برای فروشنده",
    maxPoints: 15,
    keywords: ["فروشنده", "زمبیلدار", "مغازه", "شاپ", "seller", "رفرال", "ارجاع", "بازگشت فروشنده", "سایلنت", "فعال سازی"],
    guidance: "فروشنده مشتری اصلی زمبیل است؛ ایده باید منفعت او را شفاف کند.",
  },
  {
    key: "trust",
    label: "اعتماد و کاهش ریسک",
    maxPoints: 15,
    keywords: ["اعتماد", "ضمانت", "ارسال", "تحویل", "مرجوع", "escrow", "امانت", "کیفیت", "مطابق عکس", "پاسخگویی", "ریجکت", "لغو", "تاخیر"],
    guidance: "ایده های قوی تر روی دردهای واقعی خریدار مثل ارسال، مطابقت با عکس و پاسخگویی دست می گذارند.",
  },
  {
    key: "retention",
    label: "بازگشت خریدار",
    maxPoints: 12,
    keywords: ["بازگشت", "تکرار خرید", "ریتنشن", "retention", "باشگاه مشتریان", "مشتری قبلی", "خریدار قبلی", "وفاداری", "پیگیری"],
    guidance: "۸۶٪ خریداران یک بار خرید کرده اند؛ ایده خوب یک چرخه بازگشت می سازد.",
  },
  {
    key: "evidence",
    label: "قابل سنجش بودن",
    maxPoints: 12,
    keywords: ["نرخ", "درصد", "سفارش", "فروش", "gmv", "aov", "عدد", "داشبورد", "آزمایش", "a/b", "kpi", "اندازه گیری", "گزارش"],
    guidance: "ایده باید بتواند با سفارش، capture، reject، repeat یا یک KPI روشن سنجیده شود.",
  },
  {
    key: "audience",
    label: "تناسب مخاطب و دسته",
    maxPoints: 10,
    keywords: ["خانم", "زن", "دختر", "لوازم التحریر", "آرایشی", "زیبایی", "مد", "لباس", "پوست", "مو", "اسباب بازی", "بازگشت به مدرسه"],
    guidance: "Playbook خریدار غالب را زن و سفارش ها را stationery/beauty/fashion-led توصیف می کند.",
  },
  {
    key: "channel",
    label: "تناسب کانال زمبیل",
    maxPoints: 8,
    keywords: ["ایتا", "بله", "روبیکا", "تلگرام", "اینستاگرام", "پیامک", "دینگ", "ربات", "برودکاست", "کانال"],
    guidance: "ایده بهتر است روی کانال های واقعی اجرای زمبیل بنشیند.",
  },
  {
    key: "clarity",
    label: "شفافیت اجرا",
    maxPoints: 8,
    keywords: ["برای", "تا", "با", "ارسال", "پیام", "کمپین", "لیست", "هفته", "روز", "فروشگاه", "خریدار"],
    guidance: "عنوان و توضیح باید آن قدر روشن باشد که بشود آن را به محتوا یا آزمایش تبدیل کرد.",
  },
];

const penaltyKeywords = ["آگاهی", "awareness", "وایرال", "ویروسی", "فالوور", "لایک", "بازدید", "تبلیغات گسترده", "بیلبورد", "اینفلوئنسر", "ادز", "ads"];

function normalize(value: string): string {
  return value.toLocaleLowerCase("fa-IR").replace(/ي/g, "ی").replace(/ك/g, "ک");
}

function matches(text: string, keywords: string[]): string[] {
  return keywords.filter((keyword) => text.includes(normalize(keyword)));
}

function scoreCriterion(text: string, criterion: Criterion): IdeaScoreBreakdown {
  const matched = matches(text, criterion.keywords);
  const densityBonus = text.length > 140 ? 2 : text.length > 70 ? 1 : 0;
  const points = Math.min(criterion.maxPoints, matched.length * 4 + densityBonus);
  return { key: criterion.key, label: criterion.label, points, maxPoints: criterion.maxPoints, matched, guidance: criterion.guidance };
}

function labelFor(total: number): IdeaScore["label"] {
  if (total >= 80) return "عالی";
  if (total >= 60) return "خوب";
  if (total >= 40) return "متوسط";
  return "ضعیف";
}

export function scoreIdea(input: Pick<ContentIdea, "title" | "description" | "notes" | "priority">): IdeaScore {
  const text = normalize([input.title, input.description, input.notes].filter(Boolean).join(" "));
  const breakdown = criteria.map((criterion) => scoreCriterion(text, criterion));
  const rawTotal = breakdown.reduce((sum, item) => sum + item.points, 0);
  const penalties = matches(text, penaltyKeywords);
  const penalty = Math.min(15, penalties.length * 5);
  const priorityBonus = ({ low: 0, normal: 1, high: 2, urgent: 2 } as const)[input.priority] ?? 0;
  const total = Math.max(0, Math.min(100, rawTotal - penalty + priorityBonus));
  const strongest = [...breakdown].sort((a, b) => b.points / b.maxPoints - a.points / a.maxPoints).slice(0, 3).filter((item) => item.points > 0);
  const weakest = breakdown.filter((item) => item.points < Math.ceil(item.maxPoints * 0.35)).slice(0, 3);
  const risks = weakest.map((item) => `${item.label}: ${item.guidance}`);
  if (penalty > 0) risks.unshift("این ایده نشانه هایی از تمرکز روی آگاهی/بازدید دارد؛ Playbook زمبیل acquisition عمومی را تا قبل از بهبود capture پیشنهاد نمی کند.");
  const recommendations = weakest.map((item) => item.guidance);
  if (!matches(text, ["capture", "خرید", "فروش", "سفارش", "پرداخت"]).length) recommendations.unshift("یک خروجی قابل سنجش مثل سفارش، capture rate، reject rate یا repeat purchase به ایده اضافه کنید.");

  return {
    total,
    label: labelFor(total),
    summary: total >= 70 ? "هم راستا با استراتژی Discover, then Capture زمبیل." : total >= 45 ? "قابل استفاده است، اما برای تبدیل شدن به آزمایش قوی تر باید دقیق تر شود." : "فعلاً بیشتر خام است و به اتصال روشن تر به capture، فروشنده یا اعتماد نیاز دارد.",
    strengths: strongest.map((item) => `${item.label}${item.matched.length ? ` (${item.matched.slice(0, 3).join("، ")})` : ""}`),
    risks,
    recommendations: [...new Set(recommendations)].slice(0, 4),
    breakdown,
    scoredAt: new Date().toISOString(),
  };
}

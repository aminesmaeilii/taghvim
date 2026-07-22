import type { MarketingRole } from "@shared/types/domain";

export interface KpiMetricDef {
  key: string;
  label: string;
  unit?: string;
}

export const KPI_CATALOG: Record<MarketingRole, KpiMetricDef[]> = {
  digital_marketing_manager: [
    { key: "overall_roi", label: "بازگشت سرمایه کلی", unit: "%" },
    { key: "monthly_budget_spent", label: "بودجه مصرف شده ماهانه", unit: "تومان" },
    { key: "active_campaigns", label: "کمپین های فعال" },
  ],
  seo_specialist: [
    { key: "organic_traffic", label: "ترافیک ارگانیک" },
    { key: "avg_keyword_rank", label: "میانگین رتبه کلیدواژه ها" },
    { key: "backlinks", label: "تعداد بک لینک" },
  ],
  ppc_specialist: [
    { key: "ctr", label: "نرخ کلیک (CTR)", unit: "%" },
    { key: "cpc", label: "هزینه هر کلیک (CPC)", unit: "تومان" },
    { key: "roas", label: "بازگشت هزینه تبلیغات (ROAS)" },
  ],
  social_media_manager: [
    { key: "followers_growth", label: "رشد دنبال کننده ها" },
    { key: "engagement_rate", label: "نرخ تعامل", unit: "%" },
    { key: "posts_published", label: "پست های منتشر شده" },
  ],
  content_marketing_specialist: [
    { key: "content_published", label: "محتوای منتشر شده" },
    { key: "content_in_pipeline", label: "محتوای در مسیر تولید" },
    { key: "avg_time_to_publish", label: "میانگین زمان تا انتشار", unit: "روز" },
  ],
  email_marketing_specialist: [
    { key: "open_rate", label: "نرخ بازکردن ایمیل", unit: "%" },
    { key: "click_rate", label: "نرخ کلیک ایمیل", unit: "%" },
    { key: "subscriber_growth", label: "رشد مشترکین" },
  ],
  marketing_automation_specialist: [
    { key: "active_workflows", label: "گردش کارهای فعال" },
    { key: "automation_conversions", label: "تبدیل های حاصل از اتوماسیون" },
    { key: "email_deliverability", label: "نرخ تحویل ایمیل", unit: "%" },
  ],
  marketing_analyst: [
    { key: "conversion_rate", label: "نرخ تبدیل", unit: "%" },
    { key: "cac", label: "هزینه جذب مشتری (CAC)", unit: "تومان" },
    { key: "ltv", label: "ارزش طول عمر مشتری (LTV)", unit: "تومان" },
  ],
  brand_manager: [
    { key: "brand_awareness", label: "میزان آگاهی از برند", unit: "%" },
    { key: "share_of_voice", label: "سهم از صدا (SOV)", unit: "%" },
    { key: "nps", label: "شاخص خالص ترویج کنندگان (NPS)" },
  ],
  growth_marketer: [
    { key: "mrr_growth", label: "رشد درآمد ماهانه", unit: "%" },
    { key: "activation_rate", label: "نرخ فعال سازی", unit: "%" },
    { key: "viral_coefficient", label: "ضریب ویروسی" },
  ],
  influencer_marketing_specialist: [
    { key: "active_collaborations", label: "همکاری های فعال" },
    { key: "reach", label: "دسترسی (Reach)" },
    { key: "engagement_rate", label: "نرخ تعامل", unit: "%" },
  ],
  affiliate_marketing_specialist: [
    { key: "active_affiliates", label: "بازاریاب های فعال" },
    { key: "affiliate_revenue", label: "درآمد افیلیت", unit: "تومان" },
    { key: "affiliate_conversion_rate", label: "نرخ تبدیل افیلیت", unit: "%" },
  ],
};

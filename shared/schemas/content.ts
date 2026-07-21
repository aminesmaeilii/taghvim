import { z } from "zod";

export const contentSchema = z.object({
  title: z.string().trim().min(2, "عنوان باید دست کم ۲ حرف داشته باشد.").max(180, "عنوان نمی تواند بیش از ۱۸۰ حرف باشد."),
  platformId: z.string().min(1, "یک پلتفرم انتخاب کنید."),
  typeId: z.string().min(1, "یک نوع محتوا انتخاب کنید."),
  status: z.enum(["draft", "in_progress", "review", "revision", "approved", "scheduled", "published", "archived", "cancelled"]),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  publicationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاریخ انتشار معتبر نیست."),
  publicationTime: z.string().regex(/^\d{2}:\d{2}$/, "زمان را به شکل ساعت:دقیقه وارد کنید.").or(z.literal("")),
  shortDescription: z.string().max(320, "توضیح کوتاه نمی تواند بیش از ۳۲۰ حرف باشد.").optional(),
  brief: z.string().optional(),
  campaignId: z.string().optional(),
  pillarId: z.string().optional(),
  owner: z.string().max(100).optional(),
  reviewer: z.string().max(100).optional(),
  caption: z.string().optional(),
  mainCopy: z.string().optional(),
  hook: z.string().max(300).optional(),
  callToAction: z.string().max(300).optional(),
  hashtags: z.string().max(500).optional(),
  keywords: z.string().max(500).optional(),
  link: z.string().url("نشانی لینک معتبر نیست.").or(z.literal("")),
  notes: z.string().optional(),
});

export type ContentFormInput = z.input<typeof contentSchema>;
export type ContentFormValues = z.output<typeof contentSchema>;

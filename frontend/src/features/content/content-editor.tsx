import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronDown, FileText, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { STATUS_META } from "@shared/constants/defaults";
import { useSaveContent, useWorkspace } from "../../hooks/use-workspace";
import { contentSchema, type ContentFormInput } from "@shared/schemas/content";
import { useUIStore } from "../../stores/ui-store";
import type { Content, ContentStatusKey } from "@shared/types/domain";
import { todayIso } from "@shared/utils/jalali";
import { Button, Dialog, Field, Select, Textarea } from "../../components/ui";
import { JalaliDateInput } from "../../components/jalali-date-input";
import { useAuth } from "../../hooks/use-auth-context";
import { useActivityLogger, useCurrentProfile } from "../../hooks/use-profile";

const clean = (value?: string) => value?.trim() || null;

function getFormDefaults(content: Content | undefined, date?: string, defaults?: { platformId: string; typeId: string; campaignId?: string }): ContentFormInput {
  return {
    title: content?.title ?? "", platformId: content?.platformId ?? defaults?.platformId ?? "", typeId: content?.typeId ?? defaults?.typeId ?? "", status: content?.status ?? "draft",
    priority: content?.priority ?? "normal", publicationDate: date ?? content?.publicationDate ?? todayIso(), publicationTime: content?.publicationTime ?? "",
    shortDescription: content?.shortDescription ?? "", brief: content?.brief ?? "", campaignId: content?.campaignId ?? defaults?.campaignId ?? "", pillarId: content?.pillarId ?? "",
    owner: content?.owner ?? "", reviewer: content?.reviewer ?? "", caption: content?.caption ?? "", mainCopy: content?.mainCopy ?? "",
    hook: content?.hook ?? "", callToAction: content?.callToAction ?? "", hashtags: content?.hashtags ?? "", keywords: content?.keywords ?? "", link: content?.link ?? "", notes: content?.notes ?? "",
  };
}

export function ContentEditor() {
  const { contentDialog, closeContentDialog, pushToast } = useUIStore();
  const workspace = useWorkspace();
  const save = useSaveContent();
  const { user } = useAuth();
  const { profile } = useCurrentProfile();
  const logActivity = useActivityLogger();
  const [section, setSection] = useState<"basic" | "details" | "workflow">("basic");
  const existing = workspace.data?.contents.find((item) => item.id === contentDialog.contentId);
  const defaultPlatform = workspace.data?.platforms.find((item) => !item.archivedAt)?.id ?? "";
  const defaultType = workspace.data?.types.find((item) => !item.archivedAt)?.id ?? "";
  const form = useForm<ContentFormInput>({ resolver: zodResolver(contentSchema), defaultValues: getFormDefaults(existing, contentDialog.date, { platformId: defaultPlatform, typeId: defaultType, campaignId: contentDialog.campaignId }) });
  const { register, handleSubmit, reset, control, formState: { errors } } = form;

  useEffect(() => { reset(getFormDefaults(existing, contentDialog.date, { platformId: defaultPlatform, typeId: defaultType, campaignId: contentDialog.campaignId })); setSection("basic"); }, [defaultPlatform, defaultType, existing, contentDialog.campaignId, contentDialog.date, contentDialog.open, reset]);
  if (!workspace.data) return null;
  const quick = contentDialog.quick && !existing;

  const onSubmit = async (values: ContentFormInput) => {
    const value = contentSchema.parse(values);
    const payload: Content = existing ? {
      ...existing,
      ...value,
      publicationTime: clean(value.publicationTime), shortDescription: clean(value.shortDescription), brief: clean(value.brief), campaignId: clean(value.campaignId), pillarId: clean(value.pillarId),
      owner: clean(value.owner), reviewer: clean(value.reviewer), caption: clean(value.caption), mainCopy: clean(value.mainCopy), hook: clean(value.hook), callToAction: clean(value.callToAction),
      hashtags: clean(value.hashtags), keywords: clean(value.keywords), link: clean(value.link), notes: clean(value.notes),
    } : {
      id: "", createdAt: "", updatedAt: "", archivedAt: null, sortOrder: 0, version: 0, contentVersion: 1,
      ...value, platformId: value.platformId || defaultPlatform, typeId: value.typeId || defaultType, publicationTime: clean(value.publicationTime), shortDescription: clean(value.shortDescription),
      brief: clean(value.brief), campaignId: clean(value.campaignId), pillarId: clean(value.pillarId), owner: clean(value.owner), reviewer: clean(value.reviewer), publisher: null,
      caption: clean(value.caption), mainCopy: clean(value.mainCopy), hook: clean(value.hook), callToAction: clean(value.callToAction), hashtags: clean(value.hashtags), keywords: clean(value.keywords),
      link: clean(value.link), sourceLink: null, notes: clean(value.notes), timezone: "Asia/Tehran", startDate: null, deadline: null, productionDate: null, reviewDate: null, recurrence: null,
      tagIds: [], checklist: [], attachments: [], performance: null,
    };
    if (user) { payload.updatedByName = `${user.firstName} ${user.lastName}`.trim(); payload.updatedByRole = profile?.jobRole ?? null; }
    try {
      const saved = await save.mutateAsync(payload);
      logActivity(existing ? "content.update" : "content.create", "content", saved.id, saved.title);
      pushToast({ title: existing ? "تغییرات محتوا ذخیره شد." : "محتوای جدید ایجاد شد." });
      closeContentDialog();
    } catch { pushToast({ title: "ذخیره محتوا ممکن نشد. دوباره تلاش کنید." }); }
  };

  return <Dialog open={contentDialog.open} onClose={closeContentDialog} title={existing ? "ویرایش محتوا" : quick ? "افزودن سریع محتوا" : "محتوای جدید"} description={quick ? "برای ادامه برنامه ریزی، فقط اطلاعات اصلی را وارد کنید." : "اطلاعات اصلی را وارد کنید. جزئیات تکمیلی در بخش های بعدی در دسترس است."} wide={!quick}>
    <form className="editor-form" onSubmit={handleSubmit(onSubmit)}>
      {!quick && <div className="editor-tabs" role="tablist" aria-label="بخش های فرم محتوا">
        <button type="button" className={section === "basic" ? "active" : ""} onClick={() => setSection("basic")} role="tab" aria-selected={section === "basic"}>اطلاعات اصلی</button>
        <button type="button" className={section === "details" ? "active" : ""} onClick={() => setSection("details")} role="tab" aria-selected={section === "details"}>جزئیات محتوا</button>
        <button type="button" className={section === "workflow" ? "active" : ""} onClick={() => setSection("workflow")} role="tab" aria-selected={section === "workflow"}>گردش کار</button>
      </div>}
      {(section === "basic" || quick) && <div className="form-grid">
        <Field label="عنوان" error={errors.title?.message}><input autoFocus className="input" placeholder="مثال: معرفی محصول جدید" {...register("title")} /></Field>
        <Field label="تاریخ انتشار جلالی" error={errors.publicationDate?.message}><Controller control={control} name="publicationDate" render={({ field }) => <JalaliDateInput value={field.value} onChange={field.onChange} name={field.name} aria-invalid={Boolean(errors.publicationDate)} />} /></Field>
        <Field label="پلتفرم" error={errors.platformId?.message}><Select {...register("platformId")}><option value="">انتخاب پلتفرم</option>{workspace.data.platforms.filter((item) => !item.archivedAt).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
        <Field label="نوع محتوا" error={errors.typeId?.message}><Select {...register("typeId")}><option value="">انتخاب نوع محتوا</option>{workspace.data.types.filter((item) => !item.archivedAt).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
        <Field label="ساعت انتشار" optional error={errors.publicationTime?.message}><input className="input ltr-input" type="time" {...register("publicationTime")} /></Field>
        <Field label="وضعیت"><Select {...register("status")}>{Object.entries(STATUS_META).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}</Select></Field>
        {!quick && <><Field label="اولویت"><Select {...register("priority")}><option value="low">کم</option><option value="normal">عادی</option><option value="high">زیاد</option><option value="urgent">فوری</option></Select></Field>
        <Field label="کمپین" optional><Select {...register("campaignId")}><option value="">بدون کمپین</option>{workspace.data.campaigns.filter((item) => !item.archivedAt).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</Select></Field>
        <Field label="توضیح کوتاه" optional><Textarea rows={3} placeholder="خلاصه ای برای همکاران" {...register("shortDescription")} /></Field>
        <Field label="خلاصه تولید" optional><Textarea rows={3} placeholder="هدف، مخاطب و چارچوب اجرا" {...register("brief")} /></Field></>}
      </div>}
      {!quick && section === "details" && <div className="form-grid">
        <Field label="کپشن" optional><Textarea rows={5} {...register("caption")} /></Field><Field label="متن اصلی" optional><Textarea rows={5} {...register("mainCopy")} /></Field>
        <Field label="هوک" optional><Textarea rows={2} {...register("hook")} /></Field><Field label="دعوت به اقدام" optional><Textarea rows={2} {...register("callToAction")} /></Field>
        <Field label="هشتگ ها" optional><input className="input" placeholder="#روزنگار #تقویم_محتوا" {...register("hashtags")} /></Field><Field label="کلیدواژه ها" optional><input className="input" {...register("keywords")} /></Field>
        <Field label="لینک" optional error={errors.link?.message}><input className="input ltr-input" placeholder="https://" {...register("link")} /></Field><Field label="یادداشت داخلی" optional><Textarea rows={3} {...register("notes")} /></Field>
      </div>}
      {!quick && section === "workflow" && <div className="form-grid">
        <Field label="مسئول محتوا" optional><input className="input" {...register("owner")} /></Field><Field label="بازبین" optional><input className="input" {...register("reviewer")} /></Field>
        <Field label="ستون محتوا" optional><Select {...register("pillarId")}><option value="">بدون ستون</option>{workspace.data.pillars.filter((item) => !item.archivedAt).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
        <div className="editor-note"><FileText size={20} /><div><strong>جزئیات پیشرفته</strong><p>چک لیست، پیوست و سنجه های عملکرد پس از ایجاد محتوا در پیش نمایش آن قابل مدیریت هستند.</p></div></div>
      </div>}
      <footer className="dialog-footer"><Button type="button" variant="secondary" onClick={closeContentDialog}>انصراف</Button><Button type="submit" disabled={save.isPending}><Save size={17} />{save.isPending ? "در حال ذخیره" : "ذخیره محتوا"}</Button></footer>
    </form>
  </Dialog>;
}

export function ContentStatusSelect({ value, onChange }: { value: ContentStatusKey; onChange: (value: ContentStatusKey) => void }) {
  return <label className="compact-select"><span>وضعیت</span><select value={value} onChange={(event) => onChange(event.target.value as ContentStatusKey)}>{Object.entries(STATUS_META).map(([key, status]) => <option key={key} value={key}>{status.label}</option>)}</select><ChevronDown size={14} /></label>;
}

export function Checkmark() { return <Check size={15} />; }

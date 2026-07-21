# طرح پایگاه داده

Migration اولیه در `src-tauri/migrations/001_initial.sql` قرار دارد و از ابتدا با `PRAGMA foreign_keys = ON` و indexهای مسیرهای پرتکرار اجرا می‌شود.

## جدول‌های اصلی

- `contents`: عنوان، زمان انتشار جلالی/ISO، وضعیت، platform، type، campaign، pillar، اولویت و متن اصلی
- `platforms`: پلتفرم‌ها، رنگ، آیکن، سقف کاراکتر و زمان انتشار پیش‌فرض
- `content_types`: نوع‌های محتوا و ترتیب نمایش
- `content_statuses`: وضعیت‌های قابل تنظیم و محدودیت WIP
- `campaigns`: هدف، بازه، KPI و پیام اصلی کمپین
- `content_pillars`: ستون‌های محتوایی
- `tags` و `content_tags`: برچسب‌ها و رابطهٔ چندبه‌چند
- `checklist_items`: چک‌لیست هر محتوا
- `attachments`: metadata فایل‌ها، بدون کپی کردن فایل در database
- `performance_metrics`: شاخص‌های پس از انتشار
- `content_history`: تغییرات مهم برای activity history و Undoهای آینده
- `application_settings`: تنظیمات کوچک برنامه
- `backup_history`: سابقهٔ پشتیبان‌گیری

فیلدهای پیچیدهٔ کم‌تکرار مانند checklist metadata و performance note می‌توانند JSON معتبر و versioned داشته باشند؛ فیلتر و مرتب‌سازی اصلی روی ستون‌های مستقل و indexشده انجام می‌شود.

## indexهای مهم

`publication_date`، `status`، `platform_id`، `campaign_id`، `title` و `archived_at` برای calendar، list و dashboard index شده‌اند. داده‌های آرشیوی در queryهای عادی برگردانده نمی‌شوند.

## مهاجرت

هر تغییر schema باید migration شماره‌دار جدید داشته باشد. migration نباید دادهٔ کاربر را silently حذف کند. قبل از restore، backup خودکار در `backup_history` ثبت می‌شود.

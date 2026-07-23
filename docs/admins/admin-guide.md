# Administrator Guide

Audience: application and team administrators  
Last verified version: `0.1.1` / commit `8842877`

## کاربران و نقش ها

نقش ها از `shared/services/authorization.ts` می آیند. کاربران می توانند نقش اصلی و مجوزهای اضافه داشته باشند. تابع `effectivePermissions` نقش و `extraPermissions` را ترکیب و تکرار را حذف می کند.

Sensitive permissions:

- `roles.delete`
- `users.delete`
- `security_sessions.manage_all`
- `technical_health.read`
- `technical_jobs.retry`
- `backup.restore_production`
- `backup.delete`

## تنظیمات

صفحه `/settings` تنظیمات کاربر، فضای کاری، کاربران، نقش ها، منابع محتوا، منابع Monitoring و تنظیمات فنی را در UI موجود مدیریت می کند. اعمال مدیریتی باید با مجوز مناسب انجام شود؛ UI جایگزین کنترل سمت سرور نیست.

## مانیتورینگ اجتماعی

افزودن/ویرایش منبع Monitoring و اجرای دستی جمع آوری داده در کد فعلی با `settings.update` محافظت می شود.

## سلامت فنی و بکاپ

داشبورد `/technical-health` فقط برای کاربران دارای `technical_health.read` نمایش داده می شود. وضعیت بکاپ از متغیرهای runtime مانند `BACKUP_LAST_SUCCESS_AT` و `BACKUP_LAST_RESTORE_TEST_AT` خوانده می شود.

## کارهایی که نباید انجام شود

- نقش یا مجوز را فقط در frontend تغییر ندهید.
- داده production را برای تست UI یا load test استفاده نکنید.
- بکاپ یا dump را به Git اضافه نکنید.
- Push را بدون توضیح به کاربر درخواست نکنید.

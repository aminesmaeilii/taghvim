# معماری روزنگار

## لایه‌ها

```text
React routes and feature pages
        |
Reusable UI components + Zustand UI state
        |
TanStack Query hooks
        |
ContentRepository interface
        |-----------------------------|
BrowserRepository                  TauriRepository
IndexedDB fallback                 Tauri IPC boundary
        |                             |
        |                         Rust commands
        |                             |
        |                         SQLite + migrations
```

کامپوننت‌های رابط کاربری مستقیماً به database وصل نمی‌شوند. تمام عملیات پایدار از `src/services/content-repository.ts` عبور می‌کنند تا اضافه شدن sync یا remote storage در آینده به تغییر featureها نیاز نداشته باشد.

## سازمان‌دهی کد

- `src/app`: routing، query client و error boundary
- `src/components`: shell و primitiveهای قابل استفادهٔ مجدد
- `src/features`: صفحات و جریان‌های مربوط به calendar، content، workflow، planning، reports و settings
- `src/hooks`: query/mutation boundary
- `src/services`: repository و IPC
- `src/schemas`: validation با Zod
- `src/utils`: تبدیل جلالی، قالب‌بندی و منطق عمومی
- `src-tauri`: bootstrap دسکتاپ، commands، migration و مجوزها

## منبع حقیقت

SQLite منبع حقیقت انتشار دسکتاپ است. IndexedDB فقط fallback توسعه و preview مرورگر است و برای localStorage تنها preferenceهای کوچک مانند تم و وضعیت sidebar استفاده می‌شود.

## خطا و feedback

خطای فنی باید در مرز repository/IPC ثبت شود و در UI به متن فارسی قابل اقدام تبدیل شود. عملیات برگشت‌پذیر مانند حرکت محتوا یا تغییر وضعیت باید toast با Undo داشته باشند. عملیات حذف با تأیید انجام می‌شوند و بایگانی گزینهٔ ترجیحی است.

## بسته‌بندی

Vite خروجی frontend را در `dist` می‌سازد. Tauri در حالت توسعه به پورت `1420` وصل می‌شود و با `tauri build` برای Windows، macOS و Linux بسته تولید می‌کند. جزئیات تنظیمات در `src-tauri/tauri.conf.json` است.

# سیستم احراز هویت زمبیل

## معماری فعلی

پروژه React + Vite + Tauri است. در حالت دسکتاپ، Backend واقعی از طریق Tauri Commands و SQLite محلی کار می کند. در حالت dev/web، داده ها در IndexedDB/Memory نگهداری می شوند.

پیاده سازی فعلی Auth برای اجرای محلی و dev روی IndexedDB مرورگر ساخته شده است و شامل موارد زیر است:

- حساب Bootstrap با `admin / password`
- اجبار تغییر رمز اولیه
- Hash رمز با WebCrypto و PBKDF2 + Salt
- Session قابل ابطال با token hash شده در دیتابیس Auth
- نگهداری session فعلی در `sessionStorage`
- RBAC با نقش های `SUPER_ADMIN`, `ADMIN`, `MANAGER`, `USER`, `VIEWER`
- Permissionهای مستقل مطابق درخواست
- Data Scopeهای `ALL`, `ORGANIZATION`, `DEPARTMENT`, `TEAM`, `ASSIGNED`, `OWN`, `NONE`
- مدیریت کاربران در تنظیمات
- پروفایل کاربری
- تغییر رمز و ابطال نشست های دیگر
- نشست های فعال و revoke
- Audit Log داخلی برای رویدادهای مهم
- قفل موقت پس از تلاش های ناموفق

## ورود اولیه

```text
Username: admin
Password: password
```

این حساب با `mustChangePassword = true` ساخته می شود. تا زمانی که رمز تغییر نکند، کاربر به داشبورد دسترسی ندارد.

## مسیرهای جدید

- `/login`
- `/force-password-change`
- `/profile`
- `/sessions`
- `/settings` شامل ماژول مدیریت کاربران برای کاربران دارای `users.view`

## نقش ها و Permissionها

Permissionها در `src/services/auth-service.ts` در `ALL_PERMISSIONS` تعریف شده اند. برای محافظت از UI:

```ts
const { hasPermission } = useAuth();
hasPermission("users.create")
```

برای عملیات Auth:

```ts
await authService.requirePermission("users.create");
```

## اجرای Seed

Seed به صورت idempotent در `authService.bootstrap()` انجام می شود. اگر Super Admin فعال وجود داشته باشد، حساب جدید ساخته نمی شود.

## نکات مهم Production

این پروژه هنوز API سرور جدا ندارد. برای Production دسکتاپ باید همین policyها در Rust/Tauri commandها enforce شوند:

1. همه commandهای حساس باید `sessionToken` بگیرند.
2. session در SQLite با token hash شده ذخیره شود.
3. هر command قبل از خواندن/نوشتن داده، `require_auth` و `require_permission` را در Rust اجرا کند.
4. داده ها در Frontend فیلتر نشوند؛ query سمت Backend باید بر اساس Data Scope محدود شود.
5. رمز اولیه از Environment Variable خوانده شود و در log/UI چاپ نشود.
6. برای hash رمز در Rust از Argon2id یا bcrypt استفاده شود.
7. Password reset واقعی نیازمند سرویس ایمیل یا flow دعوت امن است.
8. Profile image upload هنوز پیاده سازی نشده و باید با MIME/signature validation و re-encode امن اضافه شود.
9. 2FA/TOTP در این فاز فقط از نظر مدل و مستندات آماده شده و هنوز پیاده نشده است.

## تست ها

```bash
npm test
npm run build
npm run lint
```

## محدودیت شناخته شده

نسخه فعلی امنیت Routeها و عملیات کاربران را در لایه Auth Service مرورگر اعمال می کند. برای مطابقت کامل با معیارهای امنیتی Backend، مرحله بعدی باید migrate کردن Auth به `src-tauri/src/lib.rs` و محافظت commandهای داده باشد.

# Zambil Content Calendar

داشبورد محتوایی زمبیل یک اپ React + TypeScript + Vite برای برنامه ریزی محتوا، ایده پردازی، PR، CMO و Content Creator است. پروژه دو مسیر runtime دارد:

- Web/Vercel: ذخیره سازی local-first در IndexedDB مرورگر.
- Desktop/Tauri: ذخیره سازی SQLite از طریق command های Tauri در `src-tauri`.

## Architecture

```text
src/
  app/                    React routes and app shell wiring
  components/             Shared UI components
  constants/              Default Zambil references and palettes
  features/               Dashboard, content, planning, reports, auth, settings
  services/
    platform/             Web/Tauri runtime boundary
    auth-service.ts        Browser/dev auth storage
    content-repository.ts  Repository facade with web and Tauri implementations
  styles/                 Application CSS
src-tauri/                Tauri v2 Rust desktop backend
dist/                     Web build output, generated
vercel.json               Vercel SPA deployment settings
```

مرز Tauri در `src/services/platform` ایزوله شده است. وب هیچ import مستقیم و sync از `@tauri-apps/api` ندارد؛ command ها فقط داخل adapter دسکتاپ و با dynamic import اجرا می شوند. اگر اپ روی وب اجرا شود، repository مرورگر از IndexedDB استفاده می کند.

## Requirements

- Node.js 20.x برای Vercel و CI
- npm
- برای Desktop: Rust, Cargo, Tauri prerequisites و WebView2 روی Windows

## Local Development

```powershell
npm ci
npm run dev
```

آدرس توسعه وب و Tauri:

- Web: `http://127.0.0.1:1420`
- اگر مرورگر شما اتصال نگرفت، می توانید Vite را دستی با host بازتر اجرا کنید: `npx vite --host 0.0.0.0 --port 5173`

## Quality Commands

```powershell
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run verify
```

## Preview

```powershell
npm run build
npm run preview
```

خروجی production وب از پوشه `dist` سرو می شود.

## Vercel Deployment

تنظیمات پیشنهادی Vercel:

- Framework Preset: `Vite`
- Install Command: `npm ci`
- Build Command: `npm run build`
- Output Directory: `dist`
- Node.js Version: `20.x`

`vercel.json` شامل rewrite برای SPA است تا مسیرهای مستقیم به `index.html` برگردند.

## Environment

در حال حاضر هیچ متغیر production اجباری برای web build وجود ندارد. فقط متغیرهای با پیشوند `VITE_` وارد bundle مرورگر می شوند. فایل `.env.example` برای مستندسازی development است.

نکته امنیتی: احراز هویت فعلی در نسخه وب local-first و مخصوص محیط داخلی/توسعه است. برای production واقعی با کاربرهای چندنفره، session و permission باید به backend قابل اعتماد یا command های محافظت شده Tauri منتقل شود.

## Desktop/Tauri

```powershell
npm run tauri:dev
npm run tauri:build
```

Tauri قبل از build دسکتاپ از `npm run build` استفاده می کند و خروجی `dist` را داخل برنامه بسته بندی می کند. کد Rust و migration ها در `src-tauri` نگه داشته شده اند.

## Data Model

- Web: `ContentRepository` داده ها را در IndexedDB با نام `rooznegar-offline` ذخیره می کند.
- Desktop: همان facade command های Tauri را صدا می زند و داده در SQLite مدیریت می شود.
- import/export و backup از صفحه تنظیمات در دسترس است.

## Production Notes

- Vercel build وب local-first است و بک اند ابری ندارد.
- داده های هر مرورگر جداست و sync بین کاربران انجام نمی شود.
- برای داده سازمانی واقعی، API/server database باید اضافه شود.
- فایل های generated مثل `dist`, `src-tauri/target`, `installers`, log ها و `.vercel` در `.gitignore` هستند.

import { Bell, CalendarDays, ChevronLeft, ClipboardList, FolderKanban, Gauge, Lightbulb, LogOut, Menu, Moon, PanelRightClose, Plus, Search, Settings, ShieldCheck, Sparkles, Sun, TableProperties, UserCircle, Workflow, X } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useUIStore } from "../stores/ui-store";
import { IconButton, Input } from "./ui";
import { ContentEditor } from "../features/content/content-editor";
import zambilLogo from "../assets/zambil-logo.jpg";
import { useAuth } from "../hooks/use-auth-context";

const navigation = [
  ["/", "داشبورد", Gauge], ["/calendar", "تقویم محتوا", CalendarDays], ["/jalali-calendar", "تقویم شمسی", CalendarDays], ["/contents", "فهرست محتوا", TableProperties],
  ["/workflow", "گردش کار", Workflow], ["/campaigns", "کمپین ها", FolderKanban], ["/ideas", "ایده ها", Lightbulb],
  ["/templates", "قالب ها", ClipboardList], ["/reports", "گزارش ها", Sparkles], ["/settings", "تنظیمات", Settings],
] as const;

export function AppShell() {
  const navigate = useNavigate();
  const { sidebarCollapsed, toggleSidebar, theme, setTheme, openContentDialog, toasts, dismissToast } = useUIStore();
  const { user, logout } = useAuth();
  const [systemDark, setSystemDark] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, [theme]);
  const resolvedTheme = theme === "system" ? (systemDark ? "dark" : "light") : theme;
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = new FormData(event.currentTarget).get("q")?.toString().trim();
    if (query) navigate(`/contents?q=${encodeURIComponent(query)}`);
  };
  return <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`} data-theme={resolvedTheme}>
    <a className="skip-link" href="#main-content">پرش به محتوای اصلی</a>
    <aside className="sidebar" aria-label="ناوبری اصلی">
      <div className="brand"><div className="brand-mark"><img src={zambilLogo} alt="" /></div><span>زمبیل</span><IconButton label="جمع کردن نوار" onClick={toggleSidebar}><PanelRightClose size={18} /></IconButton></div>
      <nav>{navigation.map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`} title={sidebarCollapsed ? label : undefined}><Icon size={19} /><span>{label}</span></NavLink>)}</nav>
      <div className="sidebar-footer"><span>نسخه ۰.۱.۱</span></div>
    </aside>
    <div className="workspace">
      <header className="topbar">
        <IconButton className="menu-button" label="باز کردن ناوبری" onClick={toggleSidebar}><Menu size={20} /></IconButton>
        <form className="global-search" onSubmit={submitSearch}><Search size={18} /><Input name="q" aria-label="جستجوی سراسری" placeholder="جستجو در محتوا، برچسب و یادداشت" /><kbd>Ctrl K</kbd></form>
        <div className="topbar-actions">
          <IconButton label={theme === "dark" ? "تم روشن" : "تم تاریک"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</IconButton>
          <IconButton label="مرکز اعلان ها"><Bell size={18} /></IconButton>
          <div className="account-menu"><button type="button" className="account-trigger"><UserCircle size={18} /><span>{user?.firstName ?? "کاربر"}</span></button><div className="account-popover"><button type="button" onClick={() => navigate("/profile")}><UserCircle size={16} />پروفایل</button><button type="button" onClick={() => navigate("/sessions")}><ShieldCheck size={16} />نشست ها</button><button type="button" onClick={() => void logout().then(() => navigate("/login", { replace: true }))}><LogOut size={16} />خروج</button></div></div>
          <button className="button button-primary" type="button" onClick={() => openContentDialog({ quick: true })}><Plus size={18} />محتوای جدید</button>
        </div>
      </header>
      <main id="main-content"><Outlet /></main>
    </div>
    <div className="toast-region" aria-live="polite">{toasts.map((toast) => <div className="toast" key={toast.id}><span>{toast.title}</span>{toast.action && <button type="button" onClick={toast.action.onClick}>{toast.action.label}</button>}<IconButton label="بستن پیام" onClick={() => dismissToast(toast.id)}><X size={16} /></IconButton></div>)}</div>
    <ContentEditor />
  </div>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return <header className="page-header"><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</header>;
}

export function BackButton({ onClick }: { onClick: () => void }) { return <IconButton label="بازگشت" onClick={onClick}><ChevronLeft size={18} /></IconButton>; }

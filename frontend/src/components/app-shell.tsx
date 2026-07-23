import { Activity, CalendarDays, CheckSquare, ChevronLeft, ClipboardList, FolderKanban, GanttChart, Gauge, GraduationCap, History, Lightbulb, LogOut, Megaphone, Menu, Moon, MoreHorizontal, NotebookPen, PanelRightClose, Plus, Radar, Search, Settings, ShieldCheck, Sparkles, Sun, TableProperties, UserCircle, Workflow, X } from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { lazy, Suspense, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useUIStore } from "../stores/ui-store";
import { IconButton, Input } from "./ui";
import { ContentEditor } from "../features/content/content-editor";
import zambilLogo from "../assets/zambil-logo.jpg";
import { useAuth } from "../hooks/use-auth-context";
import { useContentNotifications } from "../hooks/use-content-notifications";
import { useCurrentProfile } from "../hooks/use-profile";
import { useProfileSync } from "../hooks/use-profile-sync";
import { NotificationCenter } from "../features/notifications/notification-center";
import type { Permission } from "@shared/types/auth";

const ChatLauncher = lazy(() => import("../features/chat/chat-launcher"));

type NavigationItem = { to: string; label: string; icon: typeof Gauge; permissions?: Permission[] };

const navigationGroups: Array<{ label: string; items: NavigationItem[] }> = [
  { label: "کار روزانه", items: [
    { to: "/", label: "داشبورد", icon: Gauge, permissions: ["dashboard.view"] },
    { to: "/calendar", label: "تقویم محتوا", icon: CalendarDays },
    { to: "/tasks", label: "وظیفه ها", icon: CheckSquare },
    { to: "/contents", label: "فهرست محتوا", icon: TableProperties },
    { to: "/workflow", label: "گردش کار", icon: Workflow },
    { to: "/campaigns", label: "کمپین ها", icon: FolderKanban },
  ] },
  { label: "برنامه ریزی", items: [
    { to: "/gantt", label: "گانت چارت", icon: GanttChart },
    { to: "/ideas", label: "ایده ها", icon: Lightbulb },
    { to: "/templates", label: "قالب ها", icon: ClipboardList },
    { to: "/advertising", label: "تبلیغات", icon: Megaphone },
    { to: "/education", label: "آموزش", icon: GraduationCap },
    { to: "/notes", label: "یادداشت شخصی", icon: NotebookPen },
  ] },
  { label: "تحلیل", items: [
    { to: "/reports", label: "گزارش ها", icon: Sparkles, permissions: ["reports.view"] },
    { to: "/monitoring", label: "مانیتورینگ اجتماعی", icon: Radar },
  ] },
  { label: "مدیریت", items: [
    { to: "/settings", label: "تنظیمات", icon: Settings, permissions: ["settings.view", "settings.update"] },
    { to: "/activity", label: "تاریخچه تغییرات", icon: History, permissions: ["audit_logs.view", "users.view_activity"] },
  ] },
  { label: "فنی", items: [
    { to: "/technical-health", label: "سلامت سامانه", icon: Activity, permissions: ["technical_health.read"] },
  ] },
];

const MOBILE_PRIMARY_ROUTES = ["/", "/calendar", "/workflow"];

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sidebarCollapsed, toggleSidebar, closeSidebar, theme, setTheme, openContentDialog, toasts, dismissToast } = useUIStore();
  const { user, logout } = useAuth();
  const { profile } = useCurrentProfile();
  useContentNotifications();
  useProfileSync();
  const [systemDark, setSystemDark] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  const [moreOpen, setMoreOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, [theme]);

  useEffect(() => { setMoreOpen(false); setMobileSearchOpen(false); }, [location.pathname]);

  const resolvedTheme = theme === "system" ? (systemDark ? "dark" : "light") : theme;
  const visibleGroups = useMemo(() => {
    const canSee = (item: NavigationItem) => !item.permissions?.length || item.permissions.some((permission) => user?.permissions.includes(permission));
    return navigationGroups.map((group) => ({ ...group, items: group.items.filter(canSee) })).filter((group) => group.items.length > 0);
  }, [user?.permissions]);
  const visibleNavigation = visibleGroups.flatMap((group) => group.items);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = new FormData(event.currentTarget).get("q")?.toString().trim();
    if (query) navigate(`/contents?q=${encodeURIComponent(query)}`);
  };

  return <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`} data-theme={resolvedTheme}>
    <a className="skip-link" href="#main-content">پرش به محتوای اصلی</a>
    {!sidebarCollapsed && <button type="button" className="sidebar-backdrop" aria-label="بستن نوار کناری" onClick={closeSidebar} />}
    <aside className="sidebar" aria-label="ناوبری اصلی">
      <div className="brand"><button type="button" className="brand-mark" onClick={toggleSidebar} aria-label={sidebarCollapsed ? "باز کردن نوار" : "جمع کردن نوار"}><img src={zambilLogo} alt="" /></button><span>زمبیل</span><IconButton label="جمع کردن نوار" onClick={toggleSidebar}><PanelRightClose size={18} /></IconButton></div>
      <nav>{visibleGroups.map((group) => <section className="nav-group" key={group.label} aria-label={group.label}><span className="nav-group-label">{group.label}</span>{group.items.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`} title={sidebarCollapsed ? label : undefined} onClick={() => { if (window.matchMedia("(max-width: 680px)").matches) closeSidebar(); }}><Icon size={19} /><span>{label}</span></NavLink>)}</section>)}</nav>
      <div className="sidebar-footer"><span>نسخه ۰.۱.۱</span></div>
    </aside>
    <div className="workspace">
      <header className="topbar">
        <IconButton className="menu-button" label="باز کردن ناوبری" onClick={toggleSidebar}><Menu size={20} /></IconButton>
        <form className={`global-search ${mobileSearchOpen ? "mobile-search-open" : ""}`} onSubmit={submitSearch}><Search size={18} /><Input name="q" aria-label="جستجوی سراسری" placeholder="جستجو در محتوا، برچسب و یادداشت" autoFocus={mobileSearchOpen} /></form>
        <div className="topbar-actions">
          <IconButton className="mobile-search-toggle" label="جستجو" onClick={() => setMobileSearchOpen((value) => !value)}><Search size={18} /></IconButton>
          <IconButton label={theme === "dark" ? "تم روشن" : "تم تاریک"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</IconButton>
          <NotificationCenter />
          <div className="account-menu"><button type="button" className="account-trigger">{profile?.avatarUrl ? <img className="account-avatar" src={profile.avatarUrl} alt="" /> : <UserCircle size={18} />}<span>{user?.firstName ?? "کاربر"}</span></button><div className="account-popover"><button type="button" onClick={() => navigate("/profile")}><UserCircle size={16} />پروفایل</button><button type="button" onClick={() => navigate("/sessions")}><ShieldCheck size={16} />نشست ها</button><button type="button" onClick={() => void logout().then(() => navigate("/login", { replace: true }))}><LogOut size={16} />خروج</button></div></div>
        </div>
      </header>
      <main id="main-content"><Outlet /></main>
    </div>
    <nav className="mobile-bottom-nav" aria-label="ناوبری اصلی موبایل">
      <NavLink to="/" end className={({ isActive }) => `mobile-nav-item ${isActive ? "active" : ""}`}><Gauge size={20} /><span>داشبورد</span></NavLink>
      <NavLink to="/calendar" className={({ isActive }) => `mobile-nav-item ${isActive ? "active" : ""}`}><CalendarDays size={20} /><span>تقویم</span></NavLink>
      <button type="button" className="mobile-nav-fab" onClick={() => openContentDialog({ quick: true })} aria-label="محتوای جدید"><Plus size={22} /></button>
      <NavLink to="/workflow" className={({ isActive }) => `mobile-nav-item ${isActive ? "active" : ""}`}><Workflow size={20} /><span>گردش کار</span></NavLink>
      <button type="button" className={`mobile-nav-item ${moreOpen ? "active" : ""}`} onClick={() => setMoreOpen((value) => !value)} aria-label="بیشتر"><MoreHorizontal size={20} /><span>بیشتر</span></button>
    </nav>
    {moreOpen && <button type="button" className="mobile-sheet-backdrop" aria-label="بستن" onClick={() => setMoreOpen(false)} />}
    <div className={`mobile-more-sheet ${moreOpen ? "open" : ""}`} role="dialog" aria-label="بیشتر" aria-hidden={!moreOpen}>
      <div className="mobile-sheet-handle" />
      <nav>{visibleNavigation.filter(({ to }) => !MOBILE_PRIMARY_ROUTES.includes(to)).map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`} onClick={() => setMoreOpen(false)}><Icon size={19} /><span>{label}</span></NavLink>)}</nav>
    </div>
    <div className="toast-region" aria-live="polite">{toasts.map((toast) => <div className="toast" key={toast.id}><span>{toast.title}</span>{toast.action && <button type="button" onClick={toast.action.onClick}>{toast.action.label}</button>}<IconButton label="بستن پیام" onClick={() => dismissToast(toast.id)}><X size={16} /></IconButton></div>)}</div>
    <Suspense fallback={null}><ChatLauncher /></Suspense>
    <ContentEditor />
  </div>;
}

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: string; actions?: ReactNode }) {
  return <header className="page-header"><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</header>;
}

export function BackButton({ onClick }: { onClick: () => void }) { return <IconButton label="بازگشت" onClick={onClick}><ChevronLeft size={18} /></IconButton>; }

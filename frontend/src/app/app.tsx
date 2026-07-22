import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense, useEffect } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "../components/app-shell";
import { ForcePasswordChangePage, LoginPage, ProfilePage, SessionsPage } from "../features/auth/auth-pages";
import { ContentListPage } from "../features/content/content-list-page";
import { DashboardPage } from "../features/dashboard/dashboard-page";
import { CalendarPage } from "../features/calendar/calendar-page";
import { JalaliCalendarPage } from "../features/calendar/jalali-calendar-page";
import { CampaignsPage, IdeasPage, TemplatesPage } from "../features/planning/planning-pages";
import { GanttPage } from "../features/gantt/gantt-page";
import { ReportsPage } from "../features/reports/reports-page";
import { ActivityPage } from "../features/activity/activity-page";
import { AdvertisingPage } from "../features/advertising/advertising-page";
import { EducationPage } from "../features/education/education-page";
import { PersonalNotesPage } from "../features/notes/personal-notes-page";
import { TasksPage } from "../features/tasks/tasks-page";
import { SettingsPage } from "../features/settings/settings-page";
import { WorkflowPage } from "../features/workflow/workflow-page";
import { useUIStore } from "../stores/ui-store";
import { AuthProvider } from "../hooks/use-auth";
import { useAuth } from "../hooks/use-auth-context";
import { ErrorBoundary } from "./error-boundary";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

const PdfReaderPage = lazy(() => import("../features/education/pdf-reader-page").then((module) => ({ default: module.PdfReaderPage })));

function ShortcutHandler() {
  const { openContentDialog, closeContentDialog, pushToast } = useUIStore();
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const command = event.ctrlKey || event.metaKey;
      if (command && event.key.toLowerCase() === "n") { event.preventDefault(); openContentDialog({ quick: true }); }
      if (command && event.key.toLowerCase() === "k") { event.preventDefault(); document.querySelector<HTMLInputElement>(".global-search input")?.focus(); }
      if (command && event.key.toLowerCase() === "s") {
        const editor = document.querySelector<HTMLFormElement>(".editor-form");
        if (editor) { event.preventDefault(); editor.requestSubmit(); }
        else { event.preventDefault(); pushToast({ title: "تغییری برای ذخیره در این صفحه وجود ندارد." }); }
      }
      if (event.key === "Escape") { closeContentDialog(); const active = document.activeElement as HTMLElement | null; active?.blur(); }
    };
    window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler);
  }, [closeContentDialog, openContentDialog, pushToast]);
  return null;
}

function ProtectedApp() {
  const { user, loading } = useAuth();
  if (loading) return <div className="page"><div className="skeleton heading-skeleton" /><div className="skeleton panel-skeleton" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword) return <Navigate to="/force-password-change" replace />;
  return <AppShell />;
}

export function App() {
  return <ErrorBoundary><QueryClientProvider client={queryClient}><AuthProvider><HashRouter><ShortcutHandler /><Routes>
    <Route path="login" element={<LoginPage />} />
    <Route path="force-password-change" element={<ForcePasswordChangePage />} />
    <Route element={<ProtectedApp />}>
      <Route index element={<DashboardPage />} />
      <Route path="calendar" element={<CalendarPage />} />
      <Route path="gantt" element={<GanttPage />} />
      <Route path="jalali-calendar" element={<JalaliCalendarPage />} />
      <Route path="contents" element={<ContentListPage />} />
      <Route path="workflow" element={<WorkflowPage />} />
      <Route path="advertising" element={<AdvertisingPage />} />
      <Route path="campaigns" element={<CampaignsPage />} />
      <Route path="ideas" element={<IdeasPage />} />
      <Route path="templates" element={<TemplatesPage />} />
      <Route path="reports" element={<ReportsPage />} />
      <Route path="activity" element={<ActivityPage />} />
      <Route path="education" element={<EducationPage />} />
      <Route path="education/:materialId" element={<Suspense fallback={<div className="page"><div className="skeleton heading-skeleton" /><div className="skeleton panel-skeleton" /></div>}><PdfReaderPage /></Suspense>} />
      <Route path="notes" element={<PersonalNotesPage />} />
      <Route path="tasks" element={<TasksPage />} />
      <Route path="settings" element={<SettingsPage />} />
      <Route path="profile" element={<ProfilePage />} />
      <Route path="sessions" element={<SessionsPage />} />
    </Route>
  </Routes></HashRouter></AuthProvider></QueryClientProvider></ErrorBoundary>;
}

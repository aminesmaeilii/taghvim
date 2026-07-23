import { Activity, AlertTriangle, CheckCircle2, Clock, Database, Info, RadioTower, RefreshCw, Server, ShieldAlert, Wifi, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../../components/app-shell";
import { Button, EmptyState } from "../../components/ui";
import { contentRepository } from "../../services/content-repository";
import { useAuth } from "../../hooks/use-auth-context";
import { TECHNICAL_DATA_UNAVAILABLE, type TechnicalServiceStatus } from "@shared/services/observability";
import { toPersianDigits } from "@shared/utils/jalali";

const healthKey = ["technical-health"] as const;

const statusLabels: Record<TechnicalServiceStatus, string> = {
  HEALTHY: "سالم",
  WARNING: "دارای هشدار",
  DEGRADED: "دچار اختلال",
  DOWN: "قطع",
  UNKNOWN: "نامشخص",
  CHECKING: "در حال بررسی",
};

const statusIcons: Record<TechnicalServiceStatus, typeof CheckCircle2> = {
  HEALTHY: CheckCircle2,
  WARNING: AlertTriangle,
  DEGRADED: ShieldAlert,
  DOWN: XCircle,
  UNKNOWN: Info,
  CHECKING: RefreshCw,
};

const serviceIcons: Record<string, typeof Activity> = {
  frontend: Activity,
  backend: Server,
  database: Database,
  backup: Database,
  realtime: Wifi,
  worker: Clock,
  scheduler: Clock,
  web_push: RadioTower,
  social_monitoring: RadioTower,
};

export function TechnicalHealthPage() {
  const { user, hasPermission } = useAuth();
  const health = useQuery({
    queryKey: healthKey,
    queryFn: () => contentRepository.technicalHealth(user ?? undefined),
    enabled: Boolean(user?.permissions.includes("technical_health.read")),
    refetchInterval: 30_000,
  });

  if (!hasPermission("technical_health.read")) return <div className="page"><EmptyState title="دسترسی ندارید" description="برای مشاهده سلامت سامانه باید مجوز technical_health.read داشته باشید." /></div>;
  if (health.isLoading) return <div className="page technical-health-page"><div className="skeleton heading-skeleton" /><div className="skeleton panel-skeleton" /></div>;
  if (!health.data) return <div className="page"><EmptyState title="سلامت سامانه در دسترس نیست" description={TECHNICAL_DATA_UNAVAILABLE} action={<Button onClick={() => void health.refetch()}><RefreshCw size={16} />تلاش دوباره</Button>} /></div>;

  const overallIcon = statusIcons[health.data.overallStatus];
  const OverallIcon = overallIcon;
  return <div className="page technical-health-page">
    <PageHeader title="سلامت سامانه" description="نمای فنی از وضعیت اجرا، خطاها، کارهای پس زمینه و اتصال های حیاتی." actions={<Button variant="secondary" onClick={() => void health.refetch()}><RefreshCw size={16} />به روزرسانی</Button>} />
    <section className={`surface technical-hero ${health.data.overallStatus.toLowerCase()}`}>
      <OverallIcon size={28} />
      <div><span>وضعیت کلی سامانه</span><h2>{statusLabels[health.data.overallStatus]}</h2><p>{health.data.environment} · نسخه {health.data.applicationVersion} · {health.data.commitSha ?? "commit نامشخص"}</p></div>
      <time>{new Date(health.data.generatedAt).toLocaleString("fa-IR")}</time>
    </section>
    <section className="technical-service-grid">{health.data.services.map((service) => {
      const ServiceIcon = serviceIcons[service.key] ?? Activity;
      const StatusIcon = statusIcons[service.status];
      return <article className={`surface technical-service-card ${service.status.toLowerCase()}`} key={service.key}>
        <header><ServiceIcon size={20} /><div><h2>{service.labelFa}</h2><small>{new Date(service.lastCheckedAt).toLocaleString("fa-IR")}</small></div><span><StatusIcon size={15} />{statusLabels[service.status]}</span></header>
        <p>{service.summary || TECHNICAL_DATA_UNAVAILABLE}</p>
        <div className="technical-metrics">{service.metrics.length ? service.metrics.map((metric) => <div key={`${service.key}-${metric.name}`}><strong>{toPersianDigits(metric.value)}</strong><span>{metric.name}</span></div>) : <small>{TECHNICAL_DATA_UNAVAILABLE}</small>}</div>
      </article>;
    })}</section>
    <section className="technical-two-col">
      <section className="surface technical-panel"><header><AlertTriangle size={19} /><h2>هشدارهای فعال</h2></header>{health.data.alerts.length ? health.data.alerts.map((alert) => <div className="technical-row" key={alert.id}><strong>{alert.title}</strong><span>{alert.service}</span><small>{new Date(alert.createdAt).toLocaleString("fa-IR")}</small></div>) : <p>{TECHNICAL_DATA_UNAVAILABLE}</p>}</section>
      <section className="surface technical-panel"><header><ShieldAlert size={19} /><h2>خطاهای اخیر</h2></header>{health.data.recentErrors.length ? health.data.recentErrors.map((error) => <div className="technical-row" key={`${error.event}-${error.jobId ?? error.requestId}`}><strong>{error.errorCode ?? error.event}</strong><span>{error.service}</span><small>{error.requestId ?? error.jobId ?? "بدون کد پیگیری"}</small></div>) : <p>خطای فنی اخیر ثبت نشده است.</p>}</section>
    </section>
  </div>;
}

export default TechnicalHealthPage;

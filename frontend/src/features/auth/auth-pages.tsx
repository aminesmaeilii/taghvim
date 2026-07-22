import { Eye, EyeOff, Lock, LogIn, ShieldCheck, Upload, UserCircle } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Navigate, useNavigate } from "react-router-dom";
import { Button, EmptyState, Field, Input } from "../../components/ui";
import { useAuth } from "../../hooks/use-auth-context";
import { useCurrentProfile } from "../../hooks/use-profile";
import { workspaceKey } from "../../hooks/use-workspace";
import { authService } from "../../services/auth-service";
import { contentRepository } from "../../services/content-repository";
import { uploadFile } from "../../services/blob-storage";
import { marketingRoleLabel } from "../../services/profile-service";
import { MARKETING_ROLE_LABELS } from "@shared/constants/defaults";
import { MARKETING_ROLES, type MarketingRole, type WorkspaceData } from "@shared/types/domain";
import type { AuthSession } from "@shared/types/auth";
import { formatJalaliDate } from "@shared/utils/jalali";

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const [identifier, setIdentifier] = useState("admin");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  if (!loading && user) return <Navigate to={user.mustChangePassword ? "/force-password-change" : "/"} replace />;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setError("");
    setPending(true);
    try { await login(identifier, password, remember); }
    catch (err) { setError(err instanceof Error ? err.message : "نام کاربری یا رمز عبور صحیح نیست."); }
    finally { setPending(false); }
  };
  return <main className="auth-page"><section className="auth-panel"><div className="auth-brand"><ShieldCheck size={28} /><div><h1>ورود به زمبیل</h1><p>برای دسترسی به داشبورد وارد شوید.</p></div></div><form onSubmit={submit} className="auth-form"><Field label="نام کاربری یا ایمیل"><Input autoFocus value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" /></Field><Field label="رمز عبور"><div className="password-field"><Input type={show ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /><button type="button" aria-label={show ? "مخفی کردن رمز" : "نمایش رمز"} onClick={() => setShow((value) => !value)}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></Field><label className="remember-row"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> مرا به خاطر بسپار</label>{error && <p className="auth-error">{error}</p>}<Button type="submit" disabled={pending || identifier.trim().length < 2 || password.length < 1}><LogIn size={17} />{pending ? "در حال ورود" : "ورود"}</Button><button className="link-button" type="button">رمز عبور را فراموش کرده ام</button></form></section></main>;
}

export function ForcePasswordChangePage() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState("");
  if (!user) return <Navigate to="/login" replace />;
  if (!user.mustChangePassword) return <Navigate to="/" replace />;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (next !== repeat) { setError("تکرار رمز عبور با رمز جدید یکی نیست."); return; }
    try { await authService.changePassword(current, next); await refresh(); navigate("/", { replace: true }); }
    catch (err) { setError(err instanceof Error ? err.message : "تغییر رمز ممکن نشد."); }
  };
  return <main className="auth-page"><section className="auth-panel"><div className="auth-brand"><Lock size={28} /><div><h1>تغییر رمز اولیه</h1><p>قبل از ورود به داشبورد باید رمز اولیه را تغییر دهید.</p></div></div><form onSubmit={submit} className="auth-form"><Field label="رمز فعلی"><Input type="password" value={current} onChange={(event) => setCurrent(event.target.value)} autoComplete="current-password" /></Field><Field label="رمز جدید"><Input type="password" value={next} onChange={(event) => setNext(event.target.value)} autoComplete="new-password" /></Field><Field label="تکرار رمز جدید"><Input type="password" value={repeat} onChange={(event) => setRepeat(event.target.value)} autoComplete="new-password" /></Field><PasswordStrength password={next} />{error && <p className="auth-error">{error}</p>}<Button type="submit">ثبت رمز جدید</Button></form></section></main>;
}

export function ProfilePage() {
  const { user, refresh } = useAuth();
  const { profile, online } = useCurrentProfile();
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [message, setMessage] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);
  useEffect(() => { setFirstName(user?.firstName ?? ""); setLastName(user?.lastName ?? ""); setPhone(user?.phone ?? ""); }, [user]);
  if (!user) return <Navigate to="/login" replace />;
  const save = async () => { await authService.updateOwnProfile({ firstName, lastName, phone }); await refresh(); setMessage("پروفایل ذخیره شد."); };
  const patchProfile = (next: typeof profile) => { if (!next) return; queryClient.setQueryData<WorkspaceData>(workspaceKey, (current) => current ? { ...current, userProfiles: [...current.userProfiles.filter((item) => item.userId !== next.userId), next] } : current); };
  const uploadAvatar = async (file?: File) => {
    if (!file || !profile) return;
    setAvatarUploading(true);
    try { const avatarUrl = await uploadFile(file, `avatars/${user.id}-${file.name}`); patchProfile(await contentRepository.saveProfile({ ...profile, avatarUrl })); }
    catch { setMessage("آپلود عکس پروفایل ممکن نشد."); }
    finally { setAvatarUploading(false); }
  };
  const toggleDashboardRole = (role: MarketingRole) => {
    if (!profile) return;
    const dashboardRoles = profile.dashboardRoles.includes(role) ? profile.dashboardRoles.filter((item) => item !== role) : [...profile.dashboardRoles, role];
    void contentRepository.saveProfile({ ...profile, dashboardRoles }).then(patchProfile);
  };
  return <div className="page"><header className="page-header"><div><h1>پروفایل کاربری</h1><p>اطلاعات شخصی و مجاز حساب خود را مدیریت کنید.</p></div></header>
    <section className="surface profile-panel">
      <div className="profile-card">
        <button type="button" className="profile-avatar" onClick={() => avatarInput.current?.click()} disabled={avatarUploading} aria-label="تغییر عکس پروفایل">{profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : <UserCircle size={54} />}<span className={`profile-status-dot ${online ? "online" : "offline"}`} /><span className="profile-avatar-edit"><Upload size={13} /></span></button>
        <input ref={avatarInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => void uploadAvatar(event.target.files?.[0])} />
        <div><h2>{user.firstName} {user.lastName}</h2><p>{user.username} · {user.email}</p><span>{marketingRoleLabel(profile?.jobRole)}</span><small className="profile-joined">عضویت از {formatJalaliDate(user.createdAt)} · {online ? "آنلاین" : "آفلاین"}</small></div>
      </div>
      <div className="settings-form"><Field label="نام"><Input value={firstName} onChange={(event) => setFirstName(event.target.value)} /></Field><Field label="نام خانوادگی"><Input value={lastName} onChange={(event) => setLastName(event.target.value)} /></Field><Field label="شماره تماس" optional><Input value={phone} onChange={(event) => setPhone(event.target.value)} /></Field></div>
      <footer className="dialog-footer"><Button onClick={() => void save()}>ذخیره پروفایل</Button>{message && <span className="inline-success">{message}</span>}</footer>
    </section>
    <section className="surface profile-panel"><h2>داشبورد من</h2><p className="form-hint">تعیین کنید شاخص های کدام نقش های دیجیتال مارکتینگ در داشبورد شما نمایش داده شود.</p><div className="permission-grid">{MARKETING_ROLES.map((role) => <label key={role}><input type="checkbox" checked={profile?.dashboardRoles.includes(role) ?? false} onChange={() => toggleDashboardRole(role)} />{MARKETING_ROLE_LABELS[role]}</label>)}</div></section>
    <PasswordBox />
  </div>;
}

function PasswordBox() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [message, setMessage] = useState("");
  const change = async () => {
    setMessage("");
    if (next !== repeat) { setMessage("تکرار رمز صحیح نیست."); return; }
    try { await authService.changePassword(current, next); setCurrent(""); setNext(""); setRepeat(""); setMessage("رمز عبور تغییر کرد و نشست های دیگر باطل شدند."); }
    catch (err) { setMessage(err instanceof Error ? err.message : "تغییر رمز ممکن نشد."); }
  };
  return <section className="surface profile-panel"><h2>امنیت و رمز عبور</h2><div className="settings-form"><Field label="رمز فعلی"><Input type="password" value={current} onChange={(event) => setCurrent(event.target.value)} /></Field><Field label="رمز جدید"><Input type="password" value={next} onChange={(event) => setNext(event.target.value)} /></Field><Field label="تکرار رمز جدید"><Input type="password" value={repeat} onChange={(event) => setRepeat(event.target.value)} /></Field></div><PasswordStrength password={next} /><footer className="dialog-footer"><Button onClick={() => void change()}>تغییر رمز</Button>{message && <span className="form-warning">{message}</span>}</footer></section>;
}

export function SessionsPage() {
  const [sessions, setSessions] = useState<AuthSession[]>([]);
  const load = () => void authService.sessions().then(setSessions);
  useEffect(load, []);
  return <div className="page"><header className="page-header"><div><h1>دستگاه ها و نشست ها</h1><p>نشست های فعال حساب خود را ببینید و در صورت نیاز باطل کنید.</p></div></header><section className="surface report-list">{sessions.length ? sessions.map((session) => <div key={session.id}><span>{new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeStyle: "short" }).format(new Date(session.createdAt))}</span><strong>{session.userAgent || "دستگاه ناشناس"}</strong>{session.current ? <small>نشست فعلی</small> : <Button size="sm" variant="secondary" onClick={() => void authService.revokeSession(session.id).then(load)}>ابطال</Button>}</div>) : <EmptyState title="نشستی پیدا نشد" description="در حال حاضر نشست فعالی برای نمایش وجود ندارد." />}</section></div>;
}

function PasswordStrength({ password }: { password: string }) {
  const score = [password.length >= 12, /[A-Z]/.test(password), /[a-z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;
  return <div className="password-strength"><div><span style={{ width: `${score * 20}%` }} /></div><small>قدرت رمز: {["خیلی ضعیف", "ضعیف", "متوسط", "خوب", "قوی", "خیلی قوی"][score]}</small></div>;
}

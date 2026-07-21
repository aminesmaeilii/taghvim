import { useEffect, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md"; children: ReactNode };

export function Button({ variant = "primary", size = "md", className = "", children, ...props }: ButtonProps) {
  return <button className={`button button-${variant} button-${size} ${className}`} {...props}>{children}</button>;
}

export function IconButton({ label, className = "", children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return <button className={`icon-button ${className}`} type="button" aria-label={label} title={label} {...props}>{children}</button>;
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) { return <input className={`input ${className}`} {...props} />; }
export function Select({ className = "", children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) { return <select className={`select ${className}`} {...props}>{children}</select>; }
export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea className={`textarea ${className}`} {...props} />; }

export function Field({ label, error, optional, children }: { label: string; error?: string; optional?: boolean; children: ReactNode }) {
  return <label className="field"><span className="field-label">{label}{optional && <small>اختیاری</small>}</span>{children}{error && <span className="field-error"><AlertCircle size={14} />{error}</span>}</label>;
}

export function StatusBadge({ status, label, color }: { status: string; label: string; color: string }) {
  return <span className="status-badge" data-status={status}><span style={{ backgroundColor: color }} />{label}</span>;
}

export function DotBadge({ label, color }: { label: string; color: string }) { return <span className="dot-badge"><span style={{ backgroundColor: color }} />{label}</span>; }

export function Dialog({ open, title, description, onClose, children, wide = false }: { open: boolean; title: string; description?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, open]);
  if (!open) return null;
  return <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
    <section className={`dialog ${wide ? "dialog-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby={titleId} onMouseDown={(event) => event.stopPropagation()}>
      <header className="dialog-header"><div><h2 id={titleId}>{title}</h2>{description && <p>{description}</p>}</div><IconButton label="بستن" onClick={onClose}><X size={19} /></IconButton></header>
      {children}
    </section>
  </div>;
}

export function Drawer({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, open]);
  if (!open) return null;
  return <div className="drawer-backdrop" role="presentation" onMouseDown={onClose}>
    <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby={titleId} onMouseDown={(event) => event.stopPropagation()}>
      <header className="drawer-header"><h2 id={titleId}>{title}</h2><IconButton label="بستن" onClick={onClose}><X size={19} /></IconButton></header>{children}
    </aside>
  </div>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><Info size={24} /><h3>{title}</h3><p>{description}</p>{action}</div>;
}

export function InlineSuccess({ children }: { children: ReactNode }) { return <span className="inline-success"><CheckCircle2 size={15} />{children}</span>; }

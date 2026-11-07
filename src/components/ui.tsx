/** Primitivas compartilhadas — só papéis dos tokens, nunca hex solto. */

import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  useEffect,
  useId,
  useRef,
} from "react";
import { ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import { MONTH_NAMES, WEEKDAY_SHORT } from "@/domain/dates";

// ── Botão ────────────────────────────────────────────────────────────────

export function Btn({
  variant = "primary",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }) {
  const base = variant === "primary" ? "btn btn-primary" : variant === "secondary" ? "btn btn-secondary" : "btn btn-ghost";
  return <button type="button" className={`${base} ${className}`} {...rest} />;
}

// ── Campo ────────────────────────────────────────────────────────────────

export function Field({
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`field ${className}`} {...rest} />;
}

// ── TopBar ───────────────────────────────────────────────────────────────

export function TopBar({
  variant,
  title,
  onMenu,
  onBack,
  actions,
  subtitle,
}: {
  variant: "chat" | "module" | "sub";
  title: ReactNode;
  subtitle?: string;
  onMenu?: () => void;
  onBack?: () => void;
  actions?: ReactNode;
}) {
  return (
    <header
      className="sticky top-0 z-20 bg-bg/90 backdrop-blur border-b border-line"
      style={{ height: 56 }}
    >
      <div className="mx-auto flex h-full max-w-[640px] items-center gap-1 px-3">
        {variant === "sub" && onBack ? (
          <button
            aria-label="Voltar"
            className="flex h-10 w-10 items-center justify-center rounded-full text-muted hover:text-ink"
            onClick={onBack}
          >
            <ChevronLeft size={20} />
          </button>
        ) : (
          variant !== "sub" && (
            <button
              aria-label="Abrir menu"
              className="flex h-10 w-10 items-center justify-center rounded-full text-muted hover:text-ink"
              onClick={onMenu}
            >
              <MenuIcon />
            </button>
          )
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg">{title}</h1>
          {subtitle ? <p className="truncate text-xs text-muted">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
    </header>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M3 5.5h14M3 10h14M3 14.5h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// ── Drawer ───────────────────────────────────────────────────────────────

export function Drawer({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40">
      <div
        className="absolute inset-0 bg-black/60 fade-in"
        onClick={onClose}
        aria-hidden
      />
      <nav
        className="absolute inset-y-0 left-0 flex w-[76%] max-w-[320px] flex-col border-r border-line bg-surface shadow-pop rise"
        aria-label="Navegação principal"
      >
        {children}
      </nav>
    </div>
  );
}

export function DrawerItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon?: ReactNode;
  label: ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm ${
        active ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface-2 hover:text-ink"
      }`}
      onClick={onClick}
    >
      {icon ? <span className="text-muted">{icon}</span> : null}
      <span>{label}</span>
    </button>
  );
}

export function DrawerCaption({ children }: { children: ReactNode }) {
  return (
    <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wider text-muted">
      {children}
    </p>
  );
}

// ── BottomSheet ──────────────────────────────────────────────────────────

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) {
      window.addEventListener("keydown", onKey);
      ref.current?.querySelector<HTMLElement>("input, select, textarea, button")?.focus();
    }
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/60 fade-in" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        className="absolute inset-x-0 bottom-0 mx-auto max-w-[640px] rounded-t-[18px] border border-line border-b-0 bg-surface p-4 pb-safe shadow-pop rise"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg">{title}</h2>
          <button
            aria-label="Fechar"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:text-ink"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── StatCard ─────────────────────────────────────────────────────────────

const STAT_TONES = {
  accent: "bg-surface-2",
  danger: "bg-surface-2",
  success: "bg-surface-2",
  neutral: "bg-surface-2",
} as const;

export function StatCard({
  label,
  value,
  icon,
  tone = "neutral",
  onClick,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  tone?: keyof typeof STAT_TONES;
  onClick?: () => void;
}) {
  const toneText =
    tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : tone === "accent" ? "text-accent" : "text-ink";
  return (
    <button
      className={`card flex flex-1 flex-col items-center gap-1 p-3 ${STAT_TONES[tone]} ${onClick ? "hover:brightness-110" : ""}`}
      onClick={onClick}
    >
      {icon ? <span className={toneText}>{icon}</span> : null}
      <span className={`num text-xl ${toneText}`}>{value}</span>
      <span className="text-xs text-muted">{label}</span>
    </button>
  );
}

// ── MonthPager ───────────────────────────────────────────────────────────

export function MonthPager({
  month,
  onChange,
}: {
  month: string;
  onChange: (m: string) => void;
}) {
  const shift = (n: number) => {
    const d = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + n, 1);
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const label = `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]!} ${month.slice(0, 4)}`;
  return (
    <div className="flex items-center justify-center gap-2 py-2">
      <button
        aria-label="Mês anterior"
        className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:text-ink"
        onClick={() => shift(-1)}
      >
        <ChevronLeft size={18} />
      </button>
      <span className="min-w-[110px] text-center text-sm font-semibold">{label}</span>
      <button
        aria-label="Mês seguinte"
        className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:text-ink"
        onClick={() => shift(1)}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

// ── WeekdayChips ─────────────────────────────────────────────────────────

export function WeekdayChips({
  selected,
  onToggle,
}: {
  selected: number[];
  onToggle: (day: number) => void;
}) {
  return (
    <div className="flex gap-1.5" role="group" aria-label="Dias da semana">
      {WEEKDAY_SHORT.map((d, i) => (
        <button
          key={i}
          type="button"
          aria-pressed={selected.includes(i)}
          className={`flex h-9 w-9 rounded-full border text-xs transition-colors ${
            selected.includes(i)
              ? "border-transparent bg-accent text-on-accent"
              : "border-line bg-surface-2 text-muted hover:text-ink"
          }`}
          onClick={() => onToggle(i)}
        >
          {d}
        </button>
      ))}
    </div>
  );
}

// ── Spinner / EmptyState ─────────────────────────────────────────────────

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 p-6 text-muted" role="status">
      <Loader2 className="animate-spin" size={18} />
      {label ? <span className="text-sm">{label}</span> : null}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-muted">
        {icon}
      </div>
      <p className="text-base font-semibold">{title}</p>
      {hint ? <p className="text-sm text-muted">{hint}</p> : null}
      {action}
    </div>
  );
}

// ── Chips de filtro ──────────────────────────────────────────────────────

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  const id = useId();
  return (
    <div className="no-scrollbar flex gap-1.5 overflow-x-auto" id={id}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          className={`chip ${value === o.value ? "chip-selected" : ""}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

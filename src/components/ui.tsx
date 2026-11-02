import React from 'react';
import { X } from 'lucide-react';
import { Trip, TruckUnit } from '../types';
import { STAGE_META, TRUCK_STATUS_META } from '../data/seed';

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

export const inputCls =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-[#231F20] focus:border-[#B71E23] focus:outline-none focus:ring-2 focus:ring-[#B71E23]/15 disabled:bg-zinc-100';

export function Card({
  className,
  children,
  dark,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { dark?: boolean }) {
  return (
    <div
      className={cx(
        'rounded-2xl border shadow-sm',
        dark ? 'border-zinc-800 bg-[#181D26] text-white' : 'border-zinc-200 bg-white',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function SectionHeader({
  title,
  subtitle,
  icon,
  actions,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="flex items-center gap-2 text-base font-extrabold text-[#231F20]">
          {icon}
          <span>{title}</span>
        </h3>
        {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'dark';

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg' }) {
  const v: Record<BtnVariant, string> = {
    primary: 'bg-[#B71E23] text-white hover:bg-[#96171B] shadow-sm',
    secondary: 'border border-zinc-300 bg-white text-[#231F20] hover:border-[#B71E23] hover:text-[#B71E23]',
    ghost: 'text-zinc-600 hover:bg-zinc-100',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
    dark: 'bg-[#231F20] text-white hover:bg-black',
  };
  const s = { sm: 'px-2.5 py-1.5 text-[11px]', md: 'px-3.5 py-2 text-xs', lg: 'px-5 py-3 text-sm' }[size];
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-xl font-bold transition disabled:cursor-not-allowed disabled:opacity-50',
        v[variant],
        s,
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-[11px] font-bold text-zinc-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-zinc-500">{hint}</span>}
    </label>
  );
}

export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  eyebrow?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[1200] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={cx(
          'w-full max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-zinc-200 bg-white shadow-2xl',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'
        )}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-zinc-200 bg-white px-5 py-4">
          <div>
            {eyebrow && (
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#B71E23]">{eyebrow}</div>
            )}
            <h4 className="text-base font-extrabold text-[#231F20]">{title}</h4>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-zinc-200 bg-white px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function StageBadge({ stage, className }: { stage: Trip['stage']; className?: string }) {
  const color: Record<Trip['stage'], string> = {
    pending_assignment: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    assigned: 'bg-blue-50 text-blue-700 border-blue-200',
    in_transit: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    customs: 'bg-violet-50 text-violet-700 border-violet-200',
    nearing_destination: 'bg-orange-50 text-orange-700 border-orange-200',
    unloading: 'bg-amber-50 text-amber-800 border-amber-200',
    delivered: 'bg-zinc-800 text-white border-zinc-800',
  };
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold whitespace-nowrap',
        color[stage],
        className
      )}
    >
      {STAGE_META[stage].short}
    </span>
  );
}

export function TruckStatusBadge({ status }: { status: TruckUnit['status'] }) {
  const m = TRUCK_STATUS_META[status];
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold', m.soft, m.text)}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />
      {m.label}
    </span>
  );
}

export function ProgressBar({ pct, className }: { pct: number; className?: string }) {
  return (
    <div className={cx('h-2 w-full overflow-hidden rounded-full bg-zinc-100', className)}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-[#B71E23] to-[#F2851D] transition-all duration-700"
        style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

export function KpiCard({
  label,
  value,
  sub,
  icon,
  accent = 'text-[#B71E23]',
  onClick,
  dark,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: string;
  onClick?: () => void;
  dark?: boolean;
}) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cx(
        'w-full rounded-2xl border p-4 text-left shadow-sm transition',
        dark ? 'border-zinc-800 bg-[#181D26] text-white' : 'border-zinc-200 bg-white',
        onClick && 'hover:border-[#B71E23]'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cx('text-[11px] font-bold uppercase tracking-[0.12em]', dark ? 'text-zinc-400' : 'text-zinc-500')}>
          {label}
        </span>
        {icon && <span className={accent}>{icon}</span>}
      </div>
      <div className="mt-2 text-2xl font-extrabold tracking-tight">{value}</div>
      {sub && <div className={cx('mt-1 text-xs', dark ? 'text-zinc-400' : 'text-zinc-500')}>{sub}</div>}
    </Comp>
  );
}

export function Tabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { id: T; label: string; icon?: React.ReactNode; badge?: number }[];
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {items.map((it) => {
        const active = it.id === value;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onChange(it.id)}
            className={cx(
              'flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold transition',
              active ? 'bg-[#B71E23] text-white shadow-sm' : 'border border-zinc-200 bg-white text-zinc-600 hover:text-[#231F20]'
            )}
          >
            {it.icon}
            <span>{it.label}</span>
            {it.badge ? (
              <span
                className={cx(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-extrabold',
                  active ? 'bg-[#FFF000] text-[#231F20]' : 'bg-[#B71E23] text-white'
                )}
              >
                {it.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function EmptyState({ icon, title, text }: { icon?: React.ReactNode; title: string; text?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-center">
      {icon && <div className="mx-auto mb-2 flex justify-center text-zinc-400">{icon}</div>}
      <div className="text-sm font-bold text-[#231F20]">{title}</div>
      {text && <p className="mt-1 text-xs text-zinc-500">{text}</p>}
    </div>
  );
}

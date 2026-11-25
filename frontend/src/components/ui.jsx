import { useEffect, useId } from 'react'
import { Flame, Snowflake, Thermometer, X, CircleCheck, Undo2, Info } from 'lucide-react'
import { useApp } from '../store'

export const cx = (...a) => a.filter(Boolean).join(' ')

/* ---------- Banderas en SVG (los emoji de bandera no se ven en Windows) ---------- */
export function Flag({ code, className = 'h-3 w-[18px]' }) {
  if (!code || code === 'ALL') return null
  return (
    <span className={cx('inline-block shrink-0 overflow-hidden rounded-[3px] ring-1 ring-black/10 align-[-1px]', className)}>
      <svg viewBox="0 0 30 20" className="block h-full w-full" aria-hidden="true">
        {code === 'PE' && (<><rect width="30" height="20" fill="#fff" /><rect width="10" height="20" fill="#D91023" /><rect x="20" width="10" height="20" fill="#D91023" /></>)}
        {code === 'BO' && (<><rect width="30" height="7" fill="#D52B1E" /><rect y="6.67" width="30" height="6.67" fill="#F9E300" /><rect y="13.33" width="30" height="6.67" fill="#007934" /></>)}
        {code === 'VE' && (
          <>
            <rect width="30" height="7" fill="#FFCC00" /><rect y="6.67" width="30" height="6.67" fill="#00247D" /><rect y="13.33" width="30" height="6.67" fill="#CF142B" />
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
              const a = Math.PI * (0.15 + (0.7 * i) / 7)
              return <circle key={i} cx={15 - 5.2 * Math.cos(a)} cy={13.6 - 4.6 * Math.sin(a)} r="0.75" fill="#fff" />
            })}
          </>
        )}
      </svg>
    </span>
  )
}

/* ---------- Logo ---------- */
export function Logo({ size = 34 }) {
  const gid = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4F46E5" />
          <stop offset="1" stopColor="#1E3A8A" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill={`url(#${gid})`} />
      <path d="M10 13l8.5 15L27 13" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24.5 11.5h5.5v5.5" fill="none" stroke="#34D399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ---------- Temperatura ---------- */
export const TEMPS = {
  caliente: { label: 'Caliente', icon: Flame, cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
  tibio: { label: 'Tibio', icon: Thermometer, cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  frio: { label: 'Frío', icon: Snowflake, cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
}
export function TempBadge({ temp, className }) {
  const t = TEMPS[temp] || TEMPS.tibio
  const I = t.icon
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', t.cls, className)}>
      <I size={12} strokeWidth={2.5} /> {t.label}
    </span>
  )
}

/* ---------- Avatar ---------- */
const AV = ['bg-indigo-100 text-indigo-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-800', 'bg-rose-100 text-rose-700', 'bg-sky-100 text-sky-700', 'bg-violet-100 text-violet-700']
export function Avatar({ name = '?', size = 'md' }) {
  const ini = name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  const h = [...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % AV.length
  const s = { xs: 'h-5 w-5 text-[9px]', sm: 'h-7 w-7 text-[11px]', md: 'h-9 w-9 text-xs', lg: 'h-14 w-14 text-lg' }[size]
  return <span className={cx('grid shrink-0 place-items-center rounded-full font-semibold', AV[h], s)}>{ini}</span>
}

/* ---------- Botones ---------- */
export function Button({ variant = 'secondary', size = 'md', className, children, ...p }) {
  const v = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-600/20',
    secondary: 'bg-white text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50',
    ghost: 'text-slate-600 hover:bg-slate-100',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-600/20',
    wa: 'bg-[#25D366]/10 text-[#128C4A] ring-1 ring-inset ring-[#25D366]/30 hover:bg-[#25D366]/20',
  }[variant]
  const s = { sm: 'h-8 px-2.5 text-xs gap-1.5', md: 'h-10 px-3.5 text-sm gap-2', icon: 'h-9 w-9 justify-center' }[size]
  return (
    <button
      type="button"
      className={cx('inline-flex shrink-0 items-center rounded-lg font-medium transition active:scale-[.98] disabled:opacity-50', v, s, className)}
      {...p}
    >
      {children}
    </button>
  )
}

export function Card({ className, children, ...p }) {
  return (
    <div className={cx('rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,.04),0_4px_16px_-8px_rgba(15,23,42,.08)]', className)} {...p}>
      {children}
    </div>
  )
}

export function Chip({ active, onClick, children, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition',
        active ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50',
        className
      )}
    >
      {children}
    </button>
  )
}

export const inputCls =
  'h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100'

export function Field({ label, children, className, hint }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

/* ---------- Modal (hoja inferior en celular) ---------- */
export function Modal({ open, onClose, title, subtitle, children, footer, wide }) {
  useEffect(() => {
    if (!open) return
    const k = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="anim-fade absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cx('anim-up relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl', wide ? 'sm:max-w-2xl' : 'sm:max-w-lg')}
      >
        <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar"><X size={18} /></Button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  )
}

/* ---------- Toasts ---------- */
export function Toasts() {
  const { toasts, closeToast } = useApp()
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:pr-6">
      {toasts.map((t) => (
        <div key={t.id} className="anim-up pointer-events-auto flex max-w-md items-center gap-3 rounded-xl bg-slate-900 py-2.5 pl-3.5 pr-2 text-sm text-white shadow-xl">
          {t.tone === 'success' ? <CircleCheck size={18} className="text-emerald-400" /> : <Info size={18} className="text-indigo-300" />}
          <span className="flex-1">{t.text}</span>
          {t.undo && (
            <button className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium text-indigo-200 hover:bg-white/10" onClick={() => { t.undo(); closeToast(t.id) }}>
              <Undo2 size={14} /> Deshacer
            </button>
          )}
          <button className="rounded-md p-1 text-slate-400 hover:bg-white/10" onClick={() => closeToast(t.id)} aria-label="Cerrar"><X size={14} /></button>
        </div>
      ))}
    </div>
  )
}

export function Progress({ value, className, color = 'bg-emerald-500' }) {
  return (
    <div className={cx('h-2 w-full overflow-hidden rounded-full bg-slate-100', className)}>
      <div className={cx('h-full rounded-full transition-all duration-700', color)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
}

export function Empty({ icon: I, title, text }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      {I && <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-500"><I size={20} /></span>}
      <p className="font-medium text-slate-800">{title}</p>
      {text && <p className="mt-1 max-w-xs text-sm text-slate-500">{text}</p>}
    </div>
  )
}

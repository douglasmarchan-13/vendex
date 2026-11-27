import { useEffect, useState } from 'react'
import { CircleAlert, Eye, EyeOff } from 'lucide-react'
import { Logo, cx, inputCls } from '../components/ui'

/** Pantalla centrada para login, recuperación y registro */
export function AuthLayout({ title, subtitle, children, footer }) {
  useEffect(() => {
    document.title = `${title} · Vendex`
  }, [title])
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#F8FAFC] px-4 py-10 text-slate-900">
      <div className="mb-6 flex items-center gap-3">
        <Logo />
        <div className="leading-tight">
          <p className="text-[17px] font-bold tracking-tight">Vendex</p>
          <p className="text-[11px] text-slate-500">Tu copiloto para vender más</p>
        </div>
      </div>
      <main className="w-full max-w-sm rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,.04),0_8px_24px_-12px_rgba(15,23,42,.15)] sm:p-7">
        <h1 className="text-lg font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        <div className="mt-5">{children}</div>
      </main>
      {footer && <div className="mt-5 text-center text-sm text-slate-500">{footer}</div>}
    </div>
  )
}

export function FormError({ children }) {
  if (!children) return null
  return (
    <p role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
      <CircleAlert size={16} className="mt-0.5 shrink-0" /> <span>{children}</span>
    </p>
  )
}

export function SubmitButton({ busy, children }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-indigo-600 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700 active:scale-[.99] disabled:opacity-60"
    >
      {busy ? 'Un momento…' : children}
    </button>
  )
}

export function TextField({ label, hint, className, ...p }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-slate-700">{label}</span>
      <input className={cx(inputCls, p.readOnly && 'bg-slate-50 text-slate-600 focus:border-slate-200 focus:ring-0')} {...p} />
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

export function PasswordField({ label, hint, ...p }) {
  const [show, setShow] = useState(false)
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-slate-700">{label}</span>
      <span className="relative block">
        <input type={show ? 'text' : 'password'} className={cx(inputCls, 'pr-11')} {...p} />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-400 hover:text-slate-600"
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

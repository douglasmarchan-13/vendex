import { useId, useState } from 'react'
import { Check, Copy, Eye, EyeOff, KeyRound, Mail, ShieldAlert, Wand2 } from 'lucide-react'
import { PASSWORD_HINT, copyText, generatePassword, passwordProblem } from '../auth/passwords'
import { Button, cx, inputCls } from './ui'

/** Métodos de alta de usuarios de una empresa (companies.user_onboarding, lo fija el super admin) */
const ONBOARDING = {
  invitacion: { icon: Mail, label: 'Invitación por correo', desc: 'Recibe un enlace y crea su propia contraseña.' },
  directa: { icon: KeyRound, label: 'Contraseña directa', desc: 'La cuenta queda activa ya con una clave temporal que cambia al entrar.' },
}

/** Interruptor entre los dos métodos de alta */
export function OnboardingSwitch({ value, onChange, label = 'Alta de usuarios', hint }) {
  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-medium text-slate-700">{label}</span>
      <div role="radiogroup" aria-label={label} className="grid gap-2 sm:grid-cols-2">
        {Object.entries(ONBOARDING).map(([id, m]) => {
          const on = value === id
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(id)}
              className={cx('flex items-start gap-3 rounded-xl border p-3 text-left transition', on ? 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-slate-300')}
            >
              <span className={cx('mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition', on ? 'bg-indigo-600' : 'bg-slate-200')}>
                <span className={cx('h-4 w-4 rounded-full bg-white shadow transition', on && 'translate-x-4')} />
              </span>
              <span>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900"><m.icon size={15} className="text-indigo-600" /> {m.label}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{m.desc}</span>
              </span>
            </button>
          )
        })}
      </div>
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

/** Insignia de solo lectura con el método de la empresa */
export function OnboardingBadge({ value }) {
  const m = ONBOARDING[value] || ONBOARDING.invitacion
  return (
    <span title={`Alta de usuarios: ${m.label}`} className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
      <m.icon size={11} /> {m.label}
    </span>
  )
}

function useCopied() {
  const [copied, setCopied] = useState(false)
  const copy = async (text) => {
    setCopied(await copyText(text))
    setTimeout(() => setCopied(false), 1800)
  }
  return [copied, copy]
}

/**
 * Contraseña temporal: se escribe a mano o se genera una aleatoria segura (editable después).
 * Se muestra en claro por defecto: quien la crea tiene que poder leerla para entregarla.
 */
export function TempPasswordField({ value, onChange, label = 'Contraseña temporal', className }) {
  const [show, setShow] = useState(true)
  const [copied, copy] = useCopied()
  const id = useId()
  const problem = value ? passwordProblem(value) : null
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-slate-700">{label}</label>
      <span className="relative block">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          spellCheck={false}
          placeholder="Escríbela o genera una"
          className={cx(inputCls, 'pr-11 font-mono')}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-400 hover:text-slate-600"
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={() => { onChange(generatePassword()); setShow(true) }}>
          <Wand2 size={14} /> {value ? 'Generar otra' : 'Generar contraseña segura'}
        </Button>
        <Button type="button" size="sm" variant={copied ? 'success' : 'secondary'} disabled={!value} onClick={() => copy(value)}>
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copiada' : 'Copiar'}
        </Button>
      </div>
      <p className={cx('mt-1.5 text-xs', problem ? 'font-medium text-rose-600' : 'text-slate-500')}>
        {problem || `Puedes escribirla a mano o generarla y luego editarla. ${PASSWORD_HINT}`}
      </p>
    </div>
  )
}

/** Datos de acceso para entregar tras un alta directa. La contraseña no se vuelve a mostrar. */
export function CredentialsCard({ email, password }) {
  const [copied, copy] = useCopied()
  const text = `Vendex\nCorreo: ${email}\nContraseña temporal: ${password}\nAl entrar te pedirá crear tu propia contraseña.`
  return (
    <div className="space-y-3">
      <dl className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
        <div className="flex justify-between gap-3"><dt className="text-slate-500">Correo</dt><dd className="truncate font-medium text-slate-800">{email}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-slate-500">Contraseña temporal</dt><dd className="font-mono font-medium text-slate-800">{password}</dd></div>
      </dl>
      <Button variant={copied ? 'success' : 'secondary'} className="w-full" onClick={() => copy(text)}>
        {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copiado' : 'Copiar correo y contraseña'}
      </Button>
      <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-inset ring-amber-200">
        <ShieldAlert size={14} className="mt-0.5 shrink-0" />
        Entrégala por un canal privado. No se vuelve a mostrar y en el primer inicio de sesión deberá cambiarla por una propia.
      </p>
    </div>
  )
}

import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { MailCheck } from 'lucide-react'
import { authApi } from '../lib/api'
import { AuthLayout, FormError, SubmitButton, TextField } from './AuthLayout'
import { errorText } from './passwords'

export default function ForgotPassword() {
  const loc = useLocation()
  const [email, setEmail] = useState(loc.state?.email || '')
  const [sentTo, setSentTo] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await authApi.forgotPassword(email.trim())
      setSentTo(email.trim())
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const back = <Link to="/login" state={{ email }} className="font-medium text-indigo-600 hover:text-indigo-700">Volver a iniciar sesión</Link>

  if (sentTo) {
    return (
      <AuthLayout title="Revisa tu correo" footer={back}>
        <div className="flex gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-600"><MailCheck size={20} /></span>
          <div className="space-y-2 text-sm text-slate-600">
            {/* El backend responde igual exista o no la cuenta: no se confirma si el correo está registrado */}
            <p>Si <b className="font-semibold text-slate-800">{sentTo}</b> tiene una cuenta en Vendex, te enviamos un enlace para crear una nueva contraseña.</p>
            <p>El enlace vence en 1 hora y sirve una sola vez. Si no lo ves, revisa la carpeta de spam.</p>
          </div>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Recupera tu contraseña" subtitle="Te enviaremos un enlace a tu correo registrado." footer={back}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormError>{error}</FormError>
        <TextField label="Correo" type="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
        <SubmitButton busy={busy}>Enviar enlace</SubmitButton>
      </form>
    </AuthLayout>
  )
}

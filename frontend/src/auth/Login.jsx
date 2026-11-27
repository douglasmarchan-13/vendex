import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { useAuth } from './AuthContext'
import { AuthLayout, FormError, PasswordField, SubmitButton, TextField } from './AuthLayout'
import { errorText } from './passwords'

export default function Login() {
  const { login } = useAuth()
  const loc = useLocation()
  const [email, setEmail] = useState(loc.state?.email || '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      // Con la sesión iniciada, GuestRoute lleva a la página pedida (o al inicio del rol)
      await login(email.trim(), password)
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Inicia sesión" subtitle="Entra con el correo y la contraseña de tu cuenta.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {loc.state?.notice && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-inset ring-emerald-200">{loc.state.notice}</p>}
        <FormError>{error}</FormError>
        <TextField label="Correo" type="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
        <PasswordField label="Contraseña" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="text-right">
          <Link to="/recuperar-clave" state={{ email }} className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        <SubmitButton busy={busy}>Entrar</SubmitButton>
      </form>
    </AuthLayout>
  )
}

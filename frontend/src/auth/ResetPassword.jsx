import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { authApi } from '../lib/api'
import { AuthLayout, FormError, PasswordField, SubmitButton, TextField } from './AuthLayout'
import { PASSWORD_HINT, errorText, passwordProblem } from './passwords'
import { Splash } from './ProtectedRoute'

/** /restablecer-clave?token=... (enlace del correo de recuperación) */
export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const navigate = useNavigate()
  const [info, setInfo] = useState(() => (token ? null : { error: 'Falta el código del enlace. Ábrelo de nuevo desde el correo.' })) // { email } | { error }
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!token) return
    authApi.checkReset(token).then(setInfo, (e) => setInfo({ error: errorText(e) }))
  }, [token])

  async function submit(e) {
    e.preventDefault()
    const problem = passwordProblem(password, confirm)
    if (problem) return setError(problem)
    setError(null)
    setBusy(true)
    try {
      await authApi.resetPassword(token, password)
      navigate('/login', { replace: true, state: { email: info.email, notice: 'Listo: tu contraseña cambió. Inicia sesión con la nueva.' } })
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  if (!info) return <Splash />
  if (info.error) {
    return (
      <AuthLayout title="El enlace no sirve" footer={<Link to="/login" className="font-medium text-indigo-600">Ir a iniciar sesión</Link>}>
        <FormError>{info.error}</FormError>
        <Link to="/recuperar-clave" className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-lg bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700">
          Pedir un enlace nuevo
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Crea una nueva contraseña" subtitle="Al guardarla se cerrarán las sesiones abiertas en otros equipos.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormError>{error}</FormError>
        <TextField label="Cuenta" type="email" value={info.email} readOnly autoComplete="username" />
        <PasswordField label="Nueva contraseña" autoComplete="new-password" required autoFocus hint={PASSWORD_HINT} value={password} onChange={(e) => setPassword(e.target.value)} />
        <PasswordField label="Repite la contraseña" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <SubmitButton busy={busy}>Guardar contraseña</SubmitButton>
      </form>
    </AuthLayout>
  )
}

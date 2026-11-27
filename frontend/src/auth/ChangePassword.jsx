import { useState } from 'react'
import { useNavigate } from 'react-router'
import { authApi } from '../lib/api'
import { homeFor } from '../lib/session'
import { useAuth } from './AuthContext'
import { AuthLayout, FormError, PasswordField, SubmitButton, TextField } from './AuthLayout'
import { PASSWORD_HINT, errorText, passwordProblem } from './passwords'

/**
 * /cambiar-clave. Obligatoria si la cuenta se creó con una clave temporal (user.mustChangePassword):
 * ProtectedRoute no deja ver otra pantalla hasta guardarla. También sirve para cambiarla a voluntad.
 */
export default function ChangePassword() {
  const { user, logout, startSession } = useAuth()
  const navigate = useNavigate()
  const forced = !!user?.mustChangePassword
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!current) return setError(forced ? 'Escribe la contraseña temporal que te dieron.' : 'Escribe tu contraseña actual.')
    const problem = passwordProblem(password, confirm)
    if (problem) return setError(problem)
    if (password === current) return setError('La nueva contraseña debe ser distinta de la actual.')
    setError(null)
    setBusy(true)
    try {
      const r = await authApi.changePassword(current, password)
      // La sesión anterior deja de valer: se reemplaza por la que devuelve el backend
      startSession(r)
      navigate(homeFor(r.user.role), { replace: true })
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title={forced ? 'Elige tu contraseña' : 'Cambiar contraseña'}
      subtitle={
        forced
          ? 'Tu cuenta se creó con una contraseña temporal. Para continuar, crea una contraseña personal que solo tú conozcas.'
          : 'Al guardarla se cerrarán las sesiones abiertas en otros equipos.'
      }
      footer={
        forced ? (
          <button type="button" onClick={logout} className="font-medium text-indigo-600 hover:text-indigo-700">
            Cerrar sesión
          </button>
        ) : (
          <button type="button" onClick={() => navigate(-1)} className="font-medium text-indigo-600 hover:text-indigo-700">
            Volver
          </button>
        )
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormError>{error}</FormError>
        <TextField label="Cuenta" type="email" value={user?.email || ''} readOnly autoComplete="username" />
        <PasswordField
          label={forced ? 'Contraseña temporal' : 'Contraseña actual'}
          autoComplete="current-password"
          required
          autoFocus
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <PasswordField label="Nueva contraseña" autoComplete="new-password" required hint={PASSWORD_HINT} value={password} onChange={(e) => setPassword(e.target.value)} />
        <PasswordField label="Repite la nueva contraseña" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <SubmitButton busy={busy}>Guardar y continuar</SubmitButton>
      </form>
    </AuthLayout>
  )
}

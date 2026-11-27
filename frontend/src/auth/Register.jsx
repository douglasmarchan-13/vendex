import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { authApi } from '../lib/api'
import { ROLE_NAMES, homeFor } from '../lib/session'
import { useAuth } from './AuthContext'
import { AuthLayout, FormError, PasswordField, SubmitButton, TextField } from './AuthLayout'
import { PASSWORD_HINT, errorText, passwordProblem } from './passwords'
import { Splash } from './ProtectedRoute'

/** /registro?token=... : activa la cuenta de una invitación (correo y rol vienen bloqueados) */
export default function Register() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const navigate = useNavigate()
  const { user, endSession, startSession } = useAuth()
  const [inv, setInv] = useState(() => (token ? null : { error: 'Falta el código de la invitación. Ábrela de nuevo desde el correo.' })) // { email, role, name, companyName } | { error }
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!token) return
    authApi.getInvitation(token).then(
      (r) => {
        setInv(r)
        setName(r.name || '')
      },
      (e) => setInv({ error: errorText(e) })
    )
  }, [token])

  async function submit(e) {
    e.preventDefault()
    if (name.trim().length < 2) return setError('Indica tu nombre completo.')
    const problem = passwordProblem(password, confirm)
    if (problem) return setError(problem)
    setError(null)
    setBusy(true)
    try {
      const r = await authApi.acceptInvitation(token, name.trim(), password)
      startSession(r)
      navigate(homeFor(r.user.role), { replace: true })
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  if (!inv) return <Splash />
  if (inv.error) {
    return (
      <AuthLayout title="No pudimos abrir la invitación" footer={<Link to="/login" className="font-medium text-indigo-600">Ir a iniciar sesión</Link>}>
        <FormError>{inv.error}</FormError>
        <p className="mt-3 text-sm text-slate-500">Pide a quien te invitó que te envíe una invitación nueva.</p>
      </AuthLayout>
    )
  }

  // Otra cuenta abierta en este navegador: hay que salir antes de activar esta
  if (user && user.email !== inv.email) {
    return (
      <AuthLayout title="Tienes otra sesión abierta">
        <p className="text-sm text-slate-600">
          Estás conectado como <b className="font-semibold text-slate-800">{user.email}</b>. Cierra esa sesión para activar la cuenta de{' '}
          <b className="font-semibold text-slate-800">{inv.email}</b>.
        </p>
        <button onClick={endSession} className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-lg bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700">
          Cerrar sesión y continuar
        </button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title={`Únete a ${inv.companyName}`}
      subtitle="Completa tus datos para activar tu cuenta."
      footer={<>¿Ya tienes cuenta? <Link to="/login" state={{ email: inv.email }} className="font-medium text-indigo-600">Inicia sesión</Link></>}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormError>{error}</FormError>
        <TextField label="Correo" type="email" value={inv.email} readOnly autoComplete="username" />
        <TextField label="Rol" value={ROLE_NAMES[inv.role] || inv.role} readOnly />
        <TextField label="Tu nombre" autoComplete="name" required autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        <PasswordField label="Contraseña" autoComplete="new-password" required hint={PASSWORD_HINT} value={password} onChange={(e) => setPassword(e.target.value)} />
        <PasswordField label="Repite la contraseña" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <SubmitButton busy={busy}>Activar mi cuenta</SubmitButton>
      </form>
    </AuthLayout>
  )
}

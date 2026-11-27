import { Navigate, Outlet, useLocation } from 'react-router'
import { Logo } from '../components/ui'
import { afterLogin, homeFor } from '../lib/session'
import { useAuth } from './AuthContext'

const CHANGE_PASSWORD = '/cambiar-clave'

export function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-[#F8FAFC]">
      <div className="flex flex-col items-center gap-3 text-sm text-slate-500">
        <Logo size={40} />
        Cargando…
      </div>
    </div>
  )
}

/**
 * Solo con sesión y uno de los `roles` permitidos.
 * Sin sesión → /login (y vuelve aquí después). Clave temporal → /cambiar-clave. Rol equivocado → su pantalla de inicio.
 */
export function ProtectedRoute({ roles, children }) {
  const { status, user, loggedOut } = useAuth()
  const loc = useLocation()
  if (status === 'loading') return <Splash />
  if (!user) return <Navigate to="/login" replace state={loggedOut ? undefined : { from: loc.pathname + loc.search }} />
  // Clave temporal (alta directa del gerente): nada más hasta que elija la suya
  if (user.mustChangePassword && loc.pathname !== CHANGE_PASSWORD) return <Navigate to={CHANGE_PASSWORD} replace />
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />
  return children ?? <Outlet />
}

/**
 * Login y "olvidé mi contraseña": con sesión, a la página que se había pedido o al inicio del rol.
 * (También resuelve la redirección justo después de iniciar sesión.)
 */
export function GuestRoute({ children }) {
  const { status, user } = useAuth()
  const loc = useLocation()
  if (status === 'loading') return <Splash />
  if (user) return <Navigate to={afterLogin(loc.state?.from, user.role)} replace />
  return children ?? <Outlet />
}

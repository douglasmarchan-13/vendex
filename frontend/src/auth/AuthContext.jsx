import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { authApi } from '../lib/api'
import { clearSession, getSession, onSessionChange, setSession, updateUser } from '../lib/session'

const Ctx = createContext(null)

/**
 * Sesión del usuario: { user, status: 'loading' | 'authed' | 'anon', login, logout, startSession }.
 * Al abrir la app confirma la sesión guardada con /auth/me (rol o empresa pueden haber cambiado).
 */
export function AuthProvider({ children }) {
  const [session, setState] = useState(getSession)
  const [checked, setChecked] = useState(() => !getSession())
  // true tras "Cerrar sesión": el login no debe devolver al próximo usuario a la página del anterior
  const [loggedOut, setLoggedOut] = useState(false)

  useEffect(() => onSessionChange(setState), [])

  useEffect(() => {
    if (checked) return
    authApi
      .me()
      .then(updateUser)
      .catch(() => {
        /* 401: api.js ya borró la sesión · sin conexión: se mantiene la guardada */
      })
      .finally(() => setChecked(true))
  }, [checked])

  // Cierra la sesión justo cuando vence el token
  useEffect(() => {
    if (!session) return
    const ms = Date.parse(session.expiresAt) - Date.now()
    const t = setTimeout(clearSession, Math.max(0, Math.min(ms, 2 ** 31 - 1)))
    return () => clearTimeout(t)
  }, [session])

  const login = useCallback(async (email, password) => {
    const r = await authApi.login(email, password)
    setLoggedOut(false)
    setSession(r)
    return r.user
  }, [])

  // Salir a propósito: ProtectedRoute manda al login sin recordar la página (el próximo usuario empieza en
  // su inicio). Si la sesión vence sola, sí la recuerda para volver ahí tras iniciar sesión.
  const logout = useCallback(() => {
    setLoggedOut(true)
    clearSession()
  }, [])
  const startSession = useCallback((s) => {
    setLoggedOut(false)
    setSession(s)
  }, [])

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      status: !checked ? 'loading' : session ? 'authed' : 'anon',
      login,
      logout,
      /** Cierra la sesión sin salir de la página actual (p. ej. para activar otra cuenta en /registro) */
      endSession: clearSession,
      /** Para respuestas que ya traen { token, expiresAt, user } (aceptar invitación) */
      startSession,
      loggedOut,
    }),
    [session, checked, login, logout, startSession, loggedOut]
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(Ctx)

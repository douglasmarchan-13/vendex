import { useEffect, useRef } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router'
import { AppProvider, useApp } from './store'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { GuestRoute, ProtectedRoute, Splash } from './auth/ProtectedRoute'
import Login from './auth/Login'
import ForgotPassword from './auth/ForgotPassword'
import ResetPassword from './auth/ResetPassword'
import Register from './auth/Register'
import ChangePassword from './auth/ChangePassword'
import { homeFor } from './lib/session'
import { MobileNav, NAV, Sidebar, TopBar, navFor } from './components/Shell'
import { Avatar, Toasts } from './components/ui'
import ClientDrawer from './components/ClientDrawer'
import Modals from './components/Modals'
import Today from './views/Today'
import Pipeline from './views/Pipeline'
import Clients from './views/Clients'
import Planning from './views/Planning'
import Collections, { useCobros } from './views/Collections'
import Team from './views/Team'
import Admin from './views/Admin'

const VIEWS = { hoy: Today, embudo: Pipeline, clientes: Clients, cobranza: Collections, planeacion: Planning, equipo: Team }

/** Al abrir la app, avisa una vez por sesión los cobros vencidos y de hoy */
function CobroNotifier() {
  const { toast, fromUSD } = useApp()
  const c = useCobros()
  const done = useRef(false)
  useEffect(() => {
    if (done.current) return
    done.current = true
    try {
      if (sessionStorage.getItem('vx-cobro-aviso')) return
      sessionStorage.setItem('vx-cobro-aviso', '1')
    } catch {
      /* sin sessionStorage: igual avisamos */
    }
    if (!c.overdue.length && !c.today.length) return
    const parts = []
    if (c.overdue.length) parts.push(`${c.overdue.length} cobro${c.overdue.length > 1 ? 's' : ''} vencido${c.overdue.length > 1 ? 's' : ''} (${fromUSD(c.sum(c.overdue), { compact: true })})`)
    if (c.today.length) parts.push(`${c.today.length} vence${c.today.length > 1 ? 'n' : ''} hoy`)
    setTimeout(() => toast(`Cobranza: tienes ${parts.join(' y ')}`), 600)
  }, [c, toast, fromUSD])
  return null
}

/** Gerente con un vendedor elegido: deja claro que el tablero no es de toda la empresa */
function FilterBanner() {
  const { sellerFilter, sellers, setSellerFilter } = useApp()
  const s = sellers[sellerFilter]
  if (!s) return null
  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl bg-indigo-50 px-4 py-2.5 text-sm text-indigo-800 ring-1 ring-inset ring-indigo-200">
      <Avatar name={s.name} size="sm" />
      <span className="flex-1">Viendo solo los clientes, tratos y cobros de <b className="font-semibold">{s.name}</b>.</span>
      <button onClick={() => setSellerFilter('ALL')} className="font-medium text-indigo-700 hover:underline">Ver todo el equipo</button>
    </div>
  )
}

/** Operación de ventas (gerente y vendedor): /hoy, /embudo, /clientes, /cobranza, /planeacion, /equipo (solo gerente) */
function SalesApp() {
  const { view } = useParams()
  const { user } = useAuth()
  useEffect(() => {
    window.scrollTo({ top: 0 })
    const n = NAV.find((x) => x.id === view)
    if (n) document.title = `${n.label} · Vendex`
  }, [view])
  const View = VIEWS[view]
  if (!View || !navFor(user?.role).some((n) => n.id === view)) return <Navigate to="/hoy" replace />

  return (
    <div className="min-h-dvh bg-[#F8FAFC] text-slate-900">
      <Sidebar view={view} />
      <div className="lg:pl-64">
        <TopBar view={view} />
        <main key={view} className="anim-fade mx-auto max-w-[1400px] px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-6">
          <FilterBanner />
          <View />
        </main>
      </div>
      <MobileNav view={view} />
      <ClientDrawer />
      <Modals />
      <Toasts />
      <CobroNotifier />
    </div>
  )
}

/** "/" y rutas desconocidas → inicio según el rol. Los enlaces viejos "#embudo" pasan a "/embudo". */
function Home() {
  const { status, user } = useAuth()
  const { hash } = useLocation()
  const legacy = hash.slice(1)
  if (VIEWS[legacy]) return <Navigate to={`/${legacy}`} replace />
  if (status === 'loading') return <Splash />
  return <Navigate to={user ? homeFor(user.role) : '/login'} replace />
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <Routes>
          <Route element={<GuestRoute />}>
            <Route path="/login" element={<Login />} />
            <Route path="/recuperar-clave" element={<ForgotPassword />} />
          </Route>
          {/* Enlaces de los correos: funcionan con o sin sesión abierta */}
          <Route path="/restablecer-clave" element={<ResetPassword />} />
          <Route path="/registro" element={<Register />} />

          {/* Cualquier rol con sesión; obligatoria si la cuenta tiene clave temporal */}
          <Route path="/cambiar-clave" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute roles={['super_admin']}><Admin /></ProtectedRoute>} />
          <Route
            path="/:view"
            element={
              <ProtectedRoute roles={['gerente', 'vendedor']}>
                <AppProvider>
                  <SalesApp />
                </AppProvider>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Home />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

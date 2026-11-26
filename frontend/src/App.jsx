import { useEffect, useRef, useState } from 'react'
import { AppProvider, useApp } from './store'
import { MobileNav, NAV, Sidebar, TopBar } from './components/Shell'
import { Toasts } from './components/ui'
import ClientDrawer from './components/ClientDrawer'
import Modals from './components/Modals'
import Today from './views/Today'
import Pipeline from './views/Pipeline'
import Clients from './views/Clients'
import Planning from './views/Planning'
import Collections, { useCobros } from './views/Collections'

const VIEWS = { hoy: Today, embudo: Pipeline, clientes: Clients, cobranza: Collections, planeacion: Planning }

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
const current = () => {
  const h = window.location.hash.slice(1)
  return VIEWS[h] ? h : 'hoy'
}

export default function App() {
  const [view, setView] = useState(current)
  useEffect(() => {
    const on = () => {
      setView(current())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  useEffect(() => {
    document.title = `${NAV.find((n) => n.id === view)?.label} · Vendex`
  }, [view])
  const View = VIEWS[view]

  return (
    <AppProvider>
      <div className="min-h-dvh bg-[#F8FAFC] text-slate-900">
        <Sidebar view={view} />
        <div className="lg:pl-64">
          <TopBar view={view} />
          <main key={view} className="anim-fade mx-auto max-w-[1400px] px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-6">
            <View />
          </main>
        </div>
        <MobileNav view={view} />
        <ClientDrawer />
        <Modals />
        <Toasts />
        <CobroNotifier />
      </div>
    </AppProvider>
  )
}

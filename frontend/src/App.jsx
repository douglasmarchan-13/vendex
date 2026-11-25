import { useEffect, useState } from 'react'
import { AppProvider } from './store'
import { MobileNav, NAV, Sidebar, TopBar } from './components/Shell'
import { Toasts } from './components/ui'
import ClientDrawer from './components/ClientDrawer'
import Modals from './components/Modals'
import Today from './views/Today'
import Pipeline from './views/Pipeline'
import Clients from './views/Clients'
import Planning from './views/Planning'

const VIEWS = { hoy: Today, embudo: Pipeline, clientes: Clients, planeacion: Planning }
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
      </div>
    </AppProvider>
  )
}

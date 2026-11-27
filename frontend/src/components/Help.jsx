import { useState } from 'react'
import { ChevronDown, CircleHelp, Lightbulb } from 'lucide-react'
import { BASICS, HELP, forRole } from '../data/help'
import { Button, Chip, Modal, cx } from './ui'

const SEEN_KEY = 'vx-help-seen'

function readSeen() {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY)) || []
  } catch {
    return []
  }
}

function markSeen(id) {
  try {
    const seen = readSeen()
    if (!seen.includes(id)) localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, id]))
  } catch {
    /* sin localStorage: el punto vuelve a aparecer, no pasa nada */
  }
}

/**
 * Botón "?" de la barra superior: abre la guía del módulo actual.
 * Lleva un punto azul hasta que el usuario abre la ayuda de ese módulo por primera vez.
 * `modules` son los ids entre los que se puede saltar dentro del panel; `basics` agrega la sección común.
 */
export function HelpButton({ module, role, modules = [module], basics = true, className }) {
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState(readSeen)
  if (!HELP[module]) return null
  const fresh = !seen.includes(module)
  const show = () => {
    markSeen(module)
    setSeen(readSeen())
    setOpen(true)
  }
  return (
    <>
      <button
        onClick={show}
        aria-label="Ayuda de este módulo"
        title="¿Cómo funciona este módulo?"
        className={cx('relative grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:text-indigo-600', className)}
      >
        <CircleHelp size={18} />
        {fresh && <span data-testid="help-new" className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-indigo-500 ring-2 ring-[#F8FAFC]" />}
      </button>
      {open && <HelpPanel initial={module} role={role} modules={modules} basics={basics} onClose={() => setOpen(false)} />}
    </>
  )
}

export function HelpPanel({ initial, role, modules, basics, onClose }) {
  const [id, setId] = useState(initial)
  const [showBasics, setShowBasics] = useState(false)
  const h = HELP[id]
  const others = modules.filter((m) => HELP[m])
  const pick = (m) => {
    markSeen(m)
    setId(m)
  }
  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={<span className="flex items-center gap-2"><CircleHelp size={18} className="text-indigo-600" /> Ayuda · {h.title}</span>}
      subtitle="Lo esencial para empezar a usarlo en un minuto"
      footer={<Button variant="primary" onClick={onClose}>Entendido</Button>}
    >
      {others.length > 1 && (
        <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Módulos">
          {others.map((m) => (
            <Chip key={m} active={m === id} onClick={() => pick(m)}>{HELP[m].short}</Chip>
          ))}
        </div>
      )}

      <div key={id} className="anim-fade space-y-6">
        <p className="text-[15px] leading-relaxed text-slate-700">{h.intro}</p>

        <section>
          <h3 className="text-xs font-semibold text-slate-400">Empieza en 3 pasos</h3>
          <ol className="mt-2 space-y-2">
            {h.steps.map((s, i) => (
              <li key={i} className="flex gap-3 rounded-xl bg-indigo-50/60 p-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-indigo-600 text-xs font-bold text-white">{i + 1}</span>
                <span className="text-sm leading-relaxed text-slate-800">{s}</span>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h3 className="text-xs font-semibold text-slate-400">Qué encuentras aquí</h3>
          <dl className="mt-2 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {forRole(h.features, role).map((f) => (
              <div key={f.title + f.text}>
                <dt className="text-sm font-semibold text-slate-900">{f.title}</dt>
                <dd className="mt-0.5 text-sm leading-relaxed text-slate-600">{f.text}</dd>
              </div>
            ))}
          </dl>
        </section>

        {h.tips?.length > 0 && (
          <section className="rounded-xl bg-amber-50 p-3 ring-1 ring-inset ring-amber-200">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-amber-900"><Lightbulb size={15} /> Consejos</h3>
            <ul className="mt-1.5 space-y-1 text-sm leading-relaxed text-amber-900">
              {h.tips.map((t) => <li key={t}>· {t}</li>)}
            </ul>
          </section>
        )}

        {basics && (
          <section className="border-t border-slate-100 pt-4">
            <button onClick={() => setShowBasics((v) => !v)} aria-expanded={showBasics} className="flex w-full items-center gap-2 text-left text-sm font-semibold text-slate-700">
              Lo básico de Vendex: barra superior y menú
              <ChevronDown size={16} className={cx('ml-auto text-slate-400 transition', showBasics && 'rotate-180')} />
            </button>
            {showBasics && (
              <dl className="anim-fade mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {forRole(BASICS, role).map((b) => (
                  <div key={b.title}>
                    <dt className="text-sm font-semibold text-slate-900">{b.title}</dt>
                    <dd className="mt-0.5 text-sm leading-relaxed text-slate-600">{b.text}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        )}
      </div>
    </Modal>
  )
}

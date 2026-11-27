import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { COUNTRIES } from './data/mock'
import { convert, fmtMoney, toUSD } from './lib/money'
import { at } from './lib/dates'
import { endpoints, SELLER_ID } from './lib/api'
import { useAuth } from './auth/AuthContext'

const UIKEY = 'vendex-ui-v1'
const Ctx = createContext(null)

// Tiempo para "Deshacer": la acción se guarda en el servidor cuando vence (algo más que el toast)
const UNDO_MS = 6500
// Pausa antes de guardar controles que cambian seguido (sliders de meta y planificador)
const DEBOUNCE_MS = 600
// Espera antes de releer el estado del servidor tras una serie de cambios
const RESYNC_MS = 400

function readPrefs() {
  try {
    localStorage.removeItem('vendex-demo-v3') // datos locales de la versión sin backend
    const s = localStorage.getItem(UIKEY)
    return s ? JSON.parse(s) : { country: 'ALL', currency: 'USD' }
  } catch {
    return { country: 'ALL', currency: 'USD' }
  }
}

let uid = 0
const newId = (p) => `${p}${Date.now().toString(36)}${uid++}`

const withoutCatalogs = ({ catalogs: _c, ...state }) => state

export function AppProvider({ children }) {
  const { user } = useAuth()
  const sellerId = user?.sellerId ?? SELLER_ID
  // Solo el gerente cambia meta, plan, tipo de cambio y estrategia (el backend también lo exige)
  const canManage = user?.role === 'gerente'
  const [data, setData] = useState(null)
  const [catalogs, setCatalogs] = useState(null)
  // Filtro del gerente: 'ALL' o el id de un vendedor (se envía como ?vendedor_id=)
  const [sellerFilter, setSellerFilterState] = useState('ALL')
  const filterRef = useRef('ALL')
  const bootstrap = () => endpoints.bootstrap(filterRef.current === 'ALL' ? undefined : filterRef.current)
  const [loadError, setLoadError] = useState(null)
  const [prefs, setPrefs] = useState(readPrefs)
  const [toasts, setToasts] = useState([])
  const [drawer, setDrawer] = useState(null) // contactId
  const [modal, setModal] = useState(null) // { type, ...props }
  const dataRef = useRef(data)
  useLayoutEffect(() => {
    dataRef.current = data
  }, [data])

  useEffect(() => {
    try {
      localStorage.setItem(UIKEY, JSON.stringify(prefs))
    } catch {
      /* sin almacenamiento: las preferencias duran la sesión */
    }
  }, [prefs])

  const toast = useCallback((text, opts = {}) => {
    const id = newId('toast')
    setToasts((t) => [...t.slice(-2), { id, text, ...opts }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts.undo ? 6000 : 3500)
  }, [])
  const closeToast = (id) => setToasts((t) => t.filter((x) => x.id !== id))

  /* ------------------------------------------------------------------------
   * Sincronización con el backend
   *  · Los cambios se aplican al instante en pantalla (optimista) y se envían
   *    a la API en una cola, uno tras otro, en el mismo orden.
   *  · Las acciones con "Deshacer" esperan UNDO_MS antes de enviarse; deshacer
   *    las cancela. Cualquier otra acción las envía de inmediato para no
   *    alterar el orden.
   *  · Cuando la cola queda vacía se relee el estado del servidor, que trae los
   *    IDs reales y lo que la base genera sola (actividades de venta, abonos…).
   * ---------------------------------------------------------------------- */
  const sync = useRef({ queue: Promise.resolve(), inflight: 0, version: 0, pending: new Map(), resyncTimer: null })

  const load = useCallback(async () => {
    setLoadError(null)
    const filter = filterRef.current
    try {
      const state = await bootstrap()
      if (filter !== filterRef.current) return // el filtro cambió mientras cargaba
      setCatalogs(state.catalogs)
      setData(withoutCatalogs(state))
    } catch (e) {
      if (filter === filterRef.current) setLoadError(e)
    }
    // bootstrap solo lee filterRef (estable)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const idle = () => sync.current.inflight === 0 && sync.current.pending.size === 0

  const scheduleResync = useCallback(() => {
    const s = sync.current
    clearTimeout(s.resyncTimer)
    s.resyncTimer = setTimeout(async () => {
      if (!idle()) return // se volverá a pedir cuando terminen los cambios en curso
      const v = s.version
      try {
        const state = await bootstrap()
        // Si hubo cambios locales mientras tanto, esta lectura ya está vieja
        if (v === s.version && idle()) setData(withoutCatalogs(state))
      } catch {
        /* sin conexión: se mantiene lo que hay en pantalla */
      }
    }, RESYNC_MS)
  }, [])

  const enqueue = useCallback(
    (run) => {
      const s = sync.current
      s.version++
      s.inflight++
      const p = s.queue.then(run)
      s.queue = p
        .catch((e) => {
          toast(`No se pudo guardar el cambio: ${e.message}`)
        })
        .finally(() => {
          s.inflight--
          scheduleResync()
        })
      return p
    },
    [toast, scheduleResync]
  )

  const flushPending = useCallback(() => {
    const s = sync.current
    for (const [key, item] of s.pending) {
      clearTimeout(item.timer)
      s.pending.delete(key)
      enqueue(item.run)
    }
  }, [enqueue])

  /** Envía un cambio a la API (después de los que estaban esperando). Devuelve la respuesta. */
  const send = useCallback(
    (run) => {
      flushPending()
      return enqueue(run)
    },
    [flushPending, enqueue]
  )

  /** Programa un envío diferido; si ya había uno con la misma clave, lo reemplaza */
  const defer = useCallback(
    (key, run, delay) => {
      const s = sync.current
      const prev = s.pending.get(key)
      if (prev) clearTimeout(prev.timer)
      s.version++
      s.pending.set(key, {
        run,
        timer: setTimeout(() => {
          s.pending.delete(key)
          enqueue(run)
        }, delay),
      })
    },
    [enqueue]
  )

  // Al ocultar o cerrar la pestaña, guardar lo que estaba esperando
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && flushPending()
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', flushPending)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', flushPending)
    }
  }, [flushPending])

  /** Aplica un cambio, ofrece "Deshacer" y lo guarda en el servidor al vencer el plazo */
  const withUndo = useCallback(
    (text, fn, tone, commit) => {
      const prev = dataRef.current
      const key = newId('undo')
      setData(fn)
      defer(key, commit, UNDO_MS)
      toast(text, {
        tone,
        undo: () => {
          const s = sync.current
          const item = s.pending.get(key)
          if (!item) {
            toast('Ese cambio ya se guardó; no se puede deshacer')
            return
          }
          clearTimeout(item.timer)
          s.pending.delete(key)
          s.version++
          setData(prev)
          scheduleResync()
        },
      })
    },
    [toast, defer, scheduleResync]
  )

  const rates = data?.rates
  const currency = prefs.currency

  const api = useMemo(() => {
    if (!data) return null
    const contactById = Object.fromEntries(data.contacts.map((c) => [c.id, c]))
    const inCountry = (countryCode) => prefs.country === 'ALL' || countryCode === prefs.country
    const lastContact = (c) => c.timeline.filter((t) => t.by !== 'sistema').reduce((m, t) => (t.at > m ? t.at : m), '1970-01-01')

    const addToTimeline = (d, contactId, type, text) => ({
      ...d,
      contacts: d.contacts.map((c) =>
        c.id === contactId ? { ...c, timeline: [{ id: newId('t'), at: new Date().toISOString(), type, text, by: sellerId }, ...c.timeline] } : c
      ),
    })

    const logActivity = (contactId, type, text) => {
      setData((d) => addToTimeline(d, contactId, type, text))
      send(() => endpoints.logActivity(contactId, type, text))
    }

    const snooze = (id, days = 1, { silent = false } = {}) => {
      const until = at(days, 0)
      const local = (d) => ({ ...d, snoozed: { ...d.snoozed, [id]: until } })
      const commit = () => endpoints.snooze(id, until)
      if (silent) {
        setData(local)
        send(commit)
      } else {
        withUndo(days === 1 ? 'Aviso pospuesto hasta mañana' : `Aviso pospuesto ${days} días`, local, undefined, commit)
      }
    }

    return {
      data,
      prefs,
      currency,
      country: prefs.country,
      setCountry: (country) =>
        setPrefs({ country, currency: country === 'ALL' ? 'USD' : COUNTRIES[country].display }),
      setCurrency: (cur) => setPrefs((p) => ({ ...p, currency: cur })),
      contactById,
      inCountry,
      lastContact,
      usd: (amount, cur) => toUSD(amount, cur, rates),
      /** Monto convertido a la moneda de visualización */
      money: (amount, cur, opts) => fmtMoney(convert(amount, cur, currency, rates), currency, opts),
      fromUSD: (usd, opts) => fmtMoney(usd * rates[currency], currency, opts),
      original: (amount, cur, opts) => fmtMoney(amount, cur, opts),
      toast,
      toasts,
      closeToast,
      drawer,
      openContact: setDrawer,
      closeDrawer: () => setDrawer(null),
      modal,
      openModal: (type, props = {}) => setModal({ type, ...props }),
      closeModal: () => setModal(null),
      logActivity,

      moveDeal(dealId, stage) {
        const deal = dataRef.current.deals.find((x) => x.id === dealId)
        if (!deal || deal.stage === stage) return
        const c = contactById[deal.contactId]
        const closing = stage === 'cerrado'
        withUndo(
          closing ? `¡Venta cerrada con ${c.name.split(' ')[0]}!` : `Trato movido a “${stageName(stage)}”`,
          (d) => {
            const next = {
              ...d,
              deals: d.deals.map((x) =>
                x.id === dealId ? { ...x, stage, closedAt: closing ? new Date().toISOString() : undefined } : x
              ),
            }
            return closing ? addToTimeline(next, deal.contactId, 'venta', `¡Compró! ${deal.product}.`) : next
          },
          closing ? 'success' : undefined,
          () => endpoints.moveDeal(dealId, stage)
        )
        // Al cerrar una venta, Vendex pide definir cómo se va a cobrar
        if (closing && !dataRef.current.payments.some((p) => p.dealId === dealId)) setModal({ type: 'plan', dealId })
      },

      /* ---------- Cobranza ---------- */
      createPlan(dealId, items, firstPaid) {
        const deal = dataRef.current.deals.find((x) => x.id === dealId)
        if (!deal) return
        const now = new Date().toISOString()
        setData((d) => ({
          ...d,
          payments: [
            ...d.payments.filter((p) => p.dealId !== dealId || p.paidAt),
            ...items.map((it, i) => ({
              id: newId('p'), dealId, contactId: deal.contactId, currency: deal.currency,
              n: it.n, of: it.of, label: it.label, amount: it.amount, dueAt: at(it.dueDays, 9),
              ...(firstPaid && i === 0 ? { paidAt: now, method: firstPaid, ref: '' } : {}),
            })),
          ],
        }))
        send(() =>
          endpoints.createPlan(
            dealId,
            items.map((it) => ({ n: it.n, of: it.of, label: it.label, amount: it.amount, dueAt: at(it.dueDays, 9) })),
            firstPaid || null
          )
        )
        toast(`Plan de cobro creado: ${items.length} pago${items.length > 1 ? 's' : ''}. Te avisaré antes de cada vencimiento.`, { tone: 'success' })
      },

      registerPayment(paymentId, { amount, method, date, ref }) {
        const p = dataRef.current.payments.find((x) => x.id === paymentId)
        if (!p || !(amount > 0)) return
        const deal = dataRef.current.deals.find((x) => x.id === p.dealId)
        const paidAt = date || new Date().toISOString()
        const full = amount >= p.amount - 0.009
        withUndo(
          full ? `Pago registrado: ${fmtMoney(p.amount, p.currency)} · ${method}` : `Abono parcial registrado: ${fmtMoney(amount, p.currency)}`,
          (d) =>
            addToTimeline(
              {
                ...d,
                payments: full
                  ? d.payments.map((x) => (x.id === paymentId ? { ...x, paidAt, method, ref } : x))
                  : [
                      ...d.payments.map((x) => (x.id === paymentId ? { ...x, amount: Math.round((x.amount - amount) * 100) / 100 } : x)),
                      { ...p, id: newId('p'), amount, label: `Abono · ${p.label}`, paidAt, method, ref },
                    ],
              },
              p.contactId,
              'pago',
              `${full ? 'Pagó' : 'Abonó'} ${fmtMoney(full ? p.amount : amount, p.currency)} (${p.label} · ${deal?.product}) por ${method}${ref ? `, op. ${ref}` : ''}.`
            ),
          'success',
          () => endpoints.registerPayment(paymentId, { amount, method, date: paidAt, ref: ref || '' })
        )
      },

      isSnoozed: (id) => (data.snoozed?.[id] || '') > new Date().toISOString(),
      snooze,

      addDeal(f) {
        const body = {
          product: f.product,
          amount: Number(f.amount) || 0,
          currency: f.currency,
          stage: f.stage || 'nuevo',
          temp: f.temp,
          nextDays: Number(f.nextDays) || 0,
          nextAction: f.nextAction || 'Primer contacto',
        }
        if (f.contactId) body.contactId = f.contactId
        else
          body.contact = {
            name: f.name, company: f.company || '', country: f.country, city: f.city || '—', phone: f.phone || '',
            doc: f.doc || '', channel: f.channel || null, temp: f.temp, note: f.note || undefined,
          }
        // El trato aparece cuando el servidor lo confirma (así ya tiene su ID definitivo)
        send(() => endpoints.addDeal(body)).then(
          ({ deal, contact }) => {
            setData((d) => ({
              ...d,
              contacts: contact ? [contact, ...d.contacts] : d.contacts,
              deals: [deal, ...d.deals],
            }))
            toast(`Trato agregado: ${f.product}`, { tone: 'success' })
          },
          () => {}
        )
      },

      setTemp(contactId, temp) {
        setData((d) => ({
          ...d,
          contacts: d.contacts.map((c) => (c.id === contactId ? { ...c, temp } : c)),
          deals: d.deals.map((x) => (x.contactId === contactId && x.stage !== 'cerrado' ? { ...x, temp } : x)),
        }))
        send(() => endpoints.setTemp(contactId, temp))
      },

      snoozeDeal(dealId, days) {
        setData((d) => ({ ...d, deals: d.deals.map((x) => (x.id === dealId ? { ...x, nextAt: at(days, 9) } : x)) }))
        send(() => endpoints.snoozeDeal(dealId, days))
        toast(days === 1 ? 'Seguimiento movido a mañana' : `Seguimiento en ${days} días`)
      },

      pauseDeal(dealId) {
        withUndo(
          'Trato pasado a “Por ahora no”',
          (d) => ({ ...d, deals: d.deals.map((x) => (x.id === dealId ? { ...x, stage: 'pausa' } : x)) }),
          undefined,
          () => endpoints.moveDeal(dealId, 'pausa')
        )
      },

      toggleTask(id) {
        const t = dataRef.current.tasks.find((x) => x.id === id)
        if (!t) return
        setData((d) => {
          const next = { ...d, tasks: d.tasks.map((x) => (x.id === id ? { ...x, done: !x.done } : x)) }
          // El servidor registra la actividad al completar la tarea; aquí se muestra al instante
          return !t.done && t.contactId ? addToTimeline(next, t.contactId, t.type, `Tarea completada: ${t.title}`) : next
        })
        send(() => endpoints.toggleTask(id))
        if (!t.done) toast('Tarea completada', { tone: 'success' })
      },
      addTask(task) {
        send(() => endpoints.addTask({ at: task.at, type: task.type, contactId: task.contactId || null, title: task.title })).then(
          (created) => {
            setData((d) => ({ ...d, tasks: [...d.tasks, created] }))
            toast('Tarea agregada a tu agenda')
          },
          () => {}
        )
      },

      dismissAlert(id, text = 'Alerta pospuesta hasta mañana') {
        withUndo(text, (d) => ({ ...d, alerts: d.alerts.filter((a) => a.id !== id) }), undefined, () => endpoints.dismissAlert(id))
      },
      /** Quita una alerta ya atendida (sin aviso ni "Deshacer") */
      removeAlert(id) {
        if (!id) return
        setData((d) => ({ ...d, alerts: d.alerts.filter((a) => a.id !== id) }))
        send(() => endpoints.dismissAlert(id))
      },

      catalogs,
      sellers: catalogs?.sellers ?? {},
      role: user?.role,
      canManage,
      sellerFilter,
      /** Gerente: ver toda la empresa ('ALL') o un vendedor; recarga los datos desde el servidor */
      setSellerFilter(v) {
        if (!canManage || v === filterRef.current) return
        filterRef.current = v
        sync.current.version++ // descarta relecturas en curso con el filtro anterior
        setSellerFilterState(v)
        load()
      },

      setGoal: (goalUSD) => {
        if (!canManage) return
        setData((d) => ({ ...d, goalUSD }))
        defer('goal', () => endpoints.setGoal(dataRef.current.goalUSD), DEBOUNCE_MS)
      },
      setPlan: (patch) => {
        if (!canManage) return
        setData((d) => ({ ...d, plan: { ...d.plan, ...patch } }))
        defer('plan', () => endpoints.setPlan(dataRef.current.plan), DEBOUNCE_MS)
      },
      setRates: (r) => {
        if (!canManage) return
        const ok = Object.fromEntries(Object.entries(r).filter(([, v]) => v > 0))
        setData((d) => ({ ...d, rates: { ...d.rates, ...ok } }))
        send(() => endpoints.setRates(ok))
        toast('Tipo de cambio actualizado')
      },
      saveStrategy(item) {
        if (!canManage) return
        const cur = dataRef.current.strategy
        const existing = cur.find((s) => s.id === item.id)
        const position = existing?.position ?? cur.reduce((m, s) => Math.max(m, s.position ?? 0), 0) + 1
        const card = { id: item.id, kind: item.kind, title: item.title, body: item.body, position }
        setData((d) => ({
          ...d,
          strategy: existing ? d.strategy.map((s) => (s.id === item.id ? card : s)) : [...d.strategy, card],
        }))
        send(() => endpoints.saveStrategy(card))
      },
      removeStrategy(id) {
        if (!canManage) return
        withUndo('Tarjeta eliminada', (d) => ({ ...d, strategy: d.strategy.filter((s) => s.id !== id) }), undefined, () =>
          endpoints.removeStrategy(id)
        )
      },
      newId,
      /** Vuelve a leer todo del servidor (p. ej. después de importar un Excel) */
      reload: load,
      reset() {
        const s = sync.current
        for (const item of s.pending.values()) clearTimeout(item.timer)
        s.pending.clear()
        send(() => endpoints.reset()).then(
          (state) => {
            setData(withoutCatalogs(state))
            setPrefs({ country: 'ALL', currency: 'USD' })
            toast('Datos de demostración restablecidos')
          },
          () => {}
        )
      },
    }
  }, [data, prefs, currency, rates, toast, toasts, drawer, modal, withUndo, send, defer, sellerId, catalogs, user, canManage, sellerFilter, load])

  if (!api) return <LoadScreen error={loadError} onRetry={load} />
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

function LoadScreen({ error, onRetry }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-[#F8FAFC] px-6 text-slate-900">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-indigo-600 text-lg font-bold text-white">V</div>
        {error ? (
          <>
            <h1 className="text-lg font-semibold">No se pudo cargar Vendex</h1>
            <p className="mt-2 text-sm text-slate-500">{error.message}</p>
            <p className="mt-3 text-sm text-slate-500">
              Revisa que el servidor esté encendido: en la carpeta <code className="rounded bg-slate-100 px-1">backend</code> ejecuta{' '}
              <code className="rounded bg-slate-100 px-1">npm run dev</code>.
            </p>
            <button onClick={onRetry} className="mt-5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
              Reintentar
            </button>
          </>
        ) : (
          <p className="text-sm text-slate-500">Cargando datos…</p>
        )}
      </div>
    </div>
  )
}

const STAGE_NAMES = { nuevo: 'Prospecto nuevo', contactado: 'Contactado', cotizacion: 'Cotización enviada', negociacion: 'En negociación', cerrado: 'Venta cerrada', pausa: 'Por ahora no' }
export const stageName = (s) => STAGE_NAMES[s] || s

// eslint-disable-next-line react-refresh/only-export-components
export const useApp = () => useContext(Ctx)

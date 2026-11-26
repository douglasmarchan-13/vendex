import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { COUNTRIES, seed } from './data/mock'
import { convert, fmtMoney, toUSD } from './lib/money'
import { at } from './lib/dates'

const KEY = 'vendex-demo-v3'
const UIKEY = 'vendex-ui-v1'
const Ctx = createContext(null)

function read(key, fallback) {
  try {
    const s = localStorage.getItem(key)
    return s ? JSON.parse(s) : fallback()
  } catch {
    return fallback()
  }
}
function write(key, v) {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* sin almacenamiento: la demo sigue funcionando en memoria */
  }
}

let uid = 0
const newId = (p) => `${p}${Date.now().toString(36)}${uid++}`

export function AppProvider({ children }) {
  const [data, setData] = useState(() => read(KEY, seed))
  const [prefs, setPrefs] = useState(() => read(UIKEY, () => ({ country: 'ALL', currency: 'USD' })))
  const [toasts, setToasts] = useState([])
  const [drawer, setDrawer] = useState(null) // contactId
  const [modal, setModal] = useState(null) // { type, ...props }
  const dataRef = useRef(data)
  useLayoutEffect(() => {
    dataRef.current = data
  }, [data])

  useEffect(() => write(KEY, data), [data])
  useEffect(() => write(UIKEY, prefs), [prefs])

  const toast = useCallback((text, opts = {}) => {
    const id = newId('toast')
    setToasts((t) => [...t.slice(-2), { id, text, ...opts }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts.undo ? 6000 : 3500)
  }, [])
  const closeToast = (id) => setToasts((t) => t.filter((x) => x.id !== id))

  /** Aplica un cambio y ofrece "Deshacer" */
  const withUndo = useCallback(
    (text, fn, tone) => {
      const prev = dataRef.current
      setData(fn)
      toast(text, { tone, undo: () => setData(prev) })
    },
    [toast]
  )

  const { rates } = data
  const currency = prefs.currency

  const api = useMemo(() => {
    const contactById = Object.fromEntries(data.contacts.map((c) => [c.id, c]))
    const inCountry = (countryCode) => prefs.country === 'ALL' || countryCode === prefs.country
    const lastContact = (c) => c.timeline.filter((t) => t.by !== 'sistema').reduce((m, t) => (t.at > m ? t.at : m), '1970-01-01')

    const logActivity = (contactId, type, text, by = 'andres') =>
      setData((d) => ({
        ...d,
        contacts: d.contacts.map((c) =>
          c.id === contactId ? { ...c, timeline: [{ id: newId('t'), at: new Date().toISOString(), type, text, by }, ...c.timeline] } : c
        ),
      }))

    return {
      data,
      setData,
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
          (d) => ({
            ...d,
            deals: d.deals.map((x) =>
              x.id === dealId ? { ...x, stage, closedAt: closing ? new Date().toISOString() : undefined } : x
            ),
            contacts: closing
              ? d.contacts.map((k) =>
                  k.id === deal.contactId
                    ? { ...k, timeline: [{ id: newId('t'), at: new Date().toISOString(), type: 'venta', text: `¡Compró! ${deal.product}.`, by: 'andres' }, ...k.timeline] }
                    : k
                )
              : d.contacts,
          }),
          closing ? 'success' : undefined
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
          (d) => ({
            ...d,
            payments: full
              ? d.payments.map((x) => (x.id === paymentId ? { ...x, paidAt, method, ref } : x))
              : [
                  ...d.payments.map((x) => (x.id === paymentId ? { ...x, amount: Math.round((x.amount - amount) * 100) / 100 } : x)),
                  { ...p, id: newId('p'), amount, label: `Abono · ${p.label}`, paidAt, method, ref },
                ],
            contacts: d.contacts.map((k) =>
              k.id === p.contactId
                ? { ...k, timeline: [{ id: newId('t'), at: new Date().toISOString(), type: 'pago', text: `${full ? 'Pagó' : 'Abonó'} ${fmtMoney(full ? p.amount : amount, p.currency)} (${p.label} · ${deal?.product}) por ${method}${ref ? `, op. ${ref}` : ''}.`, by: 'andres' }, ...k.timeline] }
                : k
            ),
          }),
          'success'
        )
      },

      isSnoozed: (id) => (data.snoozed?.[id] || '') > new Date().toISOString(),
      snooze(id, days = 1) {
        withUndo(days === 1 ? 'Aviso pospuesto hasta mañana' : `Aviso pospuesto ${days} días`, (d) => ({ ...d, snoozed: { ...d.snoozed, [id]: at(days, 0) } }))
      },

      addDeal(f) {
        let contactId = f.contactId
        setData((d) => {
          let contacts = d.contacts
          if (!contactId) {
            contactId = newId('c')
            contacts = [
              {
                id: contactId, name: f.name, company: f.company, country: f.country, city: f.city || '—', region: '',
                phone: f.phone, doc: f.doc, channel: f.channel, owner: 'andres', temp: f.temp,
                email: '',
                timeline: [{ id: newId('t'), at: new Date().toISOString(), type: 'nota', text: f.note || 'Prospecto registrado en Vendex.', by: 'andres' }],
              },
              ...contacts,
            ]
          }
          const deal = {
            id: newId('d'), contactId, product: f.product, amount: Number(f.amount) || 0, currency: f.currency,
            stage: f.stage || 'nuevo', temp: f.temp, nextAt: at(f.nextDays, 9), nextAction: f.nextAction || 'Primer contacto',
            createdAt: new Date().toISOString(),
          }
          return { ...d, contacts, deals: [deal, ...d.deals] }
        })
        toast(`Trato agregado: ${f.product}`, { tone: 'success' })
      },

      setTemp(contactId, temp) {
        setData((d) => ({
          ...d,
          contacts: d.contacts.map((c) => (c.id === contactId ? { ...c, temp } : c)),
          deals: d.deals.map((x) => (x.contactId === contactId && x.stage !== 'cerrado' ? { ...x, temp } : x)),
        }))
      },

      snoozeDeal(dealId, days) {
        setData((d) => ({ ...d, deals: d.deals.map((x) => (x.id === dealId ? { ...x, nextAt: at(days, 9) } : x)) }))
        toast(days === 1 ? 'Seguimiento movido a mañana' : `Seguimiento en ${days} días`)
      },

      pauseDeal(dealId) {
        withUndo('Trato pasado a “Por ahora no”', (d) => ({
          ...d,
          deals: d.deals.map((x) => (x.id === dealId ? { ...x, stage: 'pausa' } : x)),
        }))
      },

      toggleTask(id) {
        const t = dataRef.current.tasks.find((x) => x.id === id)
        setData((d) => ({ ...d, tasks: d.tasks.map((x) => (x.id === id ? { ...x, done: !x.done } : x)) }))
        if (t && !t.done) {
          logActivity(t.contactId, t.type === 'whatsapp' ? 'whatsapp' : t.type, `Tarea completada: ${t.title}`)
          toast('Tarea completada', { tone: 'success' })
        }
      },
      addTask(task) {
        setData((d) => ({ ...d, tasks: [...d.tasks, { id: newId('t'), done: false, ...task }] }))
        toast('Tarea agregada a tu agenda')
      },

      dismissAlert(id, text = 'Alerta pospuesta hasta mañana') {
        withUndo(text, (d) => ({ ...d, alerts: d.alerts.filter((a) => a.id !== id) }))
      },

      setGoal: (goalUSD) => setData((d) => ({ ...d, goalUSD })),
      setPlan: (patch) => setData((d) => ({ ...d, plan: { ...d.plan, ...patch } })),
      setRates: (r) => {
        const ok = Object.fromEntries(Object.entries(r).filter(([, v]) => v > 0))
        setData((d) => ({ ...d, rates: { ...d.rates, ...ok } }))
        toast('Tipo de cambio actualizado')
      },
      saveStrategy(item) {
        setData((d) => ({
          ...d,
          strategy: d.strategy.some((s) => s.id === item.id)
            ? d.strategy.map((s) => (s.id === item.id ? item : s))
            : [...d.strategy, item],
        }))
      },
      removeStrategy(id) {
        withUndo('Tarjeta eliminada', (d) => ({ ...d, strategy: d.strategy.filter((s) => s.id !== id) }))
      },
      newId,
      reset() {
        setData(seed())
        setPrefs({ country: 'ALL', currency: 'USD' })
        toast('Datos de demostración restablecidos')
      },
    }
  }, [data, prefs, currency, rates, toast, toasts, drawer, modal, withUndo])

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

const STAGE_NAMES = { nuevo: 'Prospecto nuevo', contactado: 'Contactado', cotizacion: 'Cotización enviada', negociacion: 'En negociación', cerrado: 'Venta cerrada', pausa: 'Por ahora no' }
export const stageName = (s) => STAGE_NAMES[s] || s

// eslint-disable-next-line react-refresh/only-export-components
export const useApp = () => useContext(Ctx)

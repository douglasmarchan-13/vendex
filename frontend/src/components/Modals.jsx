import { useEffect, useRef, useState } from 'react'
import {
  MessageCircle, Phone, ThumbsUp, Clock, PhoneMissed, PauseCircle, Check,
  Copy, CheckCheck, Pencil, Plus, RotateCcw, Trash2, CalendarDays,
} from 'lucide-react'
import { endpoints } from '../lib/api'
import { VARS, isDefaultKey, mergeTemplates, renderTemplate, waLink, waPhone } from '../lib/whatsapp'
import { useApp } from '../store'
import { useAuth } from '../auth/AuthContext'
import { CHANNELS, COUNTRIES, STAGES } from '../data/mock'
import { at, diffDays, fmtDate, fmtTime, rel } from '../lib/dates'
import { PayModal, PlanModal } from './CobranzaModals'
import { CURRENCIES, convert, fmtMoney } from '../lib/money'
import { Avatar, Button, Field, Flag, Modal, TEMPS, cx, inputCls } from './ui'
import { mainDeal } from '../views/Clients'
import ImportModal from './ImportModal'
import DebtImportModal from './DebtImportModal'

export default function Modals() {
  const { modal, closeModal } = useApp()
  if (!modal) return null
  const P = { deal: DealModal, contact: ContactModal, wa: WhatsAppModal, call: CallModal, split: SplitModal, import: ImportModal, importDebts: DebtImportModal, rates: RatesModal, pay: PayModal, plan: PlanModal }[modal.type]
  return P ? <P {...modal} onClose={closeModal} /> : null
}

function useResolveAlert() {
  const { removeAlert } = useApp()
  return (alertId) => alertId && removeAlert(alertId)
}

/* ================= Nuevo trato ================= */
const NEXT = [['Hoy', 0], ['Mañana', 1], ['En 3 días', 3], ['Próx. semana', 7]]
/** Para "Hoy": si la hora elegida ya pasó, propone la próxima hora en punto */
const laterToday = (time) => {
  const [h, m] = (time || '09:00').split(':').map(Number)
  const now = new Date()
  if (h * 60 + m > now.getHours() * 60 + now.getMinutes()) return time
  return `${String(Math.min(23, now.getHours() + 1)).padStart(2, '0')}:00`
}
const TASK_TYPES = [['llamada', 'Llamada'], ['whatsapp', 'WhatsApp'], ['visita', 'Visita de campo'], ['reunion', 'Reunión']]
/** Igual que en el servidor: sin mayúsculas ni espacios sobrantes (las tildes cuentan) */
const nameKey = (s) => (s || '').trim().replace(/\s+/g, ' ').toLocaleUpperCase('es')
/** Igual que en el servidor: el documento oficial solo con letras y números ("J-1234.567-8" = "j12345678") */
const docKey = (s) => (s || '').toUpperCase().replace(/[^0-9A-Z]/g, '')

/**
 * Validación de cliente al guardar:
 * - mismo nombre → advertencia; el usuario confirma y se guarda igual;
 * - mismo documento oficial en el país (DNI, RUC, cédula…) → no se puede guardar.
 * Con los datos en pantalla se avisa al escribir; al guardar se consulta al servidor (ve también los clientes de otros vendedores).
 */
function useContactCheck(contacts, { name, country, doc, exceptId, checkName = true, checkDoc = true }) {
  const { sellers } = useApp()
  const { user } = useAuth()
  const [state, setState] = useState({ checking: false, docTaken: null, sameName: null })
  const localName = checkName && nameKey(name) ? contacts.find((x) => x.id !== exceptId && nameKey(x.name) === nameKey(name)) : null
  const localDoc = checkDoc && docKey(doc) ? contacts.find((x) => x.id !== exceptId && x.country === country && docKey(x.doc) === docKey(doc)) : null
  // Al cambiar lo escrito, se olvida lo que respondió el servidor
  useEffect(() => setState((s) => (s.docTaken || s.sameName ? { checking: false, docTaken: null, sameName: null } : s)), [name, country, doc])

  /** Un contacto de los datos en pantalla, con la misma forma que responde el servidor */
  const asHit = (x) => ({ name: x.name, doc: x.doc, mine: x.owner === user?.sellerId, seller: sellers?.[x.owner]?.name ?? null })
  const docHit = state.docTaken ?? (localDoc ? asHit(localDoc) : null)
  const docError = docHit ? `Este documento ya está registrado para ${whose(docHit)} "${docHit.name}".` : ''

  /** Devuelve 'ok' | 'doc' (bloquea) | 'name' (pedir confirmación) */
  const run = async () => {
    setState((s) => ({ ...s, checking: true }))
    try {
      const r = await endpoints.checkContact({
        name: checkName ? name.trim() || undefined : undefined,
        country: checkDoc && docKey(doc) ? country : undefined,
        doc: checkDoc && docKey(doc) ? doc.trim() : undefined,
        exceptId,
      })
      setState({ checking: false, docTaken: r.docTaken, sameName: r.sameName?.length ? r.sameName : null })
      if (r.docTaken) return 'doc'
      return r.sameName?.length ? 'name' : 'ok'
    } catch {
      // Sin respuesta: se sigue con lo que se sabe en pantalla; el servidor igual rechaza un documento repetido
      setState((s) => ({ ...s, checking: false }))
      return localDoc ? 'doc' : localName ? 'name' : 'ok'
    }
  }

  const sameNames = state.sameName ?? (localName ? [asHit(localName)] : [])
  return { checking: state.checking, localName, localNameHit: localName ? asHit(localName) : null, docError, sameNames, run }
}

/** "tu cliente" / "el cliente de Andrés Ruiz" */
const whose = (hit) => (hit.mine ? 'tu cliente' : hit.seller ? `el cliente de ${hit.seller}` : 'el cliente de otro vendedor')

/** Aviso al confirmar un nombre repetido: dice qué vendedor(es) lo tienen */
const sameNameText = (list) => {
  const owners = [...new Set(list.map((x) => (x.mine ? 'ti' : x.seller || 'otro vendedor')))]
  const who = owners.length > 1 ? `${owners.slice(0, -1).join(', ')} y ${owners.at(-1)}` : owners[0]
  const what = list.length === 1 ? 'un cliente' : `${list.length} clientes`
  return `Ya existe ${what} con el nombre "${list[0].name}" registrado por ${who}. ¿Quieres continuar de todos modos?`
}

function DealModal({ onClose, contactId }) {
  const { data, addDeal, contactById, country: activeCountry, inCountry, catalogs } = useApp()
  const PRODUCTS = catalogs?.products ?? []
  const fixed = contactId && contactById[contactId]
  const startCountry = fixed?.country || (activeCountry === 'ALL' ? 'PE' : activeCountry)
  const [mode, setMode] = useState(fixed ? 'existente' : 'nuevo')
  const [f, setF] = useState({
    contactId: contactId || '', name: '', company: '', country: startCountry, city: '', phone: '', doc: '',
    product: '', amount: '', currency: COUNTRIES[startCountry].display, temp: 'tibio', channel: 'WhatsApp',
    stage: 'nuevo', nextDays: 1, nextDate: '', nextTime: '09:00', nextAction: '', note: '',
    makeTask: true, taskType: 'llamada',
  })
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? e.target.value : e }))

  const pickProduct = (name) => {
    const p = PRODUCTS.find((x) => x.name === name)
    setF((x) => ({ ...x, product: name, amount: p ? String(Math.round(convert(p.price, 'USD', x.currency, data.rates))) : x.amount }))
  }
  const pickCountry = (c) => setF((x) => ({ ...x, country: c, currency: COUNTRIES[c].display }))
  const existing = data.contacts.filter((c) => inCountry(c.country))
  const isNew = mode === 'nuevo'
  const check = useContactCheck(data.contacts, { name: f.name, country: f.country, doc: f.doc, checkName: isNew, checkDoc: isNew })
  const duplicate = check.localName
  const [confirmDup, setConfirmDup] = useState(false)
  useEffect(() => setConfirmDup(false), [f.name, f.doc, f.country, mode])
  // Próximo contacto: un atajo (hoy, mañana…) o una fecha elegida, siempre con hora
  const custom = f.nextDays === 'custom'
  const [hh, mm] = (f.nextTime || '09:00').split(':').map(Number)
  const nextAt = custom ? (f.nextDate ? new Date(`${f.nextDate}T${f.nextTime || '09:00'}`).toISOString() : '') : at(f.nextDays, hh, mm)
  const pastNext = nextAt && new Date(nextAt) < new Date(Date.now() - 60000)
  const valid = f.product.trim() && (isNew ? f.name.trim() && !check.docError : f.contactId) && nextAt && !pastNext

  const save = () => {
    const c = mode === 'existente' ? contactById[f.contactId] : null
    addDeal({ ...f, contactId: mode === 'existente' ? f.contactId : '', country: c?.country || f.country, nextAt, task: f.makeTask ? f.taskType : null })
    onClose()
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!valid || check.checking) return
    // Se pide aquí, mientras dura el clic del usuario
    if (f.makeTask && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {})
    if (isNew) {
      const r = await check.run()
      if (r === 'doc') return
      if (r === 'name') return setConfirmDup(true)
    }
    save()
  }

  const footer = confirmDup ? (
    <>
      <p className="mr-auto self-center text-sm text-amber-800">{sameNameText(check.sameNames)}</p>
      <Button variant="ghost" onClick={() => setConfirmDup(false)}>No, volver</Button>
      <Button variant="primary" onClick={save}>Sí, continuar</Button>
    </>
  ) : (
    <>
      <Button variant="ghost" onClick={onClose}>Cancelar</Button>
      <Button variant="primary" type="submit" form="deal-form" disabled={!valid || check.checking}>{check.checking ? 'Revisando…' : 'Agregar al embudo'}</Button>
    </>
  )

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title="Nuevo trato"
      subtitle="Registra una oportunidad en menos de 30 segundos"
      footer={footer}
    >
      <form id="deal-form" onSubmit={submit} className="space-y-5">
        {fixed ? (
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <Avatar name={fixed.name} />
            <div><p className="font-medium text-slate-900">{fixed.name}</p><p className="text-xs text-slate-500">{fixed.company || fixed.city}</p></div>
          </div>
        ) : (
          <>
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
              {[['nuevo', 'Cliente nuevo'], ['existente', 'Cliente existente']].map(([k, l]) => (
                <button type="button" key={k} onClick={() => setMode(k)} className={cx('h-9 flex-1 rounded-lg text-sm font-medium', mode === k ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500')}>{l}</button>
              ))}
            </div>
            {mode === 'existente' ? (
              <Field label="Cliente">
                <select className={inputCls} value={f.contactId} onChange={set('contactId')} required>
                  <option value="">Elegir…</option>
                  {existing.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company ? ` · ${c.company}` : ''} ({COUNTRIES[c.country].name})</option>)}
                </select>
              </Field>
            ) : (
              <div className="space-y-4">
                <div>
                  <span className="mb-1.5 block text-[13px] font-medium text-slate-700">País</span>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.values(COUNTRIES).map((c) => (
                      <button type="button" key={c.code} onClick={() => pickCountry(c.code)} className={cx('flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-medium ring-1 ring-inset', f.country === c.code ? 'bg-indigo-50 text-indigo-700 ring-indigo-300' : 'text-slate-600 ring-slate-200')}>
                        <Flag code={c.code} /> {c.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nombre del cliente *">
                    <input className={cx(inputCls, duplicate && 'border-amber-400 focus:border-amber-500 focus:ring-amber-200')} value={f.name} onChange={set('name')} placeholder="Ej. Juan Pérez Flores" required />
                    {duplicate && (
                      <span className="mt-1 block text-xs text-amber-700">
                        Ya existe {whose(check.localNameHit)} con ese nombre ({duplicate.name}). Puedes continuar si es otra persona.{' '}
                        {inCountry(duplicate.country) && <button type="button" className="font-medium underline" onClick={() => { setMode('existente'); setF((x) => ({ ...x, contactId: duplicate.id })) }}>
                          Usar el existente
                        </button>}
                      </span>
                    )}
                  </Field>
                  <Field label="Empresa"><input className={inputCls} value={f.company} onChange={set('company')} placeholder="Opcional" /></Field>
                  <Field label="Teléfono">
                    <div className="flex">
                      <span className="grid place-items-center rounded-l-lg border border-r-0 border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">{COUNTRIES[f.country].prefix}</span>
                      <input className={cx(inputCls, 'rounded-l-none')} inputMode="tel" value={f.phone} onChange={set('phone')} placeholder="999 999 999" />
                    </div>
                  </Field>
                  <Field label={COUNTRIES[f.country].doc}>
                    <input className={cx(inputCls, check.docError && 'border-rose-400 focus:border-rose-500 focus:ring-rose-200')} value={f.doc} onChange={set('doc')} placeholder="Opcional" aria-invalid={!!check.docError} />
                    {check.docError && <span className="mt-1 block text-xs text-rose-600">{check.docError}</span>}
                  </Field>
                  <Field label="Ciudad / localidad"><input className={inputCls} value={f.city} onChange={set('city')} placeholder="Ej. Chiclayo" /></Field>
                  <Field label="¿Cómo llegó?">
                    <select className={inputCls} value={f.channel} onChange={set('channel')}>{CHANNELS.map((c) => <option key={c}>{c}</option>)}</select>
                  </Field>
                </div>
              </div>
            )}
          </>
        )}

        <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
          <Field label="Producto / máquina *" hint="Elige del catálogo y el precio se completa solo">
            <input className={inputCls} list="vx-products" value={f.product} onChange={(e) => pickProduct(e.target.value)} placeholder="Ej. Secadora de maíz 18 TN" required />
            <datalist id="vx-products">{PRODUCTS.map((p) => <option key={p.name} value={p.name} />)}</datalist>
          </Field>
          <Field label="Monto">
            <div className="flex">
              <select className="h-11 rounded-l-lg border border-r-0 border-slate-200 bg-slate-50 px-2 text-sm font-medium text-slate-700" value={f.currency} onChange={(e) => {
                const cur = e.target.value
                setF((x) => ({ ...x, currency: cur, amount: x.amount ? String(Math.round(convert(Number(x.amount), x.currency, cur, data.rates))) : '' }))
              }} aria-label="Moneda">
                {Object.values(CURRENCIES).map((c) => <option key={c.code} value={c.code}>{c.symbol}</option>)}
              </select>
              <input className={cx(inputCls, 'rounded-l-none tabular-nums')} inputMode="decimal" value={f.amount} onChange={set('amount')} placeholder="0" />
            </div>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-slate-700">Temperatura</span>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(TEMPS).map(([k, t]) => (
                <button type="button" key={k} onClick={() => set('temp')(k)} className={cx('flex h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-medium ring-1 ring-inset', f.temp === k ? t.cls : 'text-slate-500 ring-slate-200')}>
                  <t.icon size={14} /> {t.label}
                </button>
              ))}
            </div>
          </div>
          <Field label="Etapa">
            <select className={inputCls} value={f.stage} onChange={set('stage')}>{STAGES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          </Field>
        </div>

        <div className="rounded-xl bg-slate-50 p-3">
          <span className="mb-1.5 block text-[13px] font-medium text-slate-700">Próximo contacto con el cliente</span>
          <div className="flex flex-wrap gap-2">
            {[...NEXT, ['Otra fecha', 'custom']].map(([l, n]) => (
              <button type="button" key={n} onClick={() => setF((x) => ({ ...x, nextDays: n, nextTime: n === 0 ? laterToday(x.nextTime) : x.nextTime }))} className={cx('h-9 rounded-full px-3.5 text-sm font-medium ring-1 ring-inset', f.nextDays === n ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-600 ring-slate-200')}>
                {n === 'custom' && <CalendarDays size={14} className="-mt-0.5 mr-1 inline" />}{l}
              </button>
            ))}
          </div>
          <div className={cx('mt-3 grid gap-3', custom ? 'grid-cols-2 sm:grid-cols-[1fr_120px_1fr]' : 'grid-cols-[120px_1fr]')}>
            {custom && (
              <Field label="Fecha">
                <input type="date" className={inputCls} min={new Date().toLocaleDateString('en-CA')} value={f.nextDate} onChange={set('nextDate')} required />
              </Field>
            )}
            <Field label="Hora"><input type="time" className={inputCls} value={f.nextTime} onChange={set('nextTime')} required /></Field>
            <Field label="¿Cómo lo contactarás?">
              <select className={inputCls} value={f.taskType} onChange={set('taskType')}>
                {TASK_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
          </div>
          <input className={cx(inputCls, 'mt-3')} value={f.nextAction} onChange={set('nextAction')} placeholder="¿Qué harás? Ej. Enviar video de la máquina" />
          {pastNext && <p className="mt-1 text-xs text-rose-600">Esa fecha y hora ya pasó.</p>}
          {nextAt && !pastNext && (
            <p className="mt-2 text-xs text-slate-500">
              {rel(nextAt)}, {fmtDate(nextAt)} a las {fmtTime(nextAt)}
            </p>
          )}
          <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-indigo-600" checked={f.makeTask} onChange={(e) => setF((x) => ({ ...x, makeTask: e.target.checked }))} />
            <span>
              Crear la tarea en mi agenda y avisarme
              <span className="block text-xs text-slate-500">Aparece en “Hoy” y en la campana el día anterior, y te llega un aviso 15 minutos antes y a la hora.</span>
            </span>
          </label>
        </div>
      </form>
    </Modal>
  )
}

/* ================= Editar / eliminar cliente ================= */
const CONTACT_FIELDS = ['name', 'company', 'country', 'city', 'region', 'phone', 'doc', 'email', 'channel']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function ContactModal({ onClose, contactId }) {
  const { data, contactById, updateContact, removeContact } = useApp()
  const c = contactById[contactId]
  const [f, setF] = useState(() => Object.fromEntries(CONTACT_FIELDS.map((k) => [k, c?.[k] ?? ''])))
  const [confirming, setConfirming] = useState(false)
  const [confirmDup, setConfirmDup] = useState(false)
  // Solo se revisa lo que cambió: el nombre, o el documento / país
  const check = useContactCheck(data.contacts, {
    name: f.name, country: f.country, doc: f.doc, exceptId: contactId,
    checkName: nameKey(f.name) !== nameKey(c?.name),
    checkDoc: docKey(f.doc) !== docKey(c?.doc) || f.country !== c?.country,
  })
  useEffect(() => setConfirmDup(false), [f.name, f.doc, f.country])
  if (!c) return null
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  const duplicate = check.localName
  const badEmail = f.email.trim() !== '' && !EMAIL_RE.test(f.email.trim())
  const valid = f.name.trim() && !check.docError && !badEmail
  const channels = c.channel && !CHANNELS.includes(c.channel) ? [c.channel, ...CHANNELS] : CHANNELS

  // Se borra solo si no hay ventas ni cobros: borrar arrastraría tratos, cuotas e historial
  const deals = data.deals.filter((d) => d.contactId === c.id)
  const pays = data.payments.filter((p) => p.contactId === c.id)
  const blocked = pays.length > 0 || deals.some((d) => d.stage === 'cerrado')

  const commit = () => {
    const patch = {}
    for (const k of CONTACT_FIELDS) {
      const v = k === 'channel' ? f[k] || null : String(f[k]).trim()
      if (v !== (c[k] ?? (k === 'channel' ? null : ''))) patch[k] = v
    }
    updateContact(c.id, patch)
    onClose()
  }

  const save = async (e) => {
    e.preventDefault()
    if (!valid || check.checking) return
    const r = await check.run()
    if (r === 'doc') return
    if (r === 'name') return setConfirmDup(true)
    commit()
  }

  const footer = confirmDup ? (
    <>
      <p className="mr-auto self-center text-sm text-amber-800">{sameNameText(check.sameNames)}</p>
      <Button variant="ghost" onClick={() => setConfirmDup(false)}>No, volver</Button>
      <Button variant="primary" onClick={commit}>Sí, continuar</Button>
    </>
  ) : confirming ? (
    <>
      <p className="mr-auto self-center text-sm text-rose-700">¿Eliminar a {c.name}{deals.length ? ` y ${deals.length} trato${deals.length > 1 ? 's' : ''}` : ''}?</p>
      <Button variant="ghost" onClick={() => setConfirming(false)}>No, volver</Button>
      <Button variant="danger" onClick={() => { removeContact(c.id); onClose() }}><Trash2 size={15} /> Sí, eliminar</Button>
    </>
  ) : (
    <>
      <Button variant="ghost" className="mr-auto text-rose-600 hover:bg-rose-50" disabled={blocked} title={blocked ? 'Tiene ventas o cobros registrados' : undefined} onClick={() => setConfirming(true)}>
        <Trash2 size={15} /> Eliminar cliente
      </Button>
      <Button variant="ghost" onClick={onClose}>Cancelar</Button>
      <Button variant="primary" type="submit" form="contact-form" disabled={!valid || check.checking}>{check.checking ? 'Revisando…' : 'Guardar cambios'}</Button>
    </>
  )

  return (
    <Modal open onClose={onClose} wide title="Editar cliente" subtitle={c.company || c.name} footer={footer}>
      <form id="contact-form" onSubmit={save} className="space-y-4">
        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-slate-700">País</span>
          <div className="grid grid-cols-3 gap-2">
            {Object.values(COUNTRIES).map((k) => (
              <button type="button" key={k.code} onClick={() => setF((x) => ({ ...x, country: k.code }))} className={cx('flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-medium ring-1 ring-inset', f.country === k.code ? 'bg-indigo-50 text-indigo-700 ring-indigo-300' : 'text-slate-600 ring-slate-200')}>
                <Flag code={k.code} /> {k.name}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre del cliente *">
            <input className={cx(inputCls, duplicate && 'border-amber-400 focus:border-amber-500 focus:ring-amber-200')} value={f.name} onChange={set('name')} required />
            {duplicate && <span className="mt-1 block text-xs text-amber-700">Ya existe {whose(check.localNameHit)} con ese nombre ({duplicate.name}). Puedes continuar si es otra persona.</span>}
          </Field>
          <Field label="Empresa"><input className={inputCls} value={f.company} onChange={set('company')} placeholder="Opcional" /></Field>
          <Field label="Teléfono">
            <div className="flex">
              <span className="grid place-items-center rounded-l-lg border border-r-0 border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">{COUNTRIES[f.country].prefix}</span>
              <input className={cx(inputCls, 'rounded-l-none')} inputMode="tel" value={f.phone} onChange={set('phone')} placeholder="999 999 999" />
            </div>
          </Field>
          <Field label={COUNTRIES[f.country].doc}>
            <input className={cx(inputCls, check.docError && 'border-rose-400 focus:border-rose-500 focus:ring-rose-200')} value={f.doc} onChange={set('doc')} placeholder="Opcional" aria-invalid={!!check.docError} />
            {check.docError && <span className="mt-1 block text-xs text-rose-600">{check.docError}</span>}
          </Field>
          <Field label="Correo">
            <input className={cx(inputCls, badEmail && 'border-rose-400')} type="email" value={f.email} onChange={set('email')} placeholder="Opcional" aria-invalid={badEmail} />
            {badEmail && <span className="mt-1 block text-xs text-rose-600">Revisa el correo.</span>}
          </Field>
          <Field label="¿Cómo llegó?">
            <select className={inputCls} value={f.channel || ''} onChange={set('channel')}>
              <option value="">—</option>
              {channels.map((x) => <option key={x}>{x}</option>)}
            </select>
          </Field>
          <Field label="Ciudad / localidad"><input className={inputCls} value={f.city} onChange={set('city')} /></Field>
          <Field label="Región / departamento"><input className={inputCls} value={f.region} onChange={set('region')} placeholder="Opcional" /></Field>
        </div>
        {blocked && (
          <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
            Este cliente tiene ventas o cobros registrados, así que no se puede eliminar (se perderían sus cuotas y pagos). Si ya no te interesa, pasa sus tratos abiertos a “Por ahora no”.
          </p>
        )}
      </form>
    </Modal>
  )
}

/* ================= WhatsApp ================= */
// Plantillas del vendedor: se piden una vez por sesión de la página y se reutilizan entre aperturas del modal
let templatesCache = null
function useMyTemplates(onLoad) {
  const [list, setList] = useState(templatesCache)
  useEffect(() => {
    if (templatesCache) return
    let alive = true
    endpoints.listTemplates()
      .then((r) => { templatesCache = r || []; if (alive) { setList(templatesCache); onLoad?.(templatesCache) } })
      .catch(() => { if (alive) setList([]) }) // sin backend: quedan las plantillas por defecto
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const update = (next) => { templatesCache = next; setList(next) }
  return [list, update]
}

function WhatsAppModal({ onClose, contactId, alertId, paymentId, template = 'seguimiento' }) {
  const { contactById, data, money, original, logActivity, toast, snooze } = useApp()
  const resolve = useResolveAlert()
  const c = contactById[contactId]
  const pay = paymentId && data.payments.find((p) => p.id === paymentId)
  const d = pay ? data.deals.find((x) => x.id === pay.dealId) : mainDeal(data.deals, c.id)
  const kind = pay ? 'cobranza' : 'venta'
  // Firma con el usuario de la sesión y su empresa ("Douglas de Agro Andina")
  const { user } = useAuth()
  const me = user?.name?.trim().split(' ')[0] || 'su asesor'
  const late = pay ? -diffDays(pay.dueAt) : 0
  const vars = {
    nombre: c.name.split(' ')[0],
    asesor: me,
    empresa: user?.companyName || '',
    firma: user?.companyName ? `${me} de ${user.companyName}` : me,
    producto: d?.product || (pay ? 'equipo' : 'la máquina'),
    precio: d ? (c.country === 'VE' ? original(d.amount, d.currency) : money(d.amount, d.currency)) : '',
    monto: pay ? fmtMoney(pay.amount, pay.currency) : '',
    cuota: pay ? pay.label.toLowerCase() : '',
    vencimiento: !pay ? '' : late > 0 ? `venció el ${fmtDate(pay.dueAt)}` : late === 0 ? 'vence hoy' : `vence el ${fmtDate(pay.dueAt)}`,
  }
  const phone = waPhone(c.phone, c.country)

  const start = pay ? (template === 'firme' || late > 0 ? 'firme' : 'cobro') : template
  const [k, setK] = useState(start)
  const [text, setText] = useState(() => {
    const T0 = mergeTemplates(templatesCache || [], kind)
    return renderTemplate((T0.find((t) => t.key === start) || T0[0]).body, vars)
  })
  const [editing, setEditing] = useState(null) // { key, label, body, isNew }
  const [saving, setSaving] = useState(false)
  // true en cuanto el vendedor toca el mensaje o elige otra plantilla
  const touched = useRef(false)
  // Al llegar las plantillas del vendedor, si aún no tocó nada se muestra su versión
  const [custom, setCustom] = useMyTemplates((list) => {
    if (touched.current) return
    const t = mergeTemplates(list, kind).find((x) => x.key === start)
    if (t) setText(renderTemplate(t.body, vars))
  })
  const T = mergeTemplates(custom || [], kind)
  const current = T.find((t) => t.key === k) || T[0]

  const pick = (t) => { setK(t.key); touched.current = true; setText(renderTemplate(t.body, vars)); setEditing(null) }

  const send = () => {
    if (!phone) return
    // Se abre en el mismo clic para que el navegador no lo bloquee como ventana emergente
    window.open(waLink(phone, text), '_blank', 'noopener')
    logActivity(c.id, 'whatsapp', `WhatsApp ${pay ? 'de cobranza ' : ''}enviado: “${text.length > 110 ? text.slice(0, 110) + '…' : text}”`)
    resolve(alertId)
    if (pay) snooze(`cobro-${pay.id}`, 1, { silent: true })
    toast(`Abriendo WhatsApp con ${vars.nombre}`, { tone: 'success' })
    onClose()
  }

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); toast('Mensaje copiado') } catch { toast('No se pudo copiar') }
  }

  const saveTemplate = async () => {
    const t = { key: editing.key, kind, label: editing.label.trim(), body: editing.body.trim() }
    if (!t.label || !t.body) return
    setSaving(true)
    try {
      const saved = await endpoints.saveTemplate(t.key, t)
      setCustom([...(custom || []).filter((x) => x.key !== t.key), saved || t])
      touched.current = true; setK(t.key); setText(renderTemplate(t.body, vars)); setEditing(null)
      toast('Plantilla guardada. La usarás en tus próximos mensajes', { tone: 'success' })
    } catch (e) {
      toast(`No se pudo guardar la plantilla: ${e.message}`)
    } finally { setSaving(false) }
  }

  // Plantilla propia → se elimina. Plantilla por defecto editada → vuelve al texto original.
  const removeTemplate = async () => {
    const key = editing.key
    setSaving(true)
    try {
      await endpoints.removeTemplate(key)
      const next = (custom || []).filter((x) => x.key !== key)
      setCustom(next)
      const fallback = mergeTemplates(next, kind).find((t) => t.key === key) || mergeTemplates(next, kind)[0]
      pick(fallback)
      toast(isDefaultKey(key) ? 'Plantilla restaurada al texto original' : 'Plantilla eliminada')
    } catch (e) {
      toast(`No se pudo completar: ${e.message}`)
    } finally { setSaving(false) }
  }

  const insertVar = (v) => {
    const el = document.getElementById('wa-template-body')
    const token = `{${v}}`
    const s = el?.selectionStart ?? editing.body.length
    const e = el?.selectionEnd ?? s
    setEditing((x) => ({ ...x, body: x.body.slice(0, s) + token + x.body.slice(e) }))
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(s + token.length, s + token.length) })
  }

  const footer = editing ? (
    <>
      {!editing.isNew && (editing.own || editing.edited) && (
        <Button variant="ghost" className="mr-auto text-rose-600" disabled={saving} onClick={removeTemplate}>
          {editing.own ? <><Trash2 size={15} /> Eliminar</> : <><RotateCcw size={15} /> Restaurar original</>}
        </Button>
      )}
      <Button variant="ghost" onClick={() => setEditing(null)}>Volver</Button>
      <Button variant="primary" disabled={saving || !editing.label.trim() || !editing.body.trim()} onClick={saveTemplate}>Guardar plantilla</Button>
    </>
  ) : (
    <>
      <Button variant="ghost" onClick={onClose}>Cancelar</Button>
      <Button variant="secondary" onClick={copy}><Copy size={15} /> Copiar</Button>
      <Button className="bg-[#25D366] text-white hover:bg-[#1fb757]" disabled={!phone || !text.trim()} onClick={send}><MessageCircle size={16} /> Abrir en WhatsApp</Button>
    </>
  )

  return (
    <Modal
      open
      onClose={onClose}
      title={<span className="flex items-center gap-2"><MessageCircle size={18} className="text-[#25D366]" /> WhatsApp a {c.name}</span>}
      subtitle={<span className="flex items-center gap-1.5"><Flag code={c.country} /> {c.phone || 'Sin teléfono'}</span>}
      footer={footer}
    >
      <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
        {T.map((t) => (
          <button key={t.key} onClick={() => pick(t)} className={cx('h-8 shrink-0 rounded-full px-3 text-[13px] font-medium ring-1 ring-inset', !editing?.isNew && k === t.key ? 'bg-[#25D366]/15 text-[#128C4A] ring-[#25D366]/40' : 'text-slate-600 ring-slate-200')}>
            {t.label}{(t.own || t.edited) && <span className="ml-1 text-[10px] text-slate-400">•</span>}
          </button>
        ))}
        <button
          onClick={() => { touched.current = true; setEditing({ key: `custom-${Date.now().toString(36)}`, label: '', body: current.body, isNew: true }) }}
          className={cx('flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-[13px] font-medium border border-dashed', editing?.isNew ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-300 text-slate-500')}
        >
          <Plus size={13} /> Nueva
        </button>
      </div>

      {editing ? (
        <div className="space-y-3">
          <Field label="Nombre de la plantilla">
            <input className={inputCls} value={editing.label} maxLength={60} onChange={(e) => setEditing((x) => ({ ...x, label: e.target.value }))} placeholder="Ej. Saludo de campaña" autoFocus={editing.isNew} />
          </Field>
          <Field label="Mensaje" hint="Toca una variable para insertarla; se completa sola con los datos de cada cliente">
            <textarea id="wa-template-body" className={cx(inputCls, 'h-auto py-2 leading-relaxed')} rows={5} maxLength={2000} value={editing.body} onChange={(e) => setEditing((x) => ({ ...x, body: e.target.value }))} />
          </Field>
          <div className="flex flex-wrap gap-1.5">
            {VARS.filter((v) => !v.kind || v.kind === kind).map((v) => (
              <button key={v.key} type="button" title={v.label} onClick={() => insertVar(v.key)} className="h-7 rounded-md bg-slate-100 px-2 font-mono text-[12px] text-slate-600 hover:bg-slate-200">{`{${v.key}}`}</button>
            ))}
          </div>
          <div className="rounded-xl bg-[#EFEAE2] p-3">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">Vista previa con {c.name.split(' ')[0]}</p>
            <div className="ml-auto max-w-[92%] whitespace-pre-wrap rounded-xl rounded-tr-sm bg-[#D9FDD3] px-3 py-2 text-sm leading-relaxed text-slate-800 shadow-sm">{renderTemplate(editing.body, vars) || '…'}</div>
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-xl bg-[#EFEAE2] p-3">
            <div className="ml-auto max-w-[92%] rounded-xl rounded-tr-sm bg-[#D9FDD3] p-1 shadow-sm">
              <textarea value={text} onChange={(e) => { touched.current = true; setText(e.target.value) }} rows={5} className="w-full resize-none bg-transparent px-2 py-1 text-base leading-relaxed text-slate-800 outline-none sm:text-sm" aria-label="Mensaje" />
              <div className="flex items-center justify-end gap-1 px-2 pb-1 text-[11px] text-slate-500">ahora <CheckCheck size={14} className="text-sky-500" /></div>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-500">
              {phone ? 'Se abrirá WhatsApp con este mensaje listo; solo presiona enviar. Queda en el historial del cliente.' : 'Este cliente no tiene teléfono registrado. Puedes copiar el mensaje.'}
            </p>
            <button onClick={() => { touched.current = true; setEditing({ ...current, isNew: false }) }} className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline">
              <Pencil size={12} /> Editar plantilla «{current.label}»
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}

/* ================= Llamada ================= */
function CallModal({ onClose, contactId, alertId }) {
  const { contactById, data, logActivity, snoozeDeal, pauseDeal, openModal, setTemp, toast } = useApp()
  const resolve = useResolveAlert()
  const c = contactById[contactId]
  const d = mainDeal(data.deals, c.id)
  const [note, setNote] = useState('')
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setSecs((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [])
  const n = note.trim() ? ` ${note.trim()}` : ''
  const done = (fn) => { fn(); resolve(alertId) }

  const outcomes = [
    { icon: ThumbsUp, label: 'Contestó: interesado', cls: 'text-emerald-700 bg-emerald-50 ring-emerald-200', run: () => done(() => { logActivity(c.id, 'llamada', `Contestó: interesado.${n}`); setTemp(c.id, 'caliente'); toast('Llamada registrada · cliente marcado como caliente', { tone: 'success' }); onClose() }) },
    { icon: Clock, label: 'Pidió que lo llame luego', cls: 'text-indigo-700 bg-indigo-50 ring-indigo-200', run: () => done(() => { logActivity(c.id, 'llamada', `Pidió que lo llamen después.${n}`); if (d) snoozeDeal(d.id, 7); onClose() }) },
    { icon: PhoneMissed, label: 'No contesta', cls: 'text-slate-700 bg-slate-50 ring-slate-200', run: () => done(() => { logActivity(c.id, 'llamada', `No contesta.${n}`); toast('Sugerencia del Copiloto: prueba con un WhatsApp'); openModal('wa', { contactId: c.id, template: 'video' }) }) },
    { icon: PauseCircle, label: 'Por ahora no', cls: 'text-rose-700 bg-rose-50 ring-rose-200', run: () => done(() => { logActivity(c.id, 'llamada', `Por ahora no.${n}`); if (d && d.stage !== 'cerrado') pauseDeal(d.id); onClose() }) },
  ]

  return (
    <Modal open onClose={onClose} title="Registrar llamada" subtitle="Elige el resultado: Vendex agenda el siguiente paso">
      <div className="flex flex-col items-center rounded-2xl bg-gradient-to-b from-indigo-50 to-white py-5 text-center">
        <span className="relative">
          <span className="absolute inset-0 animate-ping rounded-full bg-indigo-300/50" />
          <span className="relative grid h-14 w-14 place-items-center rounded-full bg-indigo-600 text-white"><Phone size={24} /></span>
        </span>
        <p className="mt-3 font-semibold text-slate-900">{c.name}</p>
        <p className="flex items-center gap-1.5 text-sm tabular-nums text-slate-500"><Flag code={c.country} /> {c.phone}</p>
        <p className="mt-1 text-xs tabular-nums text-slate-400">Llamada simulada · {String(Math.floor(secs / 60)).padStart(2, '0')}:{String(secs % 60).padStart(2, '0')}</p>
      </div>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Nota rápida (opcional): ¿qué te dijo?" className={cx(inputCls, 'mt-4 h-auto py-2')} />
      <div className="mt-3 grid grid-cols-2 gap-2">
        {outcomes.map((o) => (
          <button key={o.label} onClick={o.run} className={cx('flex min-h-14 items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium ring-1 ring-inset transition hover:brightness-95', o.cls)}>
            <o.icon size={18} className="shrink-0" /> {o.label}
          </button>
        ))}
      </div>
    </Modal>
  )
}

/* ================= Pago mixto (USD + moneda local) ================= */
function SplitModal({ onClose, contactId, alertId }) {
  const { contactById, data, logActivity, toast } = useApp()
  const resolve = useResolveAlert()
  const c = contactById[contactId]
  const d = mainDeal(data.deals, c.id)
  const local = COUNTRIES[c.country].local
  const totalUSD = d ? convert(d.amount, d.currency, 'USD', data.rates) : 0
  const [pct, setPct] = useState(50)
  const [rate, setRate] = useState(data.rates[local])
  const usdPart = (totalUSD * pct) / 100
  const localPart = (totalUSD - usdPart) * rate
  const summary = `${d?.product}: ${fmtMoney(usdPart, 'USD')} + ${fmtMoney(localPart, local)} (TC ${rate} ${CURRENCIES[local].symbol} por US$). Total ${fmtMoney(totalUSD, 'USD')}.`
  const [copied, setCopied] = useState(false)

  return (
    <Modal
      open
      onClose={onClose}
      title="Pago mixto"
      subtitle={`${c.name} · ${d?.product}`}
      footer={<>
        <Button variant="secondary" onClick={async () => { try { await navigator.clipboard.writeText(summary); setCopied(true) } catch { toast('Tu navegador no permitió copiar') } }}>{copied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />} Copiar desglose</Button>
        <Button variant="primary" onClick={() => { logActivity(c.id, 'nota', `Desglose de pago mixto: ${summary}`); resolve(alertId); toast('Desglose guardado en el historial', { tone: 'success' }); onClose() }}>Guardar en historial</Button>
      </>}
    >
      <div className="text-center">
        <p className="text-sm text-slate-500">Total del trato</p>
        <p className="text-3xl font-bold tracking-tight text-slate-900">{fmtMoney(totalUSD, 'USD')}</p>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-indigo-50 p-4">
          <p className="text-xs font-medium text-indigo-600">En dólares · {pct}%</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-indigo-900">{fmtMoney(usdPart, 'USD')}</p>
        </div>
        <div className="rounded-xl bg-emerald-50 p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700"><Flag code={c.country} className="h-2.5 w-[15px]" /> En {CURRENCIES[local].name.toLowerCase()} · {100 - pct}%</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-emerald-900">{fmtMoney(localPart, local)}</p>
        </div>
      </div>
      <label className="mt-5 block">
        <span className="flex justify-between text-sm text-slate-600"><span>Porcentaje en dólares</span><b className="tabular-nums">{pct}%</b></span>
        <input type="range" min={0} max={100} step={5} value={pct} onChange={(e) => setPct(Number(e.target.value))} className="range mt-2 w-full" style={{ '--p': `${pct}%` }} />
      </label>
      <Field label={`Tipo de cambio del día (${CURRENCIES[local].symbol} por US$ 1)`} className="mt-4">
        <input className={inputCls} type="number" step="0.01" value={rate} onChange={(e) => setRate(Number(e.target.value) || 0)} />
      </Field>
    </Modal>
  )
}

/* ================= Tipo de cambio ================= */
function RatesModal({ onClose }) {
  const { data, setRates, syncRates } = useApp()
  const [r, setR] = useState({ PEN: data.rates.PEN, BOB: data.rates.BOB, VES: data.rates.VES })
  const [official, setOfficial] = useState(null)
  const [loading, setLoading] = useState(false)
  const rows = [['PEN', 'PE'], ['BOB', 'BO'], ['VES', 'VE']]
  const fetchOfficial = async () => {
    setLoading(true)
    const res = await syncRates()
    setLoading(false)
    if (!res) return
    setOfficial(Object.fromEntries(res.map((o) => [o.code, o])))
    setR((x) => ({ ...x, ...Object.fromEntries(res.filter((o) => o.ok && o.code in x).map((o) => [o.code, o.rate])) }))
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Tipo de cambio del día"
      subtitle="Valores por US$ 1. Se actualizan solos desde el banco central de cada país; aquí puedes traerlos ahora o ajustarlos a mano."
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={() => { setRates(r); onClose() }}>Guardar</Button></>}
    >
      <Button className="mb-4 w-full justify-center" onClick={fetchOfficial} disabled={loading}>
        <RotateCcw size={16} className={loading ? 'animate-spin' : ''} />
        {loading ? 'Consultando BCRP, BCB y BCV…' : 'Traer tasas oficiales ahora'}
      </Button>
      <div className="space-y-3">
        {rows.map(([cur, flag]) => {
          const o = official?.[cur]
          return (
            <div key={cur}>
              <label className="flex items-center gap-3">
                <Flag code={flag} />
                <span className="w-40 text-sm text-slate-700">{CURRENCIES[cur].name}</span>
                <div className="flex flex-1">
                  <span className="grid w-12 place-items-center rounded-l-lg border border-r-0 border-slate-200 bg-slate-50 text-sm font-medium text-slate-600">{CURRENCIES[cur].symbol}</span>
                  <input type="number" step="0.01" min="0" className={cx(inputCls, 'rounded-l-none tabular-nums')} value={r[cur]} onChange={(e) => setR({ ...r, [cur]: Number(e.target.value) || 0 })} />
                </div>
              </label>
              {o && (
                <p className={cx('mt-1 text-right text-xs', o.ok ? 'text-slate-500' : 'text-amber-700')}>
                  {o.ok ? `${o.source} · fecha valor ${o.date}` : `${o.source}: no disponible (${o.error})`}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </Modal>
  )
}

import { useEffect, useMemo, useState } from 'react'
import {
  MessageCircle, Phone, ThumbsUp, Clock, PhoneMissed, PauseCircle, FileSpreadsheet, UploadCloud, ArrowRight, Check,
  Copy, CheckCheck, Loader2,
} from 'lucide-react'
import { useApp } from '../store'
import { CHANNELS, COUNTRIES, PRODUCTS, STAGES } from '../data/mock'
import { CURRENCIES, convert, fmtMoney } from '../lib/money'
import { Avatar, Button, Field, Flag, Modal, TEMPS, cx, inputCls } from './ui'
import { mainDeal } from '../views/Clients'

export default function Modals() {
  const { modal, closeModal } = useApp()
  if (!modal) return null
  const P = { deal: DealModal, wa: WhatsAppModal, call: CallModal, split: SplitModal, import: ImportModal, rates: RatesModal }[modal.type]
  return P ? <P {...modal} onClose={closeModal} /> : null
}

function useResolveAlert() {
  const { setData } = useApp()
  return (alertId) => alertId && setData((d) => ({ ...d, alerts: d.alerts.filter((a) => a.id !== alertId) }))
}

/* ================= Nuevo trato ================= */
const NEXT = [['Hoy', 0], ['Mañana', 1], ['En 3 días', 3], ['Próx. semana', 7]]

function DealModal({ onClose, contactId }) {
  const { data, addDeal, contactById, country: activeCountry, inCountry } = useApp()
  const fixed = contactId && contactById[contactId]
  const startCountry = fixed?.country || (activeCountry === 'ALL' ? 'PE' : activeCountry)
  const [mode, setMode] = useState(fixed ? 'existente' : 'nuevo')
  const [f, setF] = useState({
    contactId: contactId || '', name: '', company: '', country: startCountry, city: '', phone: '', doc: '',
    product: '', amount: '', currency: COUNTRIES[startCountry].display, temp: 'tibio', channel: 'WhatsApp',
    stage: 'nuevo', nextDays: 1, nextAction: '', note: '',
  })
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? e.target.value : e }))

  const pickProduct = (name) => {
    const p = PRODUCTS.find((x) => x.name === name)
    setF((x) => ({ ...x, product: name, amount: p ? String(Math.round(convert(p.price, 'USD', x.currency, data.rates))) : x.amount }))
  }
  const pickCountry = (c) => setF((x) => ({ ...x, country: c, currency: COUNTRIES[c].display }))
  const existing = data.contacts.filter((c) => inCountry(c.country))
  const valid = f.product.trim() && (mode === 'nuevo' ? f.name.trim() : f.contactId)

  const submit = (e) => {
    e.preventDefault()
    if (!valid) return
    const c = mode === 'existente' ? contactById[f.contactId] : null
    addDeal({ ...f, contactId: mode === 'existente' ? f.contactId : '', country: c?.country || f.country })
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title="Nuevo trato"
      subtitle="Registra una oportunidad en menos de 30 segundos"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" type="submit" form="deal-form" disabled={!valid}>Agregar al embudo</Button></>}
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
                  <Field label="Nombre del cliente *"><input className={inputCls} value={f.name} onChange={set('name')} placeholder="Ej. Juan Pérez Flores" required /></Field>
                  <Field label="Empresa"><input className={inputCls} value={f.company} onChange={set('company')} placeholder="Opcional" /></Field>
                  <Field label="Teléfono">
                    <div className="flex">
                      <span className="grid place-items-center rounded-l-lg border border-r-0 border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">{COUNTRIES[f.country].prefix}</span>
                      <input className={cx(inputCls, 'rounded-l-none')} inputMode="tel" value={f.phone} onChange={set('phone')} placeholder="999 999 999" />
                    </div>
                  </Field>
                  <Field label={COUNTRIES[f.country].doc}><input className={inputCls} value={f.doc} onChange={set('doc')} placeholder="Opcional" /></Field>
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

        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-slate-700">Próximo seguimiento</span>
          <div className="flex flex-wrap gap-2">
            {NEXT.map(([l, n]) => (
              <button type="button" key={n} onClick={() => set('nextDays')(n)} className={cx('h-9 rounded-full px-3.5 text-sm font-medium ring-1 ring-inset', f.nextDays === n ? 'bg-slate-900 text-white ring-slate-900' : 'text-slate-600 ring-slate-200')}>{l}</button>
            ))}
          </div>
          <input className={cx(inputCls, 'mt-2')} value={f.nextAction} onChange={set('nextAction')} placeholder="¿Qué harás? Ej. Enviar video de la máquina" />
        </div>
      </form>
    </Modal>
  )
}

/* ================= WhatsApp ================= */
function WhatsAppModal({ onClose, contactId, alertId, template = 'seguimiento' }) {
  const { contactById, data, money, original, logActivity, toast } = useApp()
  const resolve = useResolveAlert()
  const c = contactById[contactId]
  const d = mainDeal(data.deals, c.id)
  const first = c.name.split(' ')[0]
  const price = d ? (c.country === 'VE' ? original(d.amount, d.currency) : money(d.amount, d.currency)) : ''
  const T = {
    seguimiento: { label: 'Seguimiento', text: `Hola ${first}, buen día. Le escribe Andrés de Vendex. ¿Pudo revisar la cotización de ${d?.product || 'la máquina'}${price ? ` (${price})` : ''}? Quedo atento a sus dudas para avanzar.` },
    video: { label: 'Enviar video', text: `Hola ${first}, le escribe Andrés. Intenté llamarlo, le dejo un video de 40 segundos de ${d?.product || 'la máquina'} trabajando en planta. ¿Le llamo mañana a las 9 o prefiere a las 4?` },
    separar: { label: 'Separar equipo', text: `Hola ${first}, ¡felicitaciones por la aprobación del crédito! Puede separar ${d?.product || 'su equipo'} con solo 30% de adelanto y asegurar la entrega antes de la campaña. ¿Le preparo la proforma?` },
    promo: { label: 'Promoción', text: `Hola ${first}, este mes tenemos instalación y capacitación gratis en secadoras y 10% de descuento al contado en molinos compactos. ¿Le interesa que le envíe el detalle?` },
  }
  const [k, setK] = useState(template)
  const [text, setText] = useState(T[template]?.text || T.seguimiento.text)

  const send = () => {
    logActivity(c.id, 'whatsapp', `WhatsApp enviado: “${text.length > 110 ? text.slice(0, 110) + '…' : text}”`)
    resolve(alertId)
    toast(`Mensaje registrado para ${first} (envío simulado)`, { tone: 'success' })
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={<span className="flex items-center gap-2"><MessageCircle size={18} className="text-[#25D366]" /> WhatsApp a {c.name}</span>}
      subtitle={<span className="flex items-center gap-1.5"><Flag code={c.country} /> {c.phone}</span>}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button className="bg-[#25D366] text-white hover:bg-[#1fb757]" onClick={send}><MessageCircle size={16} /> Enviar mensaje</Button></>}
    >
      <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
        {Object.entries(T).map(([key, t]) => (
          <button key={key} onClick={() => { setK(key); setText(t.text) }} className={cx('h-8 shrink-0 rounded-full px-3 text-[13px] font-medium ring-1 ring-inset', k === key ? 'bg-[#25D366]/15 text-[#128C4A] ring-[#25D366]/40' : 'text-slate-600 ring-slate-200')}>{t.label}</button>
        ))}
      </div>
      <div className="rounded-xl bg-[#EFEAE2] p-3">
        <div className="ml-auto max-w-[92%] rounded-xl rounded-tr-sm bg-[#D9FDD3] p-1 shadow-sm">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} className="w-full resize-none bg-transparent px-2 py-1 text-base leading-relaxed text-slate-800 outline-none sm:text-sm" aria-label="Mensaje" />
          <div className="flex items-center justify-end gap-1 px-2 pb-1 text-[11px] text-slate-500">ahora <CheckCheck size={14} className="text-sky-500" /></div>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">Puedes editar el mensaje. Quedará guardado en el historial del cliente.</p>
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

/* ================= Importar Excel ================= */
const MAP = [
  ['FECHA', 'Fecha de registro'],
  ['TELEFONO', 'Teléfono (con prefijo de país)'],
  ['CONTACTO/CLIENTE', 'Nombre del cliente'],
  ['EMPRESA', 'Empresa'],
  ['RUC/DNI · CEDULA', 'Documento (RUC, NIT, RIF)'],
  ['PRODUCTO', 'Producto de interés'],
  ['MONTO', 'Monto + moneda'],
  ['CONTACTO (Facebook, TikTok…)', 'Canal de origen / vendedor'],
  ['UBICACIÓN · LUGAR', 'Ciudad y región'],
  ['STATUS 1, 2, 3…', 'Historial de seguimiento (línea de tiempo)'],
]
const COLORS = [
  ['bg-red-500', 'Rojo', 'Por ahora no / No contesta'],
  ['bg-yellow-300', 'Amarillo', 'Tibio · en evaluación'],
  ['bg-sky-400', 'Celeste', 'Caliente · interesado'],
  ['bg-green-500', 'Verde', 'Venta cerrada'],
]

function ImportModal({ onClose }) {
  const { toast } = useApp()
  const [step, setStep] = useState(0)
  const [file, setFile] = useState('')
  const [progress, setProgress] = useState(0)
  const sheets = useMemo(() => [
    { name: 'BASE DE DATOS CLIENTES', rows: 148, flag: 'PE' },
    { name: 'BOLIVIA', rows: 8, flag: 'BO' },
    { name: 'CLIENTES POTENCIALES', rows: 37, flag: 'PE' },
  ], [])
  const total = sheets.reduce((s, x) => s + x.rows, 0)

  useEffect(() => {
    if (step !== 2) return
    const t = setInterval(() => setProgress((p) => {
      if (p >= 100) { clearInterval(t); return 100 }
      return p + 7
    }), 90)
    return () => clearInterval(t)
  }, [step])

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title="Importar desde Excel"
      subtitle="Trae tu hoja de clientes tal como la tienes hoy"
      footer={
        step === 0 ? <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          : step === 1 ? <><Button variant="ghost" onClick={() => setStep(0)}>Atrás</Button><Button variant="primary" onClick={() => setStep(2)}>Importar {total} registros <ArrowRight size={16} /></Button></>
            : <Button variant={progress >= 100 ? 'success' : 'secondary'} disabled={progress < 100} onClick={() => { toast('Vista previa: la importación real se activa con el backend', { tone: 'success' }); onClose() }}>{progress >= 100 ? 'Listo' : 'Importando…'}</Button>
      }
    >
      {step === 0 && (
        <div className="space-y-3">
          <label className="flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-slate-300 px-6 py-10 text-center transition hover:border-indigo-400 hover:bg-indigo-50/40">
            <UploadCloud size={30} className="text-indigo-500" />
            <p className="mt-3 font-medium text-slate-800">Arrastra tu archivo o haz clic para elegirlo</p>
            <p className="text-sm text-slate-500">.xlsx, .xls o .csv · todas las hojas a la vez</p>
            <input type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={(e) => { const n = e.target.files?.[0]?.name; if (n) { setFile(n); setStep(1) } }} />
          </label>
          <button onClick={() => { setFile('CLIENTES 2024-2025.xlsx'); setStep(1) }} className="flex w-full items-center gap-3 rounded-xl p-3 text-left ring-1 ring-slate-200 hover:bg-slate-50">
            <FileSpreadsheet size={22} className="text-emerald-600" />
            <span className="flex-1 text-sm"><b className="font-medium text-slate-800">Probar con un archivo de ejemplo</b><span className="block text-slate-500">CLIENTES 2024-2025.xlsx · 3 hojas</span></span>
            <ArrowRight size={16} className="text-slate-400" />
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-5">
          <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
            <FileSpreadsheet size={20} /> <span className="min-w-0 flex-1 truncate"><b className="font-semibold">{file}</b> · {sheets.length} hojas detectadas</span>
          </div>
          <ul className="grid gap-2 sm:grid-cols-3">
            {sheets.map((s) => (
              <li key={s.name} className="rounded-xl p-3 ring-1 ring-slate-200">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700"><Flag code={s.flag} className="h-2.5 w-[15px]" /> {s.name}</p>
                <p className="mt-1 text-sm text-slate-500">{s.rows} filas</p>
              </li>
            ))}
          </ul>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Columnas reconocidas</h3>
            <ul className="mt-2 divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
              {MAP.map(([a, b]) => (
                <li key={a} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <span className="w-[42%] truncate font-mono text-xs text-slate-500">{a}</span>
                  <ArrowRight size={14} className="shrink-0 text-slate-300" />
                  <span className="flex-1 text-slate-800">{b}</span>
                  <Check size={15} className="text-emerald-500" />
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Los colores de tus filas se convierten en estados</h3>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {COLORS.map(([cls, n, m]) => (
                <li key={n} className="flex items-center gap-2.5 text-sm"><span className={cx('h-4 w-4 rounded', cls)} /> <b className="font-medium text-slate-700">{n}</b> <ArrowRight size={12} className="text-slate-300" /> <span className="text-slate-600">{m}</span></li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="py-6 text-center">
          {progress < 100 ? <Loader2 size={32} className="mx-auto animate-spin text-indigo-600" /> : <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-600"><Check size={26} /></span>}
          <p className="mt-3 font-semibold text-slate-900">{progress < 100 ? 'Leyendo filas y deduplicando teléfonos…' : `${total} registros listos`}</p>
          <p className="text-sm text-slate-500">{progress < 100 ? `${Math.min(progress, 100)}%` : '12 duplicados unidos · 31 seguimientos convertidos en tareas'}</p>
          <div className="mx-auto mt-4 h-2 max-w-xs overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-indigo-600 transition-all" style={{ width: `${Math.min(progress, 100)}%` }} /></div>
        </div>
      )}
    </Modal>
  )
}

/* ================= Tipo de cambio ================= */
function RatesModal({ onClose }) {
  const { data, setRates } = useApp()
  const [r, setR] = useState({ PEN: data.rates.PEN, BOB: data.rates.BOB, VES: data.rates.VES })
  const rows = [['PEN', 'PE'], ['BOB', 'BO'], ['VES', 'VE']]
  return (
    <Modal
      open
      onClose={onClose}
      title="Tipo de cambio del día"
      subtitle="Valores referenciales por US$ 1. Se usan para convertir y sumar montos entre países."
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={() => { setRates(r); onClose() }}>Guardar</Button></>}
    >
      <div className="space-y-3">
        {rows.map(([cur, flag]) => (
          <label key={cur} className="flex items-center gap-3">
            <Flag code={flag} />
            <span className="w-40 text-sm text-slate-700">{CURRENCIES[cur].name}</span>
            <div className="flex flex-1">
              <span className="grid w-12 place-items-center rounded-l-lg border border-r-0 border-slate-200 bg-slate-50 text-sm font-medium text-slate-600">{CURRENCIES[cur].symbol}</span>
              <input type="number" step="0.01" min="0" className={cx(inputCls, 'rounded-l-none tabular-nums')} value={r[cur]} onChange={(e) => setR({ ...r, [cur]: Number(e.target.value) || 0 })} />
            </div>
          </label>
        ))}
      </div>
    </Modal>
  )
}

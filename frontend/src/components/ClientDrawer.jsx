import { useEffect, useState } from 'react'
import {
  X, Phone, MessageCircle, Mail, MapPin, FileText, CircleDollarSign, StickyNote, Eye, Video, IdCard, Megaphone,
  UserRound, Coins, Plus, Send, Banknote,
} from 'lucide-react'
import { useApp, stageName } from '../store'
import { COUNTRIES } from '../data/mock'
import { CURRENCIES, fmtMoney } from '../lib/money'
import { Avatar, Button, Flag, TEMPS, cx } from './ui'
import { fmtDate, fmtTime, rel } from '../lib/dates'
import { PAY_UI, dueText, payStatus } from '../lib/cobranza'

export const TL = {
  llamada: { icon: Phone, cls: 'bg-indigo-100 text-indigo-600', label: 'Llamada' },
  whatsapp: { icon: MessageCircle, cls: 'bg-[#25D366]/15 text-[#128C4A]', label: 'WhatsApp' },
  visita: { icon: MapPin, cls: 'bg-amber-100 text-amber-700', label: 'Visita' },
  reunion: { icon: Video, cls: 'bg-sky-100 text-sky-700', label: 'Reunión' },
  cotizacion: { icon: FileText, cls: 'bg-violet-100 text-violet-700', label: 'Cotización' },
  venta: { icon: CircleDollarSign, cls: 'bg-emerald-100 text-emerald-700', label: 'Venta' },
  nota: { icon: StickyNote, cls: 'bg-slate-100 text-slate-600', label: 'Nota' },
  vista: { icon: Eye, cls: 'bg-rose-100 text-rose-600', label: 'Actividad' },
  correo: { icon: Mail, cls: 'bg-slate-100 text-slate-600', label: 'Correo' },
  email: { icon: Mail, cls: 'bg-slate-100 text-slate-600', label: 'Correo' },
  pago: { icon: Banknote, cls: 'bg-emerald-100 text-emerald-700', label: 'Pago' },
}

export default function ClientDrawer() {
  const app = useApp()
  const SELLERS = app.sellers
  const { drawer, closeDrawer, contactById, data, money, original, currency, setTemp, openModal, logActivity, toast } = app
  const c = drawer && contactById[drawer]
  const [type, setType] = useState('nota')
  const [text, setText] = useState('')

  useEffect(() => {
    if (!drawer) return
    const k = (e) => e.key === 'Escape' && closeDrawer()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [drawer, closeDrawer])

  if (!c) return null
  const deals = data.deals.filter((d) => d.contactId === c.id)
  const pays = data.payments.filter((p) => p.contactId === c.id).sort((a, b) => (a.dueAt < b.dueAt ? -1 : 1))
  const owedCur = pays[0]?.currency
  const owed = pays.filter((p) => !p.paidAt).reduce((s, p) => s + p.amount, 0)
  const paidSum = pays.filter((p) => p.paidAt).reduce((s, p) => s + p.amount, 0)
  const country = COUNTRIES[c.country]
  const save = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    logActivity(c.id, type, text.trim())
    setText('')
    toast('Seguimiento guardado en el historial', { tone: 'success' })
  }

  const info = [
    [Phone, 'Teléfono', c.phone],
    [IdCard, country.doc, c.doc || '—'],
    [Mail, 'Correo', c.email || '—'],
    [Megaphone, 'Canal de origen', c.channel],
    [UserRound, 'Vendedor', SELLERS[c.owner]?.name],
    [Coins, 'Moneda local', `${CURRENCIES[country.local].name} (${CURRENCIES[country.local].symbol})`],
  ]

  return (
    <div className="fixed inset-0 z-40">
      <div className="anim-fade absolute inset-0 bg-slate-900/30 backdrop-blur-[1px]" onClick={closeDrawer} />
      <aside role="dialog" aria-modal="true" aria-label={`Ficha de ${c.name}`} className="anim-slide absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-2xl sm:max-w-[460px]">
        <div className="border-b border-slate-100 px-5 pb-4 pt-5">
          <div className="flex items-start gap-4">
            <Avatar name={c.name} size="lg" />
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold leading-tight text-slate-900">{c.name}</h2>
              <p className="text-sm text-slate-500">{c.company || 'Persona natural'}</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600"><Flag code={c.country} /> {c.city}{c.region && `, ${c.region}`} · {country.name}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={closeDrawer} aria-label="Cerrar"><X size={18} /></Button>
          </div>
          <div className="mt-4 flex gap-1 rounded-xl bg-slate-100 p-1">
            {Object.entries(TEMPS).map(([k, t]) => (
              <button
                key={k}
                onClick={() => setTemp(c.id, k)}
                className={cx('flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-[13px] font-medium transition', c.temp === k ? 'bg-white shadow-sm ' + t.cls.split(' ')[1] : 'text-slate-500')}
              >
                <t.icon size={14} /> {t.label}
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            <Action icon={MessageCircle} label="WhatsApp" cls="text-[#128C4A] bg-[#25D366]/10" onClick={() => openModal('wa', { contactId: c.id })} />
            <Action icon={Phone} label="Llamar" cls="text-indigo-600 bg-indigo-50" onClick={() => openModal('call', { contactId: c.id })} />
            <Action icon={Mail} label="Correo" cls="text-slate-600 bg-slate-100" onClick={() => { logActivity(c.id, 'correo', 'Se envió correo con ficha técnica.'); toast('Correo registrado (simulado)') }} />
            <Action icon={Plus} label="Trato" cls="text-slate-600 bg-slate-100" onClick={() => openModal('deal', { contactId: c.id })} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <h3 className="text-xs font-semibold text-slate-400">Ficha técnica</h3>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3">
            {info.map(([I, k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="flex items-center gap-1.5 text-xs text-slate-500"><I size={12} /> {k}</dt>
                <dd className="truncate text-sm font-medium text-slate-800">{v}</dd>
              </div>
            ))}
          </dl>

          <h3 className="mt-6 text-xs font-semibold text-slate-400">Tratos</h3>
          <ul className="mt-2 space-y-2">
            {deals.map((d) => (
              <li key={d.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{d.product}</p>
                  <p className={cx('text-xs', d.stage === 'cerrado' ? 'text-emerald-600' : 'text-slate-500')}>{stageName(d.stage)}{d.stage !== 'cerrado' && ` · ${rel(d.nextAt)}: ${d.nextAction}`}</p>
                </div>
                <div className="text-right">
                  <p className="whitespace-nowrap text-sm font-semibold tabular-nums text-slate-900">{money(d.amount, d.currency)}</p>
                  {d.currency !== currency && <p className="whitespace-nowrap text-[11px] tabular-nums text-slate-400">{original(d.amount, d.currency)}</p>}
                </div>
              </li>
            ))}
            {deals.length === 0 && <li className="text-sm text-slate-500">Sin tratos todavía.</li>}
          </ul>

          {pays.length > 0 && (
            <>
              <h3 className="mt-6 text-xs font-semibold text-slate-400">Estado de cuenta</h3>
              <div className="mt-2 rounded-xl border border-slate-200">
                <div className="grid grid-cols-2 gap-px overflow-hidden rounded-t-xl bg-slate-100">
                  <div className="bg-white p-3"><p className="text-xs text-slate-500">Pagado</p><p className="font-semibold tabular-nums text-emerald-600">{fmtMoney(paidSum, owedCur)}</p></div>
                  <div className="bg-white p-3"><p className="text-xs text-slate-500">Por cobrar</p><p className={cx('font-semibold tabular-nums', owed ? 'text-slate-900' : 'text-slate-400')}>{fmtMoney(owed, owedCur)}</p></div>
                </div>
                <ul className="divide-y divide-slate-100 border-t border-slate-100">
                  {pays.map((p) => {
                    const st = payStatus(p)
                    return (
                      <li key={p.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                        <span className={cx('h-2 w-2 shrink-0 rounded-full', PAY_UI[st].dot)} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-slate-700">{p.label}</p>
                          <p className={cx('text-xs', st === 'vencido' ? 'text-rose-600' : 'text-slate-500')}>{p.paidAt ? `Pagado ${fmtDate(p.paidAt)} · ${p.method}` : `${dueText(p)} · ${fmtDate(p.dueAt)}`}</p>
                        </div>
                        <span className="whitespace-nowrap font-medium tabular-nums text-slate-800">{fmtMoney(p.amount, p.currency)}</span>
                        {!p.paidAt && (
                          <Button size="icon" variant="secondary" className="!h-8 !w-8 text-emerald-600" title="Registrar pago" aria-label="Registrar pago" onClick={() => openModal('pay', { paymentId: p.id })}>
                            <Banknote size={15} />
                          </Button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            </>
          )}

          <h3 className="mt-6 text-xs font-semibold text-slate-400">Historial de seguimiento</h3>
          <form onSubmit={save} className="mt-2 rounded-xl border border-slate-200 p-2 focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-50">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              placeholder="¿Qué pasó? Ej. “Dice que lo llame en febrero”"
              className="w-full resize-none border-0 bg-transparent px-1.5 py-1 text-base outline-none placeholder:text-slate-400 sm:text-sm"
            />
            <div className="flex items-center gap-1">
              {['nota', 'llamada', 'whatsapp', 'visita'].map((k) => {
                const T = TL[k]
                return (
                  <button type="button" key={k} onClick={() => setType(k)} title={T.label} className={cx('grid h-8 w-8 place-items-center rounded-lg', type === k ? T.cls : 'text-slate-400 hover:bg-slate-100')}>
                    <T.icon size={15} />
                  </button>
                )
              })}
              <Button type="submit" size="sm" variant="primary" className="ml-auto" disabled={!text.trim()}><Send size={13} /> Guardar</Button>
            </div>
          </form>

          <ol className="relative mt-5 space-y-5 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-slate-200">
            {c.timeline.map((t) => {
              const T = TL[t.type] || TL.nota
              return (
                <li key={t.id} className="relative flex gap-3">
                  <span className={cx('relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full ring-4 ring-white', T.cls)}><T.icon size={14} /></span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-xs text-slate-400">
                      <span className="font-medium text-slate-600">{T.label}</span> · {rel(t.at)}, {fmtTime(t.at)} · {t.by === 'sistema' ? 'Vendex' : SELLERS[t.by]?.short || t.by}
                    </p>
                    <p className="mt-0.5 text-sm leading-relaxed text-slate-700">{t.text}</p>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      </aside>
    </div>
  )
}

function Action({ icon: I, label, cls, onClick }) {
  return (
    <button onClick={onClick} className={cx('flex h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs font-medium transition hover:brightness-95', cls)}>
      <I size={17} /> {label}
    </button>
  )
}

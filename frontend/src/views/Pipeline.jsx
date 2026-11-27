import { useState } from 'react'
import { Search, ArrowRight, ArrowRightLeft, Package, CalendarDays, PauseCircle, Plus, GripVertical, PartyPopper } from 'lucide-react'
import { useApp } from '../store'
import { STAGES } from '../data/mock'
import { Avatar, Button, Chip, Flag, TempBadge, TEMPS, cx } from '../components/ui'
import { diffDays, rel } from '../lib/dates'

export default function Pipeline() {
  const { data, contactById, inCountry, usd, fromUSD, moveDeal, openModal, sellers: SELLERS, canManage, sellerFilter } = useApp()
  const [q, setQ] = useState('')
  const [temp, setTemp] = useState('all')
  const [owner, setOwner] = useState('all')
  const [over, setOver] = useState(null)
  const [dragId, setDragId] = useState(null)
  const [showPaused, setShowPaused] = useState(false)

  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const deals = data.deals.filter((d) => {
    const c = contactById[d.contactId]
    if (!c || !inCountry(c.country)) return false
    if (temp !== 'all' && d.temp !== temp) return false
    if (canManage && sellerFilter === 'ALL' && owner !== 'all' && c.owner !== owner) return false
    if (q && !norm(`${c.name} ${c.company} ${d.product} ${c.city}`).includes(norm(q))) return false
    return true
  })
  const paused = deals.filter((d) => d.stage === 'pausa')

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="relative xl:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar cliente, producto o ciudad"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-base outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 sm:text-sm"
          />
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          <Chip active={temp === 'all'} onClick={() => setTemp('all')}>Todos</Chip>
          {Object.entries(TEMPS).map(([k, t]) => (
            <Chip key={k} active={temp === k} onClick={() => setTemp(k)}><t.icon size={13} /> {t.label}</Chip>
          ))}
          {/* El vendedor solo ve lo suyo; el gerente filtra aquí si no eligió un vendedor arriba */}
          {canManage && sellerFilter === 'ALL' && (
            <>
              <span className="mx-1 w-px shrink-0 bg-slate-200" />
              <select
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className="h-8 shrink-0 rounded-full border-0 bg-white px-3 text-[13px] font-medium text-slate-600 ring-1 ring-inset ring-slate-200"
                aria-label="Vendedor"
              >
                <option value="all">Todo el equipo</option>
                {Object.values(SELLERS).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </>
          )}
        </div>
        <p className="hidden text-xs text-slate-400 xl:ml-auto xl:block">Arrastra las tarjetas entre columnas</p>
      </div>

      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 xl:snap-none">
        {STAGES.map((s) => {
          const col = deals.filter((d) => d.stage === s.id).sort((a, b) => (a.nextAt < b.nextAt ? -1 : 1))
          const total = col.reduce((sum, d) => sum + usd(d.amount, d.currency), 0)
          const won = s.id === 'cerrado'
          return (
            <section
              key={s.id}
              onDragOver={(e) => { e.preventDefault(); setOver(s.id) }}
              onDragLeave={() => setOver((o) => (o === s.id ? null : o))}
              onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); setOver(null); setDragId(null); if (id) moveDeal(id, s.id) }}
              className={cx(
                'flex w-[84vw] shrink-0 snap-start flex-col rounded-2xl p-2 transition sm:w-[300px] xl:w-auto xl:min-w-[200px] xl:flex-1',
                won ? 'bg-emerald-50/70' : 'bg-slate-100/80',
                over === s.id && 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-[#F8FAFC]'
              )}
            >
              <header className="px-2 pb-2.5 pt-1.5">
                <div className="flex items-center gap-2">
                  <span className={cx('h-2 w-2 rounded-full', s.dot)} />
                  <h3 className="flex-1 text-sm font-semibold text-slate-800">{s.name}</h3>
                  <span className="rounded-full bg-white px-2 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">{col.length}</span>
                </div>
                <p className={cx('mt-0.5 pl-4 text-xs font-semibold tabular-nums', won ? 'text-emerald-700' : 'text-slate-500')}>{fromUSD(total)}</p>
              </header>
              <div className="flex min-h-24 flex-1 flex-col gap-2">
                {col.map((d) => (
                  <DealCard key={d.id} d={d} dragging={dragId === d.id} onDrag={setDragId} />
                ))}
                {col.length === 0 && (
                  <div className="grid flex-1 place-items-center rounded-xl border-2 border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                    {won ? <span className="flex flex-col items-center gap-1"><PartyPopper size={18} /> Suelta aquí para cerrar la venta</span> : 'Sin tratos'}
                  </div>
                )}
                {s.id === 'nuevo' && (
                  <button onClick={() => openModal('deal')} className="flex h-10 items-center justify-center gap-1.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-white hover:text-indigo-600">
                    <Plus size={16} /> Nuevo trato
                  </button>
                )}
              </div>
            </section>
          )
        })}
      </div>

      {paused.length > 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-4">
          <button onClick={() => setShowPaused((v) => !v)} className="flex w-full items-center gap-2 text-left text-sm font-medium text-slate-600">
            <PauseCircle size={16} /> {paused.length} trato{paused.length > 1 ? 's' : ''} en “Por ahora no”
            <span className="ml-auto text-xs text-indigo-600">{showPaused ? 'Ocultar' : 'Ver'}</span>
          </button>
          {showPaused && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {paused.map((d) => (
                <li key={d.id} className="flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-sm ring-1 ring-slate-200">
                  {contactById[d.contactId].name} · <span className="text-slate-500">{d.product}</span>
                  <button className="text-xs font-medium text-indigo-600" onClick={() => moveDeal(d.id, 'contactado')}>Reactivar</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function DealCard({ d, dragging, onDrag }) {
  const { contactById, money, original, currency, moveDeal, openContact, pauseDeal, sellers: SELLERS } = useApp()
  const c = contactById[d.contactId]
  const idx = STAGES.findIndex((s) => s.id === d.stage)
  const next = STAGES[idx + 1]
  const dd = diffDays(d.nextAt)
  const won = d.stage === 'cerrado'
  const due = won ? null : dd < 0 ? 'late' : dd === 0 ? 'today' : null

  return (
    <article
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', d.id); e.dataTransfer.effectAllowed = 'move'; onDrag(d.id) }}
      onDragEnd={() => onDrag(null)}
      className={cx(
        'group relative cursor-grab rounded-xl border bg-white p-3 shadow-sm transition hover:shadow-md active:cursor-grabbing',
        won ? 'border-emerald-200' : 'border-slate-200/80 hover:border-indigo-200',
        dragging && 'rotate-1 opacity-50'
      )}
    >
      <div className="flex items-center gap-2">
        <Flag code={c.country} />
        <TempBadge temp={d.temp} />
        <GripVertical size={14} className="ml-auto hidden text-slate-300 group-hover:block" />
      </div>
      <button onClick={() => openContact(c.id)} className="mt-2 block w-full text-left">
        <p className="font-semibold leading-snug text-slate-900 hover:text-indigo-700">{c.name}</p>
        {c.company && <p className="truncate text-xs text-slate-500">{c.company}</p>}
        <p className="mt-2 flex items-start gap-1.5 text-[13px] text-slate-600"><Package size={14} className="mt-0.5 shrink-0 text-slate-400" /> {d.product}</p>
      </button>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={cx('text-[15px] font-bold tabular-nums', won ? 'text-emerald-600' : 'text-slate-900')}>{money(d.amount, d.currency)}</span>
        {d.currency !== currency && <span className="text-[11px] tabular-nums text-slate-400">{original(d.amount, d.currency)}</span>}
      </div>
      <div
        className={cx(
          'mt-2.5 flex items-start gap-1.5 rounded-lg px-2 py-1.5 text-xs',
          won ? 'bg-emerald-50 text-emerald-700' : due === 'late' ? 'bg-rose-50 text-rose-700' : due === 'today' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-50 text-slate-600'
        )}
      >
        <CalendarDays size={13} className="mt-px shrink-0" />
        <span className="line-clamp-2">
          {won ? <>Cerrado {rel(d.closedAt).toLowerCase()} · {d.nextAction}</> : <><b className="font-semibold">{due === 'late' ? `Vencido (${rel(d.nextAt).toLowerCase()})` : rel(d.nextAt)}</b> · {d.nextAction}</>}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-slate-400" title={SELLERS[c.owner]?.name}>
          <Avatar name={SELLERS[c.owner]?.name} size="xs" /> <span className="truncate">{SELLERS[c.owner]?.short}</span>
        </span>
        <span className="ml-auto flex items-center gap-1">
          <label className="relative grid h-7 w-7 cursor-pointer place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Mover a…">
            <ArrowRightLeft size={14} />
            <select
              aria-label="Mover a etapa"
              className="absolute inset-0 cursor-pointer opacity-0"
              value={d.stage}
              onChange={(e) => (e.target.value === 'pausa' ? pauseDeal(d.id) : moveDeal(d.id, e.target.value))}
            >
              {STAGES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              <option value="pausa">Por ahora no</option>
            </select>
          </label>
          {next && (
            <Button
              size="icon"
              variant={next.id === 'cerrado' ? 'success' : 'secondary'}
              className="!h-7 !w-7"
              title={`Mover a ${next.name}`}
              aria-label={`Mover a ${next.name}`}
              onClick={() => moveDeal(d.id, next.id)}
            >
              <ArrowRight size={14} />
            </Button>
          )}
        </span>
      </div>
    </article>
  )
}

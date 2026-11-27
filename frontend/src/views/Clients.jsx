import { useState } from 'react'
import { Search, MessageCircle, Phone, Mail, History, FileSpreadsheet, Users } from 'lucide-react'
import { useApp } from '../store'
import { Avatar, Button, Card, Chip, Empty, Flag, TempBadge, cx } from '../components/ui'
import { diffDays, rel } from '../lib/dates'

const FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'activos', label: 'Clientes activos' },
  { id: 'calientes', label: 'Prospectos calientes' },
  { id: 'olvidados', label: 'Sin contacto +7 días' },
]

export function mainDeal(deals, contactId) {
  const mine = deals.filter((d) => d.contactId === contactId)
  return mine.find((d) => !['cerrado', 'pausa'].includes(d.stage)) || mine[0]
}

export default function Clients() {
  const { data, inCountry, lastContact, openModal } = useApp()
  const [q, setQ] = useState('')
  const [f, setF] = useState('all')
  const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

  const isClient = (c) => data.deals.some((d) => d.contactId === c.id && d.stage === 'cerrado')
  const base = data.contacts.filter((c) => inCountry(c.country))
  const counts = {
    all: base.length,
    activos: base.filter(isClient).length,
    calientes: base.filter((c) => !isClient(c) && c.temp === 'caliente').length,
    olvidados: base.filter((c) => !isClient(c) && diffDays(lastContact(c)) <= -7).length,
  }
  const list = base
    .filter((c) => {
      if (f === 'activos') return isClient(c)
      if (f === 'calientes') return !isClient(c) && c.temp === 'caliente'
      if (f === 'olvidados') return !isClient(c) && diffDays(lastContact(c)) <= -7
      return true
    })
    .filter((c) => !q || norm(`${c.name} ${c.company} ${c.city} ${c.region} ${c.phone} ${c.doc}`).includes(norm(q)))
    .sort((a, b) => (lastContact(a) > lastContact(b) ? -1 : 1))

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative lg:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nombre, empresa, ciudad, teléfono o RUC"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-base outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 sm:text-sm"
          />
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {FILTERS.map((x) => (
            <Chip key={x.id} active={f === x.id} onClick={() => setF(x.id)}>
              {x.label} <span className={cx('text-[11px]', f === x.id ? 'text-slate-300' : 'text-slate-400')}>{counts[x.id]}</span>
            </Chip>
          ))}
        </div>
        <Button variant="secondary" className="lg:ml-auto" onClick={() => openModal('import')}>
          <FileSpreadsheet size={16} className="text-emerald-600" /> Importar desde Excel
        </Button>
      </div>

      {list.length === 0 ? (
        <Card><Empty icon={Users} title="Sin resultados" text="Prueba con otro nombre, ciudad o filtro." /></Card>
      ) : (
        <>
          {/* Tabla (escritorio) */}
          <Card className="hidden overflow-hidden md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/70 text-left text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Ubicación</th>
                  <th className="hidden px-4 py-3 font-medium xl:table-cell">Interés</th>
                  <th className="px-4 py-3 text-right font-medium">Monto</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">Último contacto</th>
                  <th className="px-4 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((c) => <Row key={c.id} c={c} client={isClient(c)} />)}
              </tbody>
            </table>
          </Card>
          {/* Tarjetas (celular) */}
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:hidden">
            {list.map((c) => <MobileCard key={c.id} c={c} client={isClient(c)} />)}
          </div>
        </>
      )}
    </div>
  )
}

export function QuickActions({ c, size = 'icon' }) {
  const { openModal, openContact, logActivity, toast } = useApp()
  const btn = 'grid h-9 w-9 place-items-center rounded-lg transition'
  return (
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      <button title="WhatsApp" aria-label="WhatsApp" className={cx(btn, 'text-[#128C4A] hover:bg-[#25D366]/15')} onClick={() => openModal('wa', { contactId: c.id })}><MessageCircle size={17} /></button>
      <button title="Llamar" aria-label="Llamar" className={cx(btn, 'text-indigo-600 hover:bg-indigo-50')} onClick={() => openModal('call', { contactId: c.id })}><Phone size={17} /></button>
      <button
        title="Correo"
        aria-label="Correo"
        className={cx(btn, 'text-slate-500 hover:bg-slate-100')}
        onClick={() => { logActivity(c.id, 'correo', 'Se envió correo con ficha técnica.'); toast(`Correo registrado para ${c.name.split(' ')[0]} (simulado)`) }}
      >
        <Mail size={17} />
      </button>
      {size === 'icon' && <button title="Ver historial" aria-label="Ver historial" className={cx(btn, 'text-slate-500 hover:bg-slate-100')} onClick={() => openContact(c.id)}><History size={17} /></button>}
    </div>
  )
}

function Row({ c, client }) {
  const { data, money, openContact, lastContact, sellers: SELLERS } = useApp()
  const d = mainDeal(data.deals, c.id)
  const lc = lastContact(c)
  const stale = !client && diffDays(lc) <= -7
  return (
    <tr className="cursor-pointer transition hover:bg-indigo-50/40" onClick={() => openContact(c.id)}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar name={c.name} />
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900">{c.name}</p>
            <p className="truncate text-xs text-slate-500">{c.company || 'Persona natural'}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <p className="flex items-center gap-1.5 text-slate-700"><Flag code={c.country} /> {c.city}</p>
        <p className="pl-6 text-xs text-slate-400">{c.region}</p>
      </td>
      <td className="hidden max-w-[220px] truncate px-4 py-3 text-slate-600 xl:table-cell">{d?.product}</td>
      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-slate-900">{d ? money(d.amount, d.currency) : '—'}</td>
      <td className="px-4 py-3">
        {client ? <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">Cliente</span> : <TempBadge temp={c.temp} />}
      </td>
      <td className={cx('hidden whitespace-nowrap px-4 py-3 lg:table-cell', stale ? 'text-amber-600' : 'text-slate-500')}>
        {rel(lc)}
        <span className="block text-xs text-slate-400">{SELLERS[c.owner]?.short}</span>
      </td>
      <td className="px-4 py-3"><QuickActions c={c} /></td>
    </tr>
  )
}

function MobileCard({ c, client }) {
  const { data, money, openContact, lastContact } = useApp()
  const d = mainDeal(data.deals, c.id)
  return (
    <Card className="p-4" onClick={() => openContact(c.id)}>
      <div className="flex items-start gap-3">
        <Avatar name={c.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">{c.name}</p>
          <p className="truncate text-xs text-slate-500">{c.company || 'Persona natural'}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><Flag code={c.country} className="h-2.5 w-[15px]" /> {c.city} · {rel(lastContact(c))}</p>
        </div>
        {client ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Cliente</span> : <TempBadge temp={c.temp} />}
      </div>
      {d && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <span className="truncate text-slate-600">{d.product}</span>
          <span className="whitespace-nowrap font-semibold tabular-nums text-slate-900">{money(d.amount, d.currency)}</span>
        </div>
      )}
      <div className="mt-2 border-t border-slate-100 pt-2"><QuickActions c={c} /></div>
    </Card>
  )
}

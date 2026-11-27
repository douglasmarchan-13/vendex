import { useState } from 'react'
import { AlertTriangle, ArrowRight, Check, ChevronDown, FileSpreadsheet, Loader2, RotateCcw, UploadCloud } from 'lucide-react'
import { useApp } from '../store'
import { importsApi } from '../lib/api'
import { fmtMoney } from '../lib/money'
import { STAGES } from '../data/mock'
import { Button, Flag, Modal, cx } from './ui'

const STAGE_NAME = { ...Object.fromEntries(STAGES.map((s) => [s.id, s.name])), pausa: 'Por ahora no' }
const STATUS = {
  nuevo: { label: 'Nuevo', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  existente: { label: 'Ya existe · se completa', cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
  sin_cambios: { label: 'Ya está en Vendex', cls: 'bg-slate-100 text-slate-500 ring-slate-200' },
  otro_vendedor: { label: 'Es de otro vendedor', cls: 'bg-slate-100 text-slate-500 ring-slate-200' },
  incompleto: { label: 'Sin nombre', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
}
const importable = (c) => c.status === 'nuevo' || c.status === 'existente'
const FILTERS = [
  ['todos', 'Todos', () => true],
  ['avisos', 'Con avisos', (c) => importable(c) && c.issues.length > 0],
  ['compro', 'Dice "compró"', (c) => c.deals.some((d) => d.mentionsPurchase)],
  ['omitidos', 'No se importan', (c) => !importable(c)],
]
const PAGE = 60

/** Importar el Excel de clientes: elegir archivo → revisar la vista previa → importar */
export default function ImportModal({ onClose }) {
  const { toast, reload } = useApp()
  const [step, setStep] = useState('pick') // pick | review | done
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [exclude, setExclude] = useState(() => new Set())
  const [sold, setSold] = useState(() => new Set())
  const [filter, setFilter] = useState('todos')
  const [shown, setShown] = useState(PAGE)
  const [result, setResult] = useState(null)

  const pick = async (f) => {
    if (!f) return
    if (!/\.xlsx$/i.test(f.name)) {
      setError('El archivo debe ser .xlsx. Si es .xls o .csv, ábrelo en Excel y usa Guardar como → Libro de Excel (.xlsx).')
      return
    }
    setError('')
    setBusy(true)
    setFile(f)
    try {
      const p = await importsApi.preview(f)
      setPreview(p)
      setExclude(new Set())
      setSold(new Set())
      setStep('review')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const contacts = preview?.contacts ?? []
  const chosen = contacts.filter((c) => importable(c) && !exclude.has(c.key))
  const totals = {
    deals: chosen.reduce((n, c) => n + c.deals.length, 0),
    activities: chosen.reduce((n, c) => n + c.activities.length, 0),
  }
  const visible = contacts.filter(FILTERS.find(([id]) => id === filter)[2])

  const toggle = (set, setter, key) => {
    const next = new Set(set)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setter(next)
  }

  const commit = async () => {
    setBusy(true)
    setError('')
    try {
      const r = await importsApi.commit(file, { exclude: [...exclude], sold: [...sold].filter((k) => !exclude.has(k)) })
      setResult(r)
      setStep('done')
      reload()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const undo = async () => {
    setBusy(true)
    try {
      await importsApi.undo(result.id)
      reload()
      toast('Importación deshecha')
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const footer = {
    pick: <Button variant="ghost" onClick={onClose}>Cancelar</Button>,
    review: (
      <>
        <Button variant="ghost" disabled={busy} onClick={() => { setStep('pick'); setPreview(null); setError('') }}>Elegir otro archivo</Button>
        <Button variant="primary" disabled={busy || !chosen.length} onClick={commit}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : null} Importar {chosen.length} contactos <ArrowRight size={16} />
        </Button>
      </>
    ),
    done: (
      <>
        <Button variant="ghost" disabled={busy} onClick={undo}><RotateCcw size={15} /> Deshacer importación</Button>
        <Button variant="success" onClick={onClose}>Listo</Button>
      </>
    ),
  }[step]

  return (
    <Modal open onClose={busy ? () => {} : onClose} wide title="Importar desde Excel" subtitle="Trae tu hoja de clientes tal como la tienes hoy" footer={footer}>
      {error && (
        <p className="mb-3 flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700"><AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}</p>
      )}

      {step === 'pick' && (
        <div className="space-y-3">
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]) }}
            className={cx('flex flex-col items-center rounded-2xl border-2 border-dashed border-slate-300 px-6 py-10 text-center transition', busy ? 'opacity-60' : 'cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/40')}
          >
            {busy ? <Loader2 size={30} className="animate-spin text-indigo-500" /> : <UploadCloud size={30} className="text-indigo-500" />}
            <p className="mt-3 font-medium text-slate-800">{busy ? `Leyendo ${file?.name}…` : 'Arrastra tu archivo o haz clic para elegirlo'}</p>
            <p className="text-sm text-slate-500">Excel .xlsx · se leen todas las hojas (Perú, Bolivia, potenciales…)</p>
            <input type="file" accept=".xlsx" disabled={busy} className="sr-only" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />
          </label>
          <ul className="space-y-1 text-sm text-slate-500">
            <li>· Se reconocen las columnas FECHA, TELEFONO, CONTACTO/CLIENTE, EMPRESA, RUC/DNI, PRODUCTO, MONTO, CONTACTO, UBICACIÓN y STATUS.</li>
            <li>· Cada STATUS y las columnas de seguimiento pasan al historial del cliente.</li>
            <li>· Antes de guardar verás una vista previa. Nada se guarda hasta que confirmes.</li>
          </ul>
        </div>
      )}

      {step === 'review' && preview && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
            <FileSpreadsheet size={20} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate"><b className="font-semibold">{preview.fileName}</b> · {preview.sheets.filter((s) => s.found).map((s) => `${s.name} (${s.rows})`).join(' · ')}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat n={chosen.length} label="contactos a importar" strong />
            <Stat n={totals.deals} label="tratos" />
            <Stat n={totals.activities} label="notas al historial" />
            <Stat n={contacts.length - contacts.filter(importable).length} label="no se importan" />
          </div>

          {preview.summary.purchases > 0 && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              <b className="font-semibold">{preview.summary.purchases} clientes</b> tienen una nota que dice "compró". Entran en <i>Por ahora no</i>, salvo que marques
              <b className="font-semibold"> Fue venta nuestra</b> (filtro <i>Dice "compró"</i>).
            </p>
          )}

          <div className="-mx-1 flex gap-2 overflow-x-auto px-1">
            {FILTERS.map(([id, label, fn]) => (
              <button
                key={id}
                onClick={() => { setFilter(id); setShown(PAGE) }}
                className={cx('shrink-0 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset', filter === id ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50')}
              >
                {label} <span className="opacity-60">{contacts.filter(fn).length}</span>
              </button>
            ))}
          </div>

          <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
            {visible.slice(0, shown).map((c) => (
              <ContactRow
                key={c.key}
                c={c}
                included={importable(c) && !exclude.has(c.key)}
                onToggle={() => toggle(exclude, setExclude, c.key)}
                sold={sold.has(c.key)}
                onSold={() => toggle(sold, setSold, c.key)}
              />
            ))}
            {!visible.length && <li className="p-4 text-center text-sm text-slate-500">Nada en este filtro</li>}
          </ul>
          {visible.length > shown && (
            <Button variant="secondary" className="w-full justify-center" onClick={() => setShown(shown + PAGE)}>Ver {Math.min(PAGE, visible.length - shown)} más de {visible.length - shown}</Button>
          )}
        </div>
      )}

      {step === 'done' && result && (
        <div className="py-6 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-600"><Check size={26} /></span>
          <p className="mt-3 font-semibold text-slate-900">Importación lista</p>
          <p className="text-sm text-slate-500">{result.contacts} contactos nuevos · {result.deals} tratos · {result.activities} notas en el historial</p>
          <p className="mt-3 text-xs text-slate-400">Ya están en Clientes y en el Embudo. Si algo no se ve bien, puedes deshacer la importación completa.</p>
        </div>
      )}
    </Modal>
  )
}

function Stat({ n, label, strong }) {
  return (
    <div className={cx('rounded-xl p-3 ring-1', strong ? 'bg-indigo-50 ring-indigo-100' : 'ring-slate-200')}>
      <p className={cx('text-xl font-semibold tabular-nums', strong ? 'text-indigo-700' : 'text-slate-900')}>{n}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  )
}

function ContactRow({ c, included, onToggle, sold, onSold }) {
  const [open, setOpen] = useState(false)
  const canImport = importable(c)
  const st = STATUS[c.status]
  const purchase = c.deals.some((d) => d.mentionsPurchase)
  return (
    <li className={cx('px-3 py-2.5 text-sm', !included && 'bg-slate-50/60')}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          aria-label={`Importar ${c.name || 'fila'}`}
          className="mt-1 h-4 w-4 shrink-0 accent-indigo-600"
          checked={included}
          disabled={!canImport}
          onChange={onToggle}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cx('font-medium', included ? 'text-slate-900' : 'text-slate-500')}>{c.name || c.phone || 'Sin nombre'}</span>
            {c.company && c.company !== c.name && <span className="truncate text-slate-500">· {c.company}</span>}
            <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset', st.cls)}>{st.label}</span>
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
            <Flag code={c.country} className="h-2.5 w-[15px]" />
            {c.phone && <span className="tabular-nums">{c.phone}</span>}
            {c.city && <span>· {c.city}{c.region ? `, ${c.region}` : ''}</span>}
            <span>· {c.channel || 'Llegó solo'}</span>
          </p>
          {c.deals.map((d, i) => (
            <p key={i} className="mt-1 text-xs text-slate-600">
              <b className="font-medium text-slate-700">{d.product}</b>
              {d.amount > 0 && <span className="tabular-nums"> · {fmtMoney(d.amount, d.currency)}</span>}
              <span> · {sold && d.mentionsPurchase ? STAGE_NAME.cerrado : STAGE_NAME[d.stage]}</span>
            </p>
          ))}
          {canImport && purchase && (
            <label className="mt-1.5 inline-flex items-center gap-2 text-xs font-medium text-amber-800">
              <input type="checkbox" className="h-3.5 w-3.5 accent-emerald-600" checked={sold} onChange={onSold} /> Fue venta nuestra
            </label>
          )}
          {c.issues.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {c.issues.map((i, k) => (
                <li key={k} className={cx('flex items-start gap-1 text-xs', i.level === 'error' ? 'text-rose-600' : 'text-amber-700')}>
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {i.message}
                </li>
              ))}
            </ul>
          )}
          {open && (
            <ol className="mt-2 space-y-1 border-l-2 border-slate-200 pl-3 text-xs text-slate-600">
              {c.activities.map((a, k) => <li key={k}><span className="tabular-nums text-slate-400">{a.date || 'sin fecha'}</span> · {a.text}</li>)}
            </ol>
          )}
        </div>
        {c.activities.length > 0 && (
          <button onClick={() => setOpen(!open)} className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs text-slate-500 hover:bg-slate-100" aria-expanded={open}>
            {c.activities.length} notas <ChevronDown size={13} className={cx('transition', open && 'rotate-180')} />
          </button>
        )}
      </div>
    </li>
  )
}

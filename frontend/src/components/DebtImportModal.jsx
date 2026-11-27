import { useState } from 'react'
import { AlertTriangle, ArrowRight, Check, FileSpreadsheet, Loader2, RotateCcw, UploadCloud } from 'lucide-react'
import { useApp } from '../store'
import { importsApi } from '../lib/api'
import { fmtMoney } from '../lib/money'
import { Button, Modal, cx } from './ui'

const STATUS = {
  nuevo: { label: 'Cliente nuevo', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  existente: { label: 'Cliente existente', cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
  sin_cambios: { label: 'Ya importada', cls: 'bg-slate-100 text-slate-500 ring-slate-200' },
  otro_vendedor: { label: 'Es de otro vendedor', cls: 'bg-slate-100 text-slate-500 ring-slate-200' },
  incompleto: { label: 'No se puede leer', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
}
const importable = (d) => d.status === 'nuevo' || d.status === 'existente'
const totalsText = (byCur) => Object.entries(byCur || {}).map(([cur, n]) => fmtMoney(n, cur)).join(' + ') || '—'
/** YYYY-MM-DD → '21 dic 2026' (con año: hay cuotas de varios años; el mediodía evita que la zona horaria cambie el día) */
const day = (ymd) => new Date(`${ymd}T12:00:00`).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })

/** Importar el Excel de deudas por cobrar: elegir archivo → revisar ventas y cuotas → importar */
export default function DebtImportModal({ onClose }) {
  const { toast, reload } = useApp()
  const [step, setStep] = useState('pick') // pick | review | done
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [exclude, setExclude] = useState(() => new Set())
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
      setPreview(await importsApi.previewDebts(f))
      setExclude(new Set())
      setStep('review')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const debts = preview?.debts ?? []
  const chosen = debts.filter((d) => importable(d) && !exclude.has(d.key))
  const pending = {}
  for (const d of chosen) pending[d.currency] = (pending[d.currency] ?? 0) + d.pending

  const toggle = (key) => {
    const next = new Set(exclude)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setExclude(next)
  }

  const commit = async () => {
    setBusy(true)
    setError('')
    try {
      setResult(await importsApi.commitDebts(file, { exclude: [...exclude] }))
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
          {busy ? <Loader2 size={16} className="animate-spin" /> : null} Importar {chosen.length} deudas <ArrowRight size={16} />
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
    <Modal open onClose={busy ? () => {} : onClose} wide title="Importar deudas desde Excel" subtitle="Cada fila se registra como venta cerrada con sus cuotas por cobrar" footer={footer}>
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
            <p className="mt-3 font-medium text-slate-800">{busy ? `Leyendo ${file?.name}…` : 'Arrastra tu Excel de deudas o haz clic para elegirlo'}</p>
            <p className="text-sm text-slate-500">Columnas AÑO, CLIENTE, COMPROBANTE, VENCIMIENTOS y PAGOS A …</p>
            <input type="file" accept=".xlsx" disabled={busy} className="sr-only" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />
          </label>
          <ul className="space-y-1 text-sm text-slate-500">
            <li>· En VENCIMIENTOS escribe una cuota por línea: <span className="font-mono text-xs">(20,000) 21/DIC/2026</span></li>
            <li>· Si la columna de pagos es menor que las cuotas hasta esa fecha, la diferencia se registra como abono.</li>
            <li>· Antes de guardar verás una vista previa. Nada se guarda hasta que confirmes.</li>
          </ul>
        </div>
      )}

      {step === 'review' && preview && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
            <FileSpreadsheet size={20} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate"><b className="font-semibold">{preview.fileName}</b>{preview.sheets.filter((s) => s.found).map((s) => ` · ${s.name}`).join('')}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat n={chosen.length} label="deudas a importar" strong />
            <Stat n={chosen.reduce((s, d) => s + d.installments.length, 0)} label="cuotas pendientes" />
            <Stat n={totalsText(pending)} label="por cobrar" small />
          </div>
          {preview.summary.overdueByCurrency && Object.keys(preview.summary.overdueByCurrency).length > 0 && (
            <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">Hay <b className="font-semibold">{totalsText(preview.summary.overdueByCurrency)}</b> en cuotas vencidas: aparecerán como atrasadas en Cobranza.</p>
          )}

          <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
            {debts.map((d) => <DebtRow key={d.key} d={d} included={importable(d) && !exclude.has(d.key)} onToggle={() => toggle(d.key)} />)}
          </ul>
        </div>
      )}

      {step === 'done' && result && (
        <div className="py-6 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-600"><Check size={26} /></span>
          <p className="mt-3 font-semibold text-slate-900">Deudas importadas</p>
          <p className="text-sm text-slate-500">{result.deals} ventas · {result.payments} cuotas · {result.contacts} clientes nuevos</p>
          <p className="mt-3 text-xs text-slate-400">Ya están en Cobranza. Si algo no se ve bien, puedes deshacer la importación completa.</p>
        </div>
      )}
    </Modal>
  )
}

function Stat({ n, label, strong, small }) {
  return (
    <div className={cx('rounded-xl p-3 ring-1', strong ? 'bg-indigo-50 ring-indigo-100' : 'ring-slate-200')}>
      <p className={cx('font-semibold tabular-nums', small ? 'text-base' : 'text-xl', strong ? 'text-indigo-700' : 'text-slate-900')}>{n}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  )
}

function DebtRow({ d, included, onToggle }) {
  const st = STATUS[d.status]
  return (
    <li className={cx('px-3 py-2.5 text-sm', !included && 'bg-slate-50/60')}>
      <div className="flex items-start gap-3">
        <input type="checkbox" aria-label={`Importar ${d.name || 'fila'}`} className="mt-1 h-4 w-4 shrink-0 accent-indigo-600" checked={included} disabled={!importable(d)} onChange={onToggle} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cx('font-medium', included ? 'text-slate-900' : 'text-slate-500')}>{d.name || 'Sin nombre'}</span>
            <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset', st.cls)}>{st.label}</span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">{d.product}{d.year ? ` · ${d.year}` : ''} · por cobrar <b className="font-medium text-slate-700">{fmtMoney(d.pending, d.currency)}</b></p>
          <ul className="mt-1.5 space-y-0.5">
            {d.abonos.map((a, k) => (
              <li key={`a${k}`} className="flex items-center gap-2 text-xs text-emerald-700">
                <Check size={12} className="shrink-0" /> <span className="flex-1">Abono · {a.label}</span> <span className="tabular-nums">{fmtMoney(a.amount, d.currency)}</span>
              </li>
            ))}
            {d.installments.map((q, k) => (
              <li key={k} className={cx('flex items-center gap-2 text-xs', q.overdue ? 'text-rose-700' : 'text-slate-600')}>
                <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', q.overdue ? 'bg-rose-500' : 'bg-slate-300')} />
                <span className="flex-1">{q.label} · {q.overdue ? 'vencida el' : 'vence el'} {day(q.dueDate)}</span>
                <span className="tabular-nums">{fmtMoney(q.amount, d.currency)}</span>
              </li>
            ))}
          </ul>
          {d.issues.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {d.issues.map((i, k) => (
                <li key={k} className={cx('flex items-start gap-1 text-xs', i.level === 'error' ? 'text-rose-600' : 'text-amber-700')}>
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {i.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  )
}

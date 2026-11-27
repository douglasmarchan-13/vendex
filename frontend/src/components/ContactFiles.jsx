import { useEffect, useRef, useState } from 'react'
import { Eye, FileText, Loader2, Paperclip, Trash2, X } from 'lucide-react'
import { useApp } from '../store'
import { filesApi } from '../lib/api'
import { fmtDate } from '../lib/dates'
import { fmtSize, pdfProblem } from '../lib/files'
import { Button, cx, inputCls } from './ui'

/**
 * Cotizaciones (PDF hechos en otro sistema) adjuntas al cliente.
 * Se guardan en el servidor; "Ver" abre el PDF en otra pestaña con un enlace que vence en 5 minutos.
 * Úsalo con key={contact.id}: así el estado se reinicia al cambiar de cliente.
 */
export default function ContactFiles({ contact, deals }) {
  const { toast, addSavedActivity } = useApp()
  const [files, setFiles] = useState(null) // null = cargando
  const [error, setError] = useState('')
  const [draft, setDraft] = useState(null) // { file, dealId, note }
  const [busy, setBusy] = useState(false)
  const input = useRef(null)
  const cid = contact.id

  useEffect(() => {
    let alive = true
    filesApi
      .list(cid)
      .then((r) => alive && setFiles(r))
      .catch((e) => alive && (setFiles([]), setError(e.message)))
    return () => {
      alive = false
    }
  }, [cid])

  const openDeals = deals.filter((d) => d.stage !== 'cerrado' && d.stage !== 'pausa')
  const dealName = (id) => deals.find((d) => d.id === id)?.product

  const pick = (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // permite volver a elegir el mismo archivo
    if (!file) return
    const problem = pdfProblem(file)
    if (problem) return toast(problem)
    // Por defecto, el trato abierto más reciente (la cotización suele ser de ese)
    setDraft({ file, dealId: (openDeals[0] ?? deals[0])?.id ?? '', note: '' })
  }

  const save = async (e) => {
    e.preventDefault()
    if (!draft || busy) return
    setBusy(true)
    try {
      const r = await filesApi.upload(cid, draft)
      setFiles((fs) => [r.file, ...(fs ?? [])])
      addSavedActivity(cid, r.activity)
      setDraft(null)
      toast('Cotización adjuntada al cliente', { tone: 'success' })
    } catch (err) {
      toast(`No se pudo adjuntar: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const view = async (f) => {
    // La pestaña se abre ya (en el clic) para que el navegador no la bloquee; luego se le pone el enlace
    const tab = window.open('', '_blank')
    try {
      const { url } = await filesApi.url(cid, f.id)
      if (tab) tab.location.href = url
      else window.location.assign(url)
    } catch (err) {
      tab?.close()
      toast(`No se pudo abrir el PDF: ${err.message}`)
    }
  }

  const remove = async (f) => {
    if (!window.confirm(`¿Eliminar "${f.fileName}"? El PDF se borra del servidor.`)) return
    try {
      await filesApi.remove(cid, f.id)
      setFiles((fs) => fs.filter((x) => x.id !== f.id))
      toast('Cotización eliminada')
    } catch (err) {
      toast(`No se pudo eliminar: ${err.message}`)
    }
  }

  return (
    <section aria-label="Cotizaciones">
      <div className="mt-6 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-400">Cotizaciones</h3>
        {!draft && (
          <Button size="sm" variant="ghost" className="-mr-2 text-indigo-600" onClick={() => input.current?.click()}>
            <Paperclip size={13} /> Adjuntar PDF
          </Button>
        )}
        <input ref={input} type="file" accept="application/pdf,.pdf" className="hidden" onChange={pick} data-testid="pdf-input" />
      </div>

      {draft && (
        <form onSubmit={save} className="mt-2 space-y-2 rounded-xl border border-indigo-200 bg-indigo-50/40 p-3">
          <div className="flex items-center gap-2">
            <FileText size={16} className="shrink-0 text-violet-600" />
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800" title={draft.file.name}>{draft.file.name}</p>
            <span className="text-xs text-slate-500">{fmtSize(draft.file.size)}</span>
            <button type="button" onClick={() => setDraft(null)} className="text-slate-400 hover:text-slate-600" aria-label="Quitar archivo"><X size={15} /></button>
          </div>
          {deals.length > 0 && (
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">¿De qué trato es?</span>
              <select value={draft.dealId} onChange={(e) => setDraft({ ...draft, dealId: e.target.value })} className={cx(inputCls, '!h-9')}>
                <option value="">Sin trato</option>
                {deals.map((d) => <option key={d.id} value={d.id}>{d.product}</option>)}
              </select>
            </label>
          )}
          <input
            value={draft.note}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            maxLength={500}
            placeholder="Nota (opcional). Ej. “Precio válido 15 días”"
            className={cx(inputCls, '!h-9')}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" onClick={() => setDraft(null)} disabled={busy}>Cancelar</Button>
            <Button size="sm" type="submit" variant="primary" disabled={busy}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Paperclip size={13} />} {busy ? 'Subiendo…' : 'Adjuntar'}
            </Button>
          </div>
        </form>
      )}

      <ul className="mt-2 space-y-2">
        {files === null && <li className="text-sm text-slate-400">Cargando…</li>}
        {files?.map((f) => (
          <li key={f.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-violet-100 text-violet-700"><FileText size={16} /></span>
            <div className="min-w-0 flex-1">
              <button type="button" onClick={() => view(f)} className="block max-w-full truncate text-left text-sm font-medium text-slate-800 hover:text-indigo-600" title={f.fileName}>
                {f.fileName}
              </button>
              <p className="truncate text-xs text-slate-500">
                {[dealName(f.dealId), fmtDate(f.at), fmtSize(f.size)].filter(Boolean).join(' · ')}
                {f.note && ` · ${f.note}`}
              </p>
            </div>
            <Button size="icon" variant="secondary" className="!h-8 !w-8" title="Ver PDF" aria-label={`Ver ${f.fileName}`} onClick={() => view(f)}><Eye size={15} /></Button>
            <Button size="icon" variant="ghost" className="!h-8 !w-8 text-slate-400 hover:text-rose-600" title="Eliminar" aria-label={`Eliminar ${f.fileName}`} onClick={() => remove(f)}><Trash2 size={15} /></Button>
          </li>
        ))}
        {files?.length === 0 && !draft && (
          <li className="text-sm text-slate-500">{error ? `No se pudieron cargar: ${error}` : 'Sin cotizaciones adjuntas.'}</li>
        )}
      </ul>
    </section>
  )
}

import { randomUUID } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import type { Tenant } from '../../common/auth/tenant.js'
import { ApiError } from '../../common/errors/api-error.js'
import * as M from '../../common/utils/mappers.js'
import { AccessService } from '../../core/access.service.js'
import { SupabaseService } from '../../core/supabase.service.js'
import type { Tables } from '../../database/database.types.js'
import type { ContactFileBody } from './contacts.schemas.js'

export const CONTACT_FILES_BUCKET = 'contact-files'
export const MAX_PDF_BYTES = 10 * 1024 * 1024
/** Lo que dura el enlace para ver el PDF: suficiente para abrirlo, no para compartirlo */
const SIGNED_URL_SECONDS = 5 * 60

export interface UploadedPdf {
  buffer: Buffer
  originalname: string
  size: number
}

type FileRow = Tables<'contact_files'>

const toFile = (r: FileRow) => ({
  id: r.id,
  contactId: r.contact_id,
  dealId: r.deal_id,
  kind: r.kind,
  fileName: r.file_name,
  size: r.size_bytes,
  note: r.note,
  by: r.uploaded_by,
  at: r.created_at,
})

/**
 * Multer entrega el nombre del archivo leído como latin1: "CAÑETE" llega como "CAÃ\u0091ETE".
 * Se vuelve a leer como UTF-8 (si no era UTF-8 válido se deja como vino) y se quitan rutas y caracteres de control.
 */
export function cleanFileName(raw: string): string {
  let name = raw
  const utf8 = Buffer.from(raw, 'latin1').toString('utf8')
  if (!utf8.includes('�')) name = utf8
  name = name.split(/[\\/]/).pop() ?? ''
  name = name.replace(/[\u0000-\u001f\u007f]/g, '').trim()
  if (!name) name = 'cotizacion.pdf'
  if (!/\.pdf$/i.test(name)) name += '.pdf'
  return name.length > 200 ? name.slice(0, 196) + '.pdf' : name
}

/** Un PDF empieza con "%PDF-" (se tolera basura antes, dentro del primer KB, como hacen los lectores) */
export function looksLikePdf(buf: Buffer): boolean {
  return buf.subarray(0, 1024).includes('%PDF-')
}

/** Cotizaciones y otros PDF de la ficha del cliente. Mismo acceso que el contacto. */
@Injectable()
export class ContactFilesService {
  constructor(
    private readonly sb: SupabaseService,
    private readonly access: AccessService,
  ) {}

  private get bucket() {
    return this.sb.db.storage.from(CONTACT_FILES_BUCKET)
  }

  async list(t: Tenant, cid: string) {
    await this.access.contact(t, cid)
    const rows = await this.sb.q(
      this.sb.db.from('contact_files').select('*').eq('contact_id', cid).eq('company_id', t.companyId).order('created_at', { ascending: false }),
    )
    return rows.map(toFile)
  }

  /** Sube el PDF, guarda sus datos y deja la nota "Cotización enviada" en el historial */
  async upload(t: Tenant, cid: string, file: UploadedPdf | undefined, b: ContactFileBody) {
    await this.access.contact(t, cid)
    if (!file?.buffer?.length) throw new ApiError(400, 'Adjunta el archivo PDF de la cotización')
    if (file.size > MAX_PDF_BYTES) throw new ApiError(400, 'El PDF pesa más de 10 MB')
    if (!looksLikePdf(file.buffer)) throw new ApiError(400, 'El archivo no es un PDF')

    const { db, q } = this.sb
    let product: string | null = null
    if (b.dealId) {
      const deal = await q(db.from('deals').select('id, product').eq('id', b.dealId).eq('contact_id', cid).maybeSingle())
      if (!deal) throw new ApiError(400, 'Ese trato no es de este cliente')
      product = deal.product
    }

    const fileName = cleanFileName(file.originalname)
    const path = `${t.companyId}/${cid}/${randomUUID()}.pdf`
    const up = await this.bucket.upload(path, file.buffer, { contentType: 'application/pdf', upsert: false })
    if (up.error) throw new ApiError(502, 'No se pudo guardar el PDF. Intenta de nuevo.', { storage: up.error.message })

    try {
      const row = await q(
        db
          .from('contact_files')
          .insert({
            company_id: t.companyId,
            contact_id: cid,
            deal_id: b.dealId ?? null,
            kind: b.kind,
            file_name: fileName,
            storage_path: path,
            size_bytes: file.size,
            note: b.note,
            uploaded_by: t.actorId,
          })
          .select()
          .single(),
      )
      const label = b.kind === 'cotizacion' ? 'Cotización enviada' : 'Documento adjunto'
      const text = [`${label}${product ? ` de ${product}` : ''}: ${fileName}`, b.note].filter(Boolean).join('. ')
      const act = await q(
        db
          .from('activities')
          .insert({ company_id: t.companyId, contact_id: cid, type: b.kind === 'cotizacion' ? 'cotizacion' : 'nota', text, author_id: t.actorId })
          .select()
          .single(),
      )
      return { file: toFile(row), activity: M.activity(act) }
    } catch (e) {
      // Sin fila no hay forma de llegar al PDF: se borra para no dejarlo huérfano
      await this.bucket.remove([path])
      throw e
    }
  }

  /** Enlace temporal para abrir el PDF en el navegador */
  async url(t: Tenant, cid: string, fileId: string) {
    const row = await this.row(t, cid, fileId)
    const { data, error } = await this.bucket.createSignedUrl(row.storage_path, SIGNED_URL_SECONDS)
    if (error || !data) throw new ApiError(502, 'No se pudo abrir el PDF. Intenta de nuevo.', { storage: error?.message })
    return { url: data.signedUrl, fileName: row.file_name, expiresIn: SIGNED_URL_SECONDS }
  }

  async remove(t: Tenant, cid: string, fileId: string) {
    const row = await this.row(t, cid, fileId)
    await this.sb.q(this.sb.db.from('contact_files').delete().eq('id', row.id))
    await this.bucket.remove([row.storage_path])
  }

  /** Rutas de los PDF de un contacto (para borrarlos del bucket cuando se borra el contacto) */
  async pathsOf(cid: string): Promise<string[]> {
    const rows = await this.sb.q(this.sb.db.from('contact_files').select('storage_path').eq('contact_id', cid))
    return rows.map((r) => r.storage_path)
  }

  async removeObjects(paths: string[]) {
    if (paths.length) await this.bucket.remove(paths)
  }

  private async row(t: Tenant, cid: string, fileId: string) {
    await this.access.contact(t, cid)
    return this.sb.one(
      this.sb.db.from('contact_files').select('*').eq('id', fileId).eq('contact_id', cid).eq('company_id', t.companyId).maybeSingle(),
      'Archivo',
    )
  }
}

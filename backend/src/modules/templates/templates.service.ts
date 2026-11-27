import { Injectable } from '@nestjs/common'
import type { Tenant } from '../../common/auth/tenant.js'
import { SupabaseService } from '../../core/supabase.service.js'
import type { Tables } from '../../database/database.types.js'
import type { TemplateBody } from './templates.schemas.js'

export interface MessageTemplate {
  key: string
  kind: string
  label: string
  body: string
  updatedAt: string
}

const view = (r: Tables<'message_templates'>): MessageTemplate => ({
  key: r.key,
  kind: r.kind,
  label: r.label,
  body: r.body,
  updatedAt: r.updated_at,
})

/** Plantillas de WhatsApp propias del vendedor de la sesión (cada uno ve y edita solo las suyas) */
@Injectable()
export class TemplatesService {
  constructor(private readonly sb: SupabaseService) {}

  async list(t: Tenant) {
    const rows = await this.sb.q(
      this.sb.db.from('message_templates').select('*').eq('company_id', t.companyId).eq('seller_id', t.actorId).order('created_at'),
    )
    return rows.map(view)
  }

  /** Crea o reemplaza la plantilla `key` del vendedor */
  async save(t: Tenant, key: string, b: TemplateBody) {
    const row = await this.sb.q(
      this.sb.db
        .from('message_templates')
        .upsert({ company_id: t.companyId, seller_id: t.actorId, key, ...b }, { onConflict: 'company_id,seller_id,key' })
        .select()
        .single(),
    )
    return view(row)
  }

  /** Borra la plantilla propia, o restaura la por defecto si `key` es una de ellas */
  async remove(t: Tenant, key: string) {
    await this.sb.q(
      this.sb.db.from('message_templates').delete().eq('company_id', t.companyId).eq('seller_id', t.actorId).eq('key', key),
    )
  }
}

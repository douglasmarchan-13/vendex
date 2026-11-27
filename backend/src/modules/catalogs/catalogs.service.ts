import { Injectable } from '@nestjs/common'
import type { Tenant } from '../../common/auth/tenant.js'
import { ApiError } from '../../common/errors/api-error.js'
import { SupabaseService } from '../../core/supabase.service.js'
import type { PayMethodsBody, ProductBody, ProductPatch } from './catalogs.schemas.js'

export interface Catalogs {
  countries: Record<string, { code: string; name: string; local: string; display: string; prefix: string; doc: string }>
  goalShare: Record<string, number>
  sellers: Record<string, { id: string; name: string; short: string; country: string; active: boolean }>
  channels: string[]
  stages: { id: string; name: string; dot: string }[]
  stageNames: Record<string, string>
  products: { id: string; name: string; price: number }[]
  payMethods: Record<string, string[]>
  currencies: Record<string, { code: string; symbol: string; name: string; locale: string }>
}

/** Países, canales, etapas y monedas son globales; vendedores, productos y medios de pago, de cada empresa */
@Injectable()
export class CatalogsService {
  constructor(private readonly sb: SupabaseService) {}

  /** Todos los catálogos, con la misma forma que las constantes de frontend/src/data/mock.js */
  async load(t: Tenant): Promise<Catalogs> {
    const { db, q } = this.sb
    const cid = t.companyId
    const [countries, sellers, channels, stages, products, payMethods, currencies] = await Promise.all([
      q(db.from('countries').select('*').order('goal_share', { ascending: false })),
      q(db.from('sellers').select('id, name, short_name, country_code, active').eq('company_id', cid).order('created_at')),
      q(db.from('channels').select('name').order('position')),
      q(db.from('stages').select('*').order('position')),
      q(db.from('products').select('*').eq('company_id', cid).eq('active', true).order('position')),
      q(db.from('pay_methods').select('*').eq('company_id', cid).order('position')),
      q(db.from('currencies').select('code, symbol, name, locale').order('code')),
    ])

    const byCountry: Record<string, string[]> = {}
    for (const m of payMethods) (byCountry[m.country_code] ||= []).push(m.name)

    return {
      countries: Object.fromEntries(
        countries.map((c) => [
          c.code,
          { code: c.code, name: c.name, local: c.local_currency, display: c.display_currency, prefix: c.phone_prefix, doc: c.doc_label },
        ]),
      ),
      goalShare: Object.fromEntries(countries.map((c) => [c.code, Number(c.goal_share)])),
      sellers: Object.fromEntries(
        sellers.map((s) => [s.id, { id: s.id, name: s.name, short: s.short_name, country: s.country_code, active: s.active }]),
      ),
      channels: channels.map((c) => c.name),
      stages: stages.filter((s) => s.is_pipeline).map((s) => ({ id: s.id, name: s.name, dot: s.dot })),
      stageNames: Object.fromEntries(stages.map((s) => [s.id, s.name])),
      products: products.map((p) => ({ id: p.id, name: p.name, price: Number(p.price_usd) })),
      payMethods: byCountry,
      currencies: Object.fromEntries(currencies.map((c) => [c.code, c])),
    }
  }

  async createProduct(t: Tenant, b: ProductBody) {
    const { db, q } = this.sb
    const row = await q(
      db.from('products').insert({ company_id: t.companyId, name: b.name, price_usd: b.price, position: b.position ?? 999 }).select().single(),
    )
    return { id: row.id, name: row.name, price: Number(row.price_usd) }
  }

  async updateProduct(t: Tenant, id: string, b: ProductPatch) {
    const { db, q } = this.sb
    const row = await q(
      db
        .from('products')
        .update({ name: b.name, price_usd: b.price, position: b.position, active: b.active })
        .eq('id', id)
        .eq('company_id', t.companyId)
        .select()
        .maybeSingle(),
    )
    if (!row) throw new ApiError(404, 'Producto no encontrado')
    return { id: row.id, name: row.name, price: Number(row.price_usd), active: row.active }
  }

  /** Borrado lógico: los tratos guardan el nombre del producto como texto */
  async deactivateProduct(t: Tenant, id: string) {
    await this.updateProduct(t, id, { active: false })
  }

  async setPayMethods(t: Tenant, code: string, { methods }: PayMethodsBody) {
    const { db, q } = this.sb
    await q(db.from('pay_methods').delete().eq('company_id', t.companyId).eq('country_code', code))
    if (methods.length) {
      await q(
        db.from('pay_methods').insert(methods.map((name, i) => ({ company_id: t.companyId, country_code: code, name, position: i + 1 }))),
      )
    }
    return { country: code, methods }
  }
}

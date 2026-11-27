import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { LEGACY_COMPANY_ID } from '../src/common/auth/auth.types.js'
import { hashPassword } from '../src/common/auth/crypto.js'
import { SupabaseService } from '../src/core/supabase.service.js'
import { createTestApp } from './setup-app.js'

// Aislamiento multiempresa y por vendedor (REQUIRE_AUTH=true) sobre la semilla de demo:
//  · Empresa legado: gerente = Andrés (seller 'andres'), vendedora = Daniela (seller 'daniela').
//  · Empresa B: su propio gerente, vendedor y un contacto.

const run = Date.now().toString(36)
const PASS = 'Clave-de-prueba-2026'
const mailOf = (who: string) => `${who}.${run}@vendex-test.dev`
const B_ID = crypto.randomUUID()
const B_SELLER = `b-seller-${run}`
const B_CONTACT = `b-contact-${run}`

let app: INestApplication
let sb: SupabaseService
const api = () => request(app.getHttpServer())
const tokens: Record<'andres' | 'daniela' | 'gerenteB', string> = { andres: '', daniela: '', gerenteB: '' }
const as = (who: keyof typeof tokens) => ({ Authorization: `Bearer ${tokens[who]}` })

async function makeUser(email: string, role: 'gerente' | 'vendedor', companyId: string, sellerId: string) {
  const u = await sb.q(
    sb.db.from('users').insert({ email, password_hash: await hashPassword(PASS), name: email.split('.')[0]!, role, company_id: companyId }).select('id').single(),
  )
  await sb.q(sb.db.from('sellers').update({ user_id: u.id }).eq('id', sellerId))
  const r = await api().post('/api/auth/login').send({ email, password: PASS }).expect(200)
  return r.body.token as string
}

beforeAll(async () => {
  app = await createTestApp({ REQUIRE_AUTH: 'true', JWT_SECRET: 'test-secret-test-secret-test-secret-0123', ALLOW_DEMO_RESET: 'true' })
  sb = app.get(SupabaseService)
  await sb.rpc('seed_demo_data', {})

  await sb.q(sb.db.from('companies').insert({ id: B_ID, name: `Empresa B ${run}`, country_code: 'PE', seats: 5, status: 'activa' }))
  await sb.q(sb.db.from('sellers').insert({ id: B_SELLER, name: 'Beto B', short_name: 'Beto', country_code: 'PE', company_id: B_ID }))
  await sb.q(sb.db.from('contacts').insert({ id: B_CONTACT, name: 'Cliente de B', country_code: 'PE', owner_id: B_SELLER, company_id: B_ID }))

  tokens.andres = await makeUser(mailOf('andres'), 'gerente', LEGACY_COMPANY_ID, 'andres')
  tokens.daniela = await makeUser(mailOf('daniela'), 'vendedor', LEGACY_COMPANY_ID, 'daniela')
  tokens.gerenteB = await makeUser(mailOf('gerenteb'), 'gerente', B_ID, B_SELLER)
})

afterAll(async () => {
  if (sb) {
    await sb.db.from('sellers').update({ user_id: null }).in('id', ['andres', 'daniela'])
    await sb.db.from('contacts').delete().eq('company_id', B_ID)
    await sb.db.from('sellers').delete().eq('company_id', B_ID)
    await sb.db.from('users').delete().in('email', [mailOf('andres'), mailOf('daniela'), mailOf('gerenteb')])
    await sb.db.from('companies').delete().eq('id', B_ID)
    await sb.rpc('seed_demo_data', {})
  }
  await app?.close()
})

describe('vendedor: solo sus registros', () => {
  it('bootstrap trae solo lo de Daniela', async () => {
    const { body: s } = await api().get('/api/bootstrap').set(as('daniela')).expect(200)
    expect(s.sellerFilter).toBe('daniela')
    expect(s.contacts.length).toBeGreaterThan(0)
    expect(s.contacts.every((c: { owner: string }) => c.owner === 'daniela')).toBe(true)
    const mine = new Set(s.contacts.map((c: { id: string }) => c.id))
    expect(s.deals.every((d: { contactId: string }) => mine.has(d.contactId))).toBe(true)
    expect(s.payments.every((p: { contactId: string }) => mine.has(p.contactId))).toBe(true)
    expect(s.tasks.every((t: { sellerId: string }) => t.sellerId === 'daniela')).toBe(true)
    // ?vendedor_id no le sirve para ver a otro
    const other = await api().get('/api/bootstrap?vendedor_id=andres').set(as('daniela')).expect(200)
    expect(other.body.contacts.every((c: { owner: string }) => c.owner === 'daniela')).toBe(true)
  })

  it('no ve ni edita los contactos, tratos y cuotas de Andrés (404)', async () => {
    await api().get('/api/contacts/c1').set(as('daniela')).expect(404)
    await api().patch('/api/contacts/c1').set(as('daniela')).send({ city: 'X' }).expect(404)
    await api().post('/api/contacts/c1/activities').set(as('daniela')).send({ type: 'nota', text: 'x' }).expect(404)
    await api().post('/api/deals/d1/move').set(as('daniela')).send({ stage: 'cerrado' }).expect(404)
    await api().post('/api/payments/p6/register').set(as('daniela')).send({ amount: 1, method: 'Efectivo' }).expect(404)
    await api().post('/api/deals').set(as('daniela')).send({ contactId: 'c1', product: 'X', amount: 1, currency: 'USD' }).expect(404)
    const d1 = await sb.q(sb.db.from('deals').select('stage').eq('id', 'd1').single())
    expect(d1.stage).toBe('negociacion')
  })

  it('lo que crea queda a su nombre aunque pida otro dueño', async () => {
    const r = await api()
      .post('/api/contacts')
      .set(as('daniela'))
      .send({ name: `Prospecto ${run}`, country: 'PE', owner: 'andres' })
      .expect(201)
    expect(r.body.owner).toBe('daniela')
    const p = await api().patch(`/api/contacts/${r.body.id}`).set(as('daniela')).send({ owner: 'andres', city: 'Jaén' }).expect(200)
    expect(p.body).toMatchObject({ owner: 'daniela', city: 'Jaén' })
    const t = await api().post('/api/tasks').set(as('daniela')).send({ title: 'Llamar', sellerId: 'andres' }).expect(201)
    expect(t.body.sellerId).toBe('daniela')
  })

  it('no cambia meta, tipo de cambio, estrategia ni productos (403)', async () => {
    await api().put('/api/settings/goal').set(as('daniela')).send({ goalUSD: 1 }).expect(403)
    await api().patch('/api/settings/rates').set(as('daniela')).send({ PEN: 9 }).expect(403)
    await api().put('/api/strategy/s1').set(as('daniela')).send({ kind: 'enfoque', title: 'x', body: '' }).expect(403)
    await api().post('/api/catalogs/products').set(as('daniela')).send({ name: 'X', price: 1 }).expect(403)
    await api().get('/api/team/members').set(as('daniela')).expect(403)
    await api().get('/api/settings').set(as('daniela')).expect(200)
  })
})

describe('gerente: toda la empresa y filtro por vendedor', () => {
  it('sin filtro ve todo; con ?vendedor_id=daniela, solo lo de Daniela', async () => {
    const all = (await api().get('/api/bootstrap').set(as('andres')).expect(200)).body
    expect(all.sellerFilter).toBeNull()
    expect(new Set(all.contacts.map((c: { owner: string }) => c.owner)).size).toBeGreaterThan(1)
    expect(all.contacts.some((c: { id: string }) => c.id === B_CONTACT)).toBe(false)
    expect(Object.keys(all.catalogs.sellers)).not.toContain(B_SELLER)

    const dani = (await api().get('/api/bootstrap?vendedor_id=daniela').set(as('andres')).expect(200)).body
    expect(dani.sellerFilter).toBe('daniela')
    expect(dani.contacts.length).toBe(all.contacts.filter((c: { owner: string }) => c.owner === 'daniela').length)
    expect(dani.goalUSD).toBe(all.goalUSD)
  })

  it('reasigna un contacto a otro vendedor de su empresa, pero no a uno de otra', async () => {
    await api().patch('/api/contacts/c10').set(as('andres')).send({ owner: 'rodrigo' }).expect(200)
    await api().patch('/api/contacts/c10').set(as('andres')).send({ owner: B_SELLER }).expect(400)
    await api().patch('/api/contacts/c10').set(as('andres')).send({ owner: 'daniela' }).expect(200)
  })
})

describe('otra empresa: aislamiento total', () => {
  it('solo ve sus datos y su catálogo', async () => {
    const { body: s } = await api().get('/api/bootstrap').set(as('gerenteB')).expect(200)
    expect(s.contacts.map((c: { id: string }) => c.id)).toEqual([B_CONTACT])
    expect(s.deals).toHaveLength(0)
    expect(s.strategy).toHaveLength(0)
    expect(Object.keys(s.catalogs.sellers)).toEqual([B_SELLER])
    expect(Object.keys(s.catalogs.payMethods).length).toBeGreaterThan(0)
  })

  it('no puede leer ni tocar registros de la empresa legado (404 / 400 / 409)', async () => {
    await api().get('/api/contacts/c1').set(as('gerenteB')).expect(404)
    await api().delete('/api/contacts/c1').set(as('gerenteB')).expect(404)
    await api().get('/api/deals/d1').set(as('gerenteB')).expect(404)
    await api().delete('/api/alerts/a1').set(as('gerenteB')).expect(404)
    await api().post('/api/tasks/t1/toggle').set(as('gerenteB')).expect(404)
    await api().post('/api/tasks').set(as('gerenteB')).send({ title: 'x', sellerId: 'andres' }).expect(400)
    await api().post('/api/contacts').set(as('gerenteB')).send({ name: 'x', country: 'PE', owner: 'andres' }).expect(400)
    // Tarjeta con el id de una tarjeta de la empresa legado: no se la "roba"
    await api().put('/api/strategy/s1').set(as('gerenteB')).send({ kind: 'enfoque', title: 'Robada', body: '' }).expect(409)
    const s1 = await sb.q(sb.db.from('strategy_cards').select('title, company_id').eq('id', 's1').single())
    expect(s1).toMatchObject({ company_id: LEGACY_COMPANY_ID, title: 'Enfoque de la semana' })
    await api().post('/api/admin/reset').set(as('gerenteB')).expect(403)
    const c1 = await sb.q(sb.db.from('contacts').select('id').eq('id', 'c1').maybeSingle())
    expect(c1).not.toBeNull()
  })

  it('recargar la demo no borra los datos de otras empresas', async () => {
    await api().post('/api/admin/reset').set(as('andres')).expect(200)
    const b = await sb.q(sb.db.from('contacts').select('id').eq('id', B_CONTACT).maybeSingle())
    expect(b).not.toBeNull()
    const methods = await sb.q(sb.db.from('pay_methods').select('name').eq('company_id', B_ID))
    expect(methods.length).toBeGreaterThan(0)
  })

  it('su tipo de cambio, meta y medios de pago no afectan a la otra empresa', async () => {
    const before = (await api().get('/api/settings').set(as('andres')).expect(200)).body
    await api().patch('/api/settings/rates').set(as('gerenteB')).send({ PEN: 9.99 }).expect(200)
    await api().put('/api/settings/goal').set(as('gerenteB')).send({ goalUSD: 1234 }).expect(200)
    await api().put('/api/catalogs/pay-methods/PE').set(as('gerenteB')).send({ methods: ['Solo B'] }).expect(200)
    const after = (await api().get('/api/settings').set(as('andres')).expect(200)).body
    expect(after.rates.PEN).toBe(before.rates.PEN)
    expect(after.goalUSD).toBe(before.goalUSD)
    const cat = (await api().get('/api/catalogs').set(as('andres')).expect(200)).body
    expect(cat.payMethods.PE).not.toContain('Solo B')
    expect((await api().get('/api/settings').set(as('gerenteB')).expect(200)).body).toMatchObject({ goalUSD: 1234, rates: { PEN: 9.99 } })
  })

  it('los pospuestos de una empresa no pisan los de otra', async () => {
    await api().put('/api/snoozes/cobro-p6').set(as('andres')).send({ days: 2 }).expect(200)
    await api().put('/api/snoozes/cobro-p6').set(as('gerenteB')).send({ days: 5 }).expect(200)
    const a = (await api().get('/api/snoozes').set(as('andres')).expect(200)).body
    const b = (await api().get('/api/snoozes').set(as('gerenteB')).expect(200)).body
    expect(a['cobro-p6']).not.toBe(b['cobro-p6'])
  })
})

describe('equipo: desactivar usuarios', () => {
  it('el gerente desactiva y reactiva a una vendedora; no a sí mismo', async () => {
    const m = (await api().get('/api/team/members').set(as('andres')).expect(200)).body
    const dani = m.members.find((x: { sellerId: string }) => x.sellerId === 'daniela')
    const me = m.members.find((x: { sellerId: string }) => x.sellerId === 'andres')
    await api().patch(`/api/team/members/${me.id}`).set(as('andres')).send({ status: 'inactivo' }).expect(400)
    await api().patch(`/api/team/members/${dani.id}`).set(as('gerenteB')).send({ status: 'inactivo' }).expect(404)

    await api().patch(`/api/team/members/${dani.id}`).set(as('andres')).send({ status: 'inactivo' }).expect(200)
    await api().get('/api/auth/me').set(as('daniela')).expect(401)
    await api().post('/api/auth/login').send({ email: mailOf('daniela'), password: PASS }).expect(403)
    await api().patch(`/api/team/members/${dani.id}`).set(as('andres')).send({ status: 'activo' }).expect(200)
    await api().get('/api/auth/me').set(as('daniela')).expect(200)
  })
})

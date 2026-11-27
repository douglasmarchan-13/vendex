import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp } from './setup-app.js'

// Recorre los flujos principales de la API (antes scripts/smoke.js). ¡Modifica datos! Empieza y
// termina restaurando la semilla de demostración.

let app: INestApplication
const api = () => request(app.getHttpServer())
const todayLima = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })

beforeAll(async () => {
  app = await createTestApp({ REQUIRE_AUTH: 'false', ALLOW_DEMO_RESET: 'true' })
  await api().post('/api/admin/reset').expect(200)
})

afterAll(async () => {
  await api().post('/api/admin/reset')
  await app?.close()
})

describe('salud y estado inicial', () => {
  it('health + db', async () => {
    const r = await api().get('/api/health?db=1').expect(200)
    expect(r.body).toMatchObject({ ok: true, db: 'ok', timezone: 'America/Lima' })
  })

  it('bootstrap con la forma de seed()', async () => {
    const { body: s } = await api().get('/api/bootstrap').expect(200)
    expect(s.contacts).toHaveLength(30)
    expect(s.deals).toHaveLength(30)
    expect(s.payments).toHaveLength(22)
    expect(s.tasks).toHaveLength(10)
    expect(s.alerts).toHaveLength(7)
    expect(s.strategy).toHaveLength(4)
    expect(s.goalUSD).toBe(250000)
    expect(s.rates).toEqual({ USD: 1, PEN: 3.72, BOB: 6.96, VES: 245 })
    expect(s.plan.ticketUSD).toBe(45000)
    const c1 = s.contacts.find((c: { id: string }) => c.id === 'c1')
    expect(c1.timeline).toHaveLength(4)
    expect(c1.timeline[0].by).toBe('sistema')
    expect(Object.keys(s.catalogs.countries)).toHaveLength(3)
    expect(s.catalogs.stages).toHaveLength(5)
    expect(s.catalogs.products).toHaveLength(15)
  })

  it('filtros de contactos y tratos', async () => {
    expect((await api().get('/api/contacts?country=BO')).body).toHaveLength(7)
    expect((await api().get('/api/contacts?q=molino')).body.length).toBeGreaterThanOrEqual(5)
    expect((await api().get('/api/deals?stage=cerrado')).body).toHaveLength(9)
    expect((await api().get('/api/deals?country=VE')).body).toHaveLength(6)
  })
})

describe('venta completa: alta → cierre → plan de cobro → pagos', () => {
  let deal: { id: string; contactId: string }
  let plan: { id: string; paidAt?: string }[]

  it('addDeal con contacto nuevo', async () => {
    const r = await api()
      .post('/api/deals')
      .send({
        name: 'Prueba E2E', company: 'Molino Test', country: 'PE', phone: '+51 900 000 000', channel: 'WhatsApp',
        product: 'Motocultor 15 HP', amount: 1610, currency: 'USD', temp: 'caliente', nextDays: 1,
      })
      .expect(201)
    expect(r.body.contact.id).toBeTruthy()
    expect(r.body.contact.city).toBe('—')
    expect(r.body.deal.stage).toBe('nuevo')
    deal = r.body.deal
  })

  it('moveDeal → cerrado pide plan de cobro y registra la venta', async () => {
    const r = await api().post(`/api/deals/${deal.id}/move`).send({ stage: 'cerrado' }).expect(200)
    expect(r.body.deal.stage).toBe('cerrado')
    expect(r.body.deal.closedAt).toBeTruthy()
    expect(r.body.needsPlan).toBe(true)
    const c = await api().get(`/api/contacts/${deal.contactId}`).expect(200)
    expect(c.body.timeline[0].text).toMatch(/¡Compró! Motocultor/)
  })

  it('createPlan con primera cuota pagada', async () => {
    const r = await api()
      .post(`/api/deals/${deal.id}/payment-plan`)
      .send({
        items: [
          { n: 1, of: 2, label: 'Adelanto 50%', amount: 805, dueDays: 0 },
          { n: 2, of: 2, label: 'Saldo contra entrega', amount: 805, dueDays: 30 },
        ],
        firstPaid: 'Yape / Plin',
      })
      .expect(201)
    plan = r.body
    expect(plan).toHaveLength(2)
    expect(plan[0]!.paidAt).toBeTruthy()
    expect(plan[1]!.paidAt).toBeUndefined()
    const moved = await api().post(`/api/deals/${deal.id}/move`).send({ stage: 'cerrado' }).expect(200)
    expect(moved.body.needsPlan).toBe(false)
  })

  it('registerPayment parcial, luego total, luego 409', async () => {
    const pid = plan[1]!.id
    const partial = await api().post(`/api/payments/${pid}/register`).send({ amount: 300, method: 'Efectivo' }).expect(200)
    expect(partial.body.full).toBe(false)
    expect(partial.body.payment.amount).toBe(505)
    expect(partial.body.abono.label).toBe('Abono · Saldo contra entrega')
    const full = await api().post(`/api/payments/${pid}/register`).send({ amount: 505, method: 'Efectivo', ref: 'X-1' }).expect(200)
    expect(full.body.full).toBe(true)
    expect(full.body.payment.ref).toBe('X-1')
    const again = await api().post(`/api/payments/${pid}/register`).send({ amount: 1, method: 'Efectivo' }).expect(409)
    expect(again.body).toEqual({ error: 'Esta cuota ya está pagada' })
  })

  it('unpay revierte el pago y permite editar la cuota', async () => {
    const pid = plan[1]!.id
    const r = await api().post(`/api/payments/${pid}/unpay`).expect(200)
    expect(r.body.paidAt).toBeUndefined()
    const edited = await api().patch(`/api/payments/${pid}`).send({ label: 'Saldo final' }).expect(200)
    expect(edited.body).toMatchObject({ label: 'Saldo final', amount: 505 })
  })

  it('resumen de cartera y filtro por estado', async () => {
    const s = await api().get('/api/payments/summary').expect(200)
    expect(s.body.pendingUSD).toBeGreaterThan(0)
    expect(s.body.overdueUSD).toBeGreaterThan(0)
    const overdue = await api().get('/api/payments?status=vencido').expect(200)
    expect(overdue.body.length).toBeGreaterThan(0)
    expect(overdue.body.every((p: { status: string }) => p.status === 'vencido')).toBe(true)
  })
})

describe('contactos, tratos y agenda', () => {
  it('setTemp propaga a tratos abiertos', async () => {
    await api().put('/api/contacts/c2/temp').send({ temp: 'caliente' }).expect(200)
    expect((await api().get('/api/deals/d2')).body.temp).toBe('caliente')
  })

  it('PATCH solo cambia los campos enviados', async () => {
    const before = (await api().get('/api/contacts/c1')).body
    const r = await api().patch('/api/contacts/c1').send({ city: 'Moyobamba' }).expect(200)
    expect(r.body.city).toBe('Moyobamba')
    expect(r.body.company).toBe(before.company)
    expect(r.body.temp).toBe(before.temp)
    const d = await api().patch('/api/deals/d1').send({ nextAction: 'Llamar' }).expect(200)
    expect(d.body).toMatchObject({ nextAction: 'Llamar', amount: 117000, temp: 'caliente' })
  })

  it('snoozeDeal / pauseDeal', async () => {
    const d = await api().post('/api/deals/d3/snooze').send({ days: 3 }).expect(200)
    expect(new Date(d.body.nextAt).getTime()).toBeGreaterThan(Date.now())
    expect((await api().post('/api/deals/d3/pause').expect(200)).body.stage).toBe('pausa')
  })

  it('logActivity con autor de X-Seller-Id', async () => {
    const r = await api().post('/api/contacts/c5/activities').set('X-Seller-Id', 'daniela').send({ type: 'nota', text: 'Hola' }).expect(201)
    expect(r.body.by).toBe('daniela')
  })

  it('tareas: crear, completar (registra actividad), agenda de hoy', async () => {
    const t = await api().post('/api/tasks').send({ title: 'Llamar test', type: 'llamada', contactId: 'c4', hour: 18 }).expect(201)
    expect(t.body.sellerId).toBe('andres')
    const r = await api().post(`/api/tasks/${t.body.id}/toggle`).expect(200)
    expect(r.body.task.done).toBe(true)
    expect(r.body.activity.text).toMatch(/Tarea completada/)
    const today = await api().get(`/api/tasks?date=${todayLima()}`).expect(200)
    expect(today.body.length).toBeGreaterThanOrEqual(9)
    await api().delete(`/api/tasks/${t.body.id}`).expect(204)
  })

  it('alertas, estrategia, snoozes y ajustes', async () => {
    await api().delete('/api/alerts/a1').expect(204)
    await api().delete('/api/alerts/a1').expect(404)
    await api().put('/api/strategy/s9').send({ kind: 'promo', title: 'Nueva', body: 'x' }).expect(200)
    await api().delete('/api/strategy/s9').expect(204)
    const sn = await api().put('/api/snoozes/a2').send({ days: 2 }).expect(200)
    expect(sn.body.a2).toBeTruthy()
    await api().put('/api/settings/goal').send({ goalUSD: 300000 }).expect(200)
    await api().patch('/api/settings/plan').send({ closeRate: 30 }).expect(200)
    const s = await api().patch('/api/settings/rates').send({ PEN: 3.8, BOB: -1 }).expect(200)
    expect(s.body.goalUSD).toBe(300000)
    expect(s.body.plan.closeRate).toBe(30)
    expect(s.body.rates.PEN).toBe(3.8)
    expect(s.body.rates.BOB).toBe(6.96)
  })
})

describe('errores', () => {
  it('validación → 400 con detalle por campo', async () => {
    const r = await api().post('/api/deals').send({ product: '' }).expect(400)
    expect(r.body.error).toBe('Datos no válidos')
    expect(r.body.details).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'product' })]))
  })

  it('404 de registro y de ruta', async () => {
    expect((await api().get('/api/deals/no-existe').expect(404)).body).toEqual({ error: 'Trato no encontrado' })
    expect((await api().get('/api/no-existe').expect(404)).body).toEqual({ error: 'Ruta no encontrada: GET /api/no-existe' })
  })

  it('errores de las funciones SQL', async () => {
    expect((await api().post('/api/deals/d1/move').send({ stage: 'inventada' }).expect(400)).body).toEqual({ error: 'Etapa no válida' })
    await api().post('/api/deals/no-existe/move').send({ stage: 'cerrado' }).expect(404)
    await api().patch('/api/payments/p1').send({ label: 'x' }).expect(409)
  })

  it('JSON mal formado → 400', async () => {
    const r = await api().post('/api/deals').set('Content-Type', 'application/json').send('{malo').expect(400)
    expect(r.body).toEqual({ error: 'JSON mal formado' })
  })
})

describe('documentación', () => {
  it('Swagger en /api/docs-json', async () => {
    const r = await api().get('/api/docs-json').expect(200)
    expect(r.body.info.title).toBe('Vendex API')
    expect(r.body.paths['/api/deals/{id}/move']).toBeDefined()
    const body = r.body.paths['/api/payments/{id}/register'].post.requestBody.content['application/json'].schema
    expect(body.required).toEqual(expect.arrayContaining(['amount', 'method']))
  })
})

describe('modo autenticado (REQUIRE_AUTH=true)', () => {
  let secured: INestApplication
  beforeAll(async () => {
    secured = await createTestApp({ REQUIRE_AUTH: 'true', JWT_SECRET: 'test-secret-test-secret-test-secret-0123', ALLOW_DEMO_RESET: 'false' })
  })
  afterAll(() => secured?.close())

  it('sin token → 401; health sigue siendo público', async () => {
    const r = await request(secured.getHttpServer()).get('/api/bootstrap').expect(401)
    expect(r.body).toEqual({ error: 'Inicia sesión para continuar' })
    await request(secured.getHttpServer()).get('/api/health').expect(200)
  })

  it('token inválido → 401', async () => {
    await request(secured.getHttpServer()).get('/api/deals').set('Authorization', 'Bearer no-es-un-token').expect(401)
  })
})

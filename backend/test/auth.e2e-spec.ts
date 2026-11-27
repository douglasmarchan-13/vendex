import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { LEGACY_COMPANY_ID } from '../src/common/auth/auth.types.js'
import { hashPassword } from '../src/common/auth/crypto.js'
import { RateLimiter } from '../src/common/auth/rate-limiter.js'
import { MailService } from '../src/core/mail.service.js'
import { SupabaseService } from '../src/core/supabase.service.js'
import { createTestApp } from './setup-app.js'

// Login, recuperación de clave, invitaciones, roles y super admin (REQUIRE_AUTH=true).
// Crea una empresa y usuarios con correos únicos y los borra al terminar.

const run = Date.now().toString(36)
const mailOf = (who: string) => `${who}.${run}@vendex-test.dev`
const SA = { email: mailOf('superadmin'), password: 'SuperAdmin-2026' }
const GERENTE = { email: mailOf('gerente'), password: 'Gerente-2026x' }
const VENDEDOR = { email: mailOf('vendedor'), password: 'Vendedor-2026x' }
const LEGACY_MGR = { email: mailOf('andres'), password: 'Andres-2026xx' }
const DIRECTO = { email: mailOf('directo'), temp: 'Temporal-2026x', password: 'Propia-2026xyz' }

let app: INestApplication
let sb: SupabaseService
let mail: MailService
let companyId = ''
let directCompanyId = ''
const DIRECT_MGR = { email: mailOf('gerente-directo'), temp: 'Temporal-Gte-26', password: 'Propia-Gte-2026' }
const api = () => request(app.getHttpServer())
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` })

/** Token del último correo enviado a `to` (MAIL_DRIVER=console guarda los correos en outbox) */
function tokenFromMail(to: string) {
  const m = [...mail.outbox].reverse().find((x) => x.to === to)
  const t = m?.text.match(/token=([A-Za-z0-9_-]+)/)?.[1]
  if (!t) throw new Error(`No hay correo con token para ${to}`)
  return t
}

async function login(email: string, password: string) {
  const r = await api().post('/api/auth/login').send({ email, password }).expect(200)
  return r.body.token as string
}

beforeAll(async () => {
  app = await createTestApp({
    REQUIRE_AUTH: 'true',
    JWT_SECRET: 'test-secret-test-secret-test-secret-0123',
    MAIL_DRIVER: 'console',
    APP_URL: 'http://localhost:5173',
  })
  sb = app.get(SupabaseService)
  mail = app.get(MailService)
  // El super admin inicial se crea por SQL (create_super_admin); aquí, directo en la tabla
  await sb.q(
    sb.db.from('users').insert({ email: SA.email, password_hash: await hashPassword(SA.password), name: 'Super Test', role: 'super_admin' }),
  )
})

afterAll(async () => {
  if (sb) {
    const emails = [SA.email, GERENTE.email, VENDEDOR.email, LEGACY_MGR.email, DIRECTO.email, DIRECT_MGR.email, mailOf('extra'), mailOf('otro')]
    await sb.db.from('sellers').update({ user_id: null, email: null }).eq('id', 'andres')
    await sb.db.from('invitations').delete().in('email', emails)
    for (const cid of [companyId, directCompanyId].filter(Boolean)) {
      await sb.db.from('sellers').delete().eq('company_id', cid)
      await sb.db.from('users').delete().eq('company_id', cid)
      await sb.db.from('companies').delete().eq('id', cid)
    }
    await sb.db.from('users').delete().in('email', emails)
  }
  await app?.close()
})

describe('login', () => {
  it('sin token → 401 en cualquier ruta protegida', async () => {
    await api().get('/api/bootstrap').expect(401)
    await api().get('/api/auth/me').expect(401)
    await api().get('/api/bootstrap').set(bearer('no-es-un-jwt')).expect(401)
  })

  it('credenciales incorrectas → 401 con el mismo mensaje exista o no el correo', async () => {
    const a = await api().post('/api/auth/login').send({ email: SA.email, password: 'incorrecta-123' }).expect(401)
    const b = await api().post('/api/auth/login').send({ email: mailOf('nadie'), password: 'incorrecta-123' }).expect(401)
    expect(a.body.error).toBe(b.body.error)
  })

  it('super admin: entra al panel de plataforma pero no a la operación de ventas', async () => {
    const r = await api().post('/api/auth/login').send({ email: SA.email.toUpperCase(), password: SA.password }).expect(200)
    expect(r.body.user).toMatchObject({ role: 'super_admin', companyId: null, sellerId: null })
    expect(r.body.expiresAt).toBeTruthy()
    const t = r.body.token
    await api().get('/api/auth/me').set(bearer(t)).expect(200)
    await api().get('/api/platform/companies').set(bearer(t)).expect(200)
    await api().get('/api/bootstrap').set(bearer(t)).expect(403)
    await api().get('/api/team/members').set(bearer(t)).expect(403)
  })
})

describe('empresa nueva → invitación del gerente → registro', () => {
  let saToken = ''
  let gerenteToken = ''
  let inviteToken = ''

  it('super admin crea la empresa y se envía la invitación al gerente', async () => {
    saToken = await login(SA.email, SA.password)
    const r = await api()
      .post('/api/platform/companies')
      .set(bearer(saToken))
      .send({ name: `Empresa Test ${run}`, country: 'PE', plan: 'basico', seats: 2, manager: { email: GERENTE.email, name: 'Gina Gerente' } })
      .expect(201)
    companyId = r.body.company.id
    expect(r.body.mail).toBe('sent')
    expect(r.body.invitation).toMatchObject({ email: GERENTE.email, role: 'gerente', status: 'pendiente' })
    expect(r.body.invitation.token).toBeUndefined()
    inviteToken = tokenFromMail(GERENTE.email)
    expect(mail.outbox.at(-1)!.text).toContain('http://localhost:5173/registro?token=')

    // La empresa nace con su configuración, tipo de cambio y medios de pago
    const [settings, rates, methods] = await Promise.all([
      sb.q(sb.db.from('company_settings').select('company_id').eq('company_id', companyId)),
      sb.q(sb.db.from('company_currency_rates').select('code').eq('company_id', companyId)),
      sb.q(sb.db.from('pay_methods').select('name').eq('company_id', companyId)),
    ])
    expect(settings).toHaveLength(1)
    expect(rates.length).toBeGreaterThan(0)
    expect(methods.length).toBeGreaterThan(0)
  })

  it('el enlace muestra correo, rol y empresa', async () => {
    const r = await api().get(`/api/invitations/${inviteToken}`).expect(200)
    expect(r.body).toMatchObject({ email: GERENTE.email, role: 'gerente', companyName: `Empresa Test ${run}` })
    await api().get('/api/invitations/token-que-no-existe-0000000000').expect(404)
  })

  it('aceptar: valida la contraseña, crea la cuenta y deja la sesión iniciada', async () => {
    await api().post(`/api/invitations/${inviteToken}/accept`).send({ name: 'Gina Gerente', password: 'corta' }).expect(400)
    const r = await api()
      .post(`/api/invitations/${inviteToken}/accept`)
      .send({ name: 'Gina Gerente', password: GERENTE.password })
      .expect(201)
    expect(r.body.user).toMatchObject({ email: GERENTE.email, role: 'gerente', companyId })
    expect(r.body.user.sellerId).toBeTruthy()
    gerenteToken = r.body.token
    // Un solo uso
    await api().post(`/api/invitations/${inviteToken}/accept`).send({ name: 'Otra', password: GERENTE.password }).expect(410)
    await api().get(`/api/invitations/${inviteToken}`).expect(410)
  })

  it('el gerente no entra al panel de plataforma', async () => {
    await api().get('/api/platform/companies').set(bearer(gerenteToken)).expect(403)
  })

  it('gerente invita a un vendedor de su empresa; cupos y duplicados', async () => {
    const r = await api().post('/api/team/invitations').set(bearer(gerenteToken)).send({ email: VENDEDOR.email, role: 'vendedor' }).expect(201)
    expect(r.body.invitation).toMatchObject({ companyId, role: 'vendedor' })
    expect(mail.outbox.at(-1)!.text).toContain('Gina Gerente te invitó')
    await api().post('/api/team/invitations').set(bearer(gerenteToken)).send({ email: VENDEDOR.email, role: 'vendedor' }).expect(409)
    // seats = 2: gerente activo + invitación pendiente
    const full = await api().post('/api/team/invitations').set(bearer(gerenteToken)).send({ email: mailOf('extra'), role: 'vendedor' }).expect(409)
    expect(full.body.error).toMatch(/cupos/)
    await api().post('/api/team/invitations').set(bearer(gerenteToken)).send({ email: 'no-es-correo', role: 'vendedor' }).expect(400)
    await api().post('/api/team/invitations').set(bearer(gerenteToken)).send({ email: mailOf('otro'), role: 'super_admin' }).expect(400)
  })

  it('reenviar invalida el enlace anterior', async () => {
    const old = tokenFromMail(VENDEDOR.email)
    const list = await api().get('/api/team/invitations').set(bearer(gerenteToken)).expect(200)
    const inv = list.body.find((i: { email: string }) => i.email === VENDEDOR.email)
    await api().post(`/api/team/invitations/${inv.id}/resend`).set(bearer(gerenteToken)).expect(200)
    const fresh = tokenFromMail(VENDEDOR.email)
    expect(fresh).not.toBe(old)
    await api().get(`/api/invitations/${old}`).expect(404)
    await api().get(`/api/invitations/${fresh}`).expect(200)
  })

  it('el vendedor activa su cuenta y no ve la gestión del equipo', async () => {
    const r = await api()
      .post(`/api/invitations/${tokenFromMail(VENDEDOR.email)}/accept`)
      .send({ name: 'Víctor Vendedor', password: VENDEDOR.password })
      .expect(201)
    expect(r.body.user).toMatchObject({ role: 'vendedor', companyId })
    const t = r.body.token
    await api().get('/api/team/members').set(bearer(t)).expect(403)
    await api().post('/api/team/invitations').set(bearer(t)).send({ email: mailOf('otro'), role: 'vendedor' }).expect(403)
    await api().get('/api/platform/companies').set(bearer(t)).expect(403)
    await api().get('/api/auth/me').set(bearer(t)).expect(200)

    const m = await api().get('/api/team/members').set(bearer(gerenteToken)).expect(200)
    expect(m.body.members).toHaveLength(2)
    expect(m.body.seats).toEqual({ total: 2, used: 2 })
  })

  it('suspender la empresa corta el acceso de sus usuarios', async () => {
    await api().patch(`/api/platform/companies/${companyId}`).set(bearer(saToken)).send({ status: 'suspendida' }).expect(200)
    await api().get('/api/auth/me').set(bearer(gerenteToken)).expect(403)
    await api().post('/api/auth/login').send(GERENTE).expect(403)
    await api().patch(`/api/platform/companies/${companyId}`).set(bearer(saToken)).send({ status: 'activa' }).expect(200)
    await api().get('/api/auth/me').set(bearer(gerenteToken)).expect(200)
  })

  it('el listado de empresas muestra usuarios activos y gerentes', async () => {
    const r = await api().get('/api/platform/companies').set(bearer(saToken)).expect(200)
    const c = r.body.find((x: { id: string }) => x.id === companyId)
    expect(c).toMatchObject({ activeUsers: 2, pendingInvitations: 0, status: 'activa' })
    expect(c.managers).toEqual([{ name: 'Gina Gerente', email: GERENTE.email }])
  })

  it('el método de alta lo fija el super admin: con "invitacion" no hay alta directa y viceversa', async () => {
    app.get(RateLimiter).reset()
    const body = { email: DIRECTO.email, name: 'Diana Directa', role: 'vendedor', password: DIRECTO.temp }
    let m = await api().get('/api/team/members').set(bearer(gerenteToken)).expect(200)
    expect(m.body.onboarding).toBe('invitacion')
    const blocked = await api().post('/api/team/members').set(bearer(gerenteToken)).send(body).expect(409)
    expect(blocked.body.error).toMatch(/invitación por correo/)

    // El gerente no puede cambiar el método; el super admin sí
    await api().patch(`/api/platform/companies/${companyId}`).set(bearer(gerenteToken)).send({ onboarding: 'directa' }).expect(403)
    const r = await api().patch(`/api/platform/companies/${companyId}`).set(bearer(saToken)).send({ onboarding: 'directa' }).expect(200)
    expect(r.body.onboarding).toBe('directa')
    m = await api().get('/api/team/members').set(bearer(gerenteToken)).expect(200)
    expect(m.body.onboarding).toBe('directa')
    await api().post('/api/team/invitations').set(bearer(gerenteToken)).send({ email: mailOf('otro'), role: 'vendedor' }).expect(409)
    await api().patch(`/api/platform/companies/${companyId}`).set(bearer(saToken)).send({ onboarding: 'nada' }).expect(400)
  })

  it('alta directa: cuenta activa con clave temporal, sin correo; cupos y duplicados', async () => {
    await api().patch(`/api/platform/companies/${companyId}`).set(bearer(saToken)).send({ seats: 3 }).expect(200)
    const before = mail.outbox.length
    const body = { email: DIRECTO.email, name: 'Diana Directa', role: 'vendedor', password: DIRECTO.temp }

    await api().post('/api/team/members').set(bearer(gerenteToken)).send({ ...body, password: 'corta' }).expect(400)
    await api().post('/api/team/members').set(bearer(gerenteToken)).send({ ...body, name: '' }).expect(400)
    await api().post('/api/team/members').set(bearer(gerenteToken)).send({ ...body, role: 'super_admin' }).expect(400)

    const r = await api().post('/api/team/members').set(bearer(gerenteToken)).send(body).expect(201)
    expect(r.body.member).toMatchObject({ email: DIRECTO.email, role: 'vendedor', status: 'activo', mustChangePassword: true })
    expect(r.body.member.sellerId).toBeTruthy()
    expect(JSON.stringify(r.body)).not.toContain(DIRECTO.temp)
    expect(mail.outbox.length).toBe(before)

    await api().post('/api/team/members').set(bearer(gerenteToken)).send(body).expect(409)
    const full = await api().post('/api/team/members').set(bearer(gerenteToken)).send({ ...body, email: mailOf('extra') }).expect(409)
    expect(full.body.error).toMatch(/cupos/)
    await api().post('/api/team/members').set(bearer(saToken)).send({ ...body, email: mailOf('otro') }).expect(403)

    const m = await api().get('/api/team/members').set(bearer(gerenteToken)).expect(200)
    expect(m.body.seats).toEqual({ total: 3, used: 3 })
    expect(m.body.members.find((x: { email: string }) => x.email === DIRECTO.email)).toMatchObject({ mustChangePassword: true })
  })

  it('primer inicio con clave temporal: solo puede cambiarla; después entra normal', async () => {
    const r = await api().post('/api/auth/login').send({ email: DIRECTO.email, password: DIRECTO.temp }).expect(200)
    expect(r.body.user).toMatchObject({ mustChangePassword: true, role: 'vendedor' })
    const temp = r.body.token

    const blocked = await api().get('/api/bootstrap').set(bearer(temp)).expect(403)
    expect(blocked.body.details).toEqual({ code: 'password_change_required' })
    await api().get('/api/auth/me').set(bearer(temp)).expect(200)

    const change = (currentPassword: string, newPassword: string) =>
      api().post('/api/auth/change-password').set(bearer(temp)).send({ currentPassword, newPassword })
    await change('no-es-la-clave-1', DIRECTO.password).expect(400)
    await change(DIRECTO.temp, DIRECTO.temp).expect(400)
    await change(DIRECTO.temp, 'corta').expect(400)
    const ok = await change(DIRECTO.temp, DIRECTO.password).expect(200)
    expect(ok.body.user.mustChangePassword).toBe(false)

    // La sesión con la clave temporal deja de valer; la nueva entra a la operación
    await api().get('/api/auth/me').set(bearer(temp)).expect(401)
    await api().get('/api/bootstrap').set(bearer(ok.body.token)).expect(200)
    await api().post('/api/auth/login').send({ email: DIRECTO.email, password: DIRECTO.temp }).expect(401)
    const again = await api().post('/api/auth/login').send({ email: DIRECTO.email, password: DIRECTO.password }).expect(200)
    expect(again.body.user.mustChangePassword).toBe(false)
  })
})

describe('recuperación de contraseña', () => {
  it('correo inexistente: misma respuesta y no se envía nada', async () => {
    const before = mail.outbox.length
    const r = await api().post('/api/auth/forgot-password').send({ email: mailOf('nadie') }).expect(200)
    expect(r.body).toEqual({ ok: true })
    expect(mail.outbox.length).toBe(before)
  })

  it('enlace de un solo uso: cambia la clave y cierra las sesiones anteriores', async () => {
    const oldSession = await login(GERENTE.email, GERENTE.password)
    await api().post('/api/auth/forgot-password').send({ email: GERENTE.email }).expect(200)
    await new Promise((r) => setTimeout(r, 50)) // el correo sale en segundo plano
    const token = tokenFromMail(GERENTE.email)
    expect(mail.outbox.at(-1)!.text).toContain('/restablecer-clave?token=')

    const check = await api().get(`/api/auth/reset-password/${token}`).expect(200)
    expect(check.body.email).toBe(GERENTE.email)

    await api().post('/api/auth/reset-password').send({ token, password: 'sololetrasaqui' }).expect(400)
    await api().post('/api/auth/reset-password').send({ token, password: 'Nueva-Clave-2026' }).expect(200)
    await api().post('/api/auth/reset-password').send({ token, password: 'Otra-Clave-2026' }).expect(400)
    await api().get(`/api/auth/reset-password/${token}`).expect(400)

    await api().get('/api/auth/me').set(bearer(oldSession)).expect(401)
    await api().post('/api/auth/login').send(GERENTE).expect(401)
    const fresh = await login(GERENTE.email, 'Nueva-Clave-2026')
    await api().get('/api/auth/me').set(bearer(fresh)).expect(200)
  })

  it('un segundo pedido dentro de 1 minuto no envía otro correo', async () => {
    const before = mail.outbox.length
    await api().post('/api/auth/forgot-password').send({ email: GERENTE.email }).expect(200)
    await new Promise((r) => setTimeout(r, 50))
    expect(mail.outbox.length).toBe(before)
  })
})

describe('bloqueo por intentos fallidos', () => {
  it('5 claves incorrectas bloquean la cuenta aunque luego se use la correcta', async () => {
    app.get(RateLimiter).reset()
    for (let i = 0; i < 5; i++) await api().post('/api/auth/login').send({ email: VENDEDOR.email, password: 'mala-clave-1' }).expect(401)
    await api().post('/api/auth/login').send(VENDEDOR).expect(429)
    await sb.q(sb.db.from('users').update({ locked_until: null }).eq('email', VENDEDOR.email))
    await login(VENDEDOR.email, VENDEDOR.password)
  })
})

describe('empresa legado: enlazar un vendedor existente', () => {
  it('super admin invita a Andrés como gerente y su cuenta queda unida a sus clientes', async () => {
    app.get(RateLimiter).reset()
    const sa = await login(SA.email, SA.password)
    const r = await api()
      .post(`/api/platform/companies/${LEGACY_COMPANY_ID}/invitations`)
      .set(bearer(sa))
      .send({ email: LEGACY_MGR.email, name: 'Andrés Ramírez', sellerId: 'andres' })
      .expect(201)
    expect(r.body.invitation.sellerId).toBe('andres')

    const acc = await api()
      .post(`/api/invitations/${tokenFromMail(LEGACY_MGR.email)}/accept`)
      .send({ name: 'Andrés Ramírez', password: LEGACY_MGR.password })
      .expect(201)
    expect(acc.body.user).toMatchObject({ role: 'gerente', sellerId: 'andres', companyId: LEGACY_COMPANY_ID })

    const boot = await api().get('/api/bootstrap').set(bearer(acc.body.token)).expect(200)
    expect(boot.body.contacts.length).toBeGreaterThan(0)

    // Ya no aparece como vendedor sin usuario, y no se puede volver a enlazar
    const m = await api().get('/api/team/members').set(bearer(acc.body.token)).expect(200)
    expect(m.body.unlinkedSellers.map((s: { id: string }) => s.id)).not.toContain('andres')
    await api()
      .post('/api/team/invitations')
      .set(bearer(acc.body.token))
      .send({ email: mailOf('otro'), role: 'vendedor', sellerId: 'andres' })
      .expect(409)
  })
})

describe('empresa nueva con alta directa del gerente', () => {
  it('el gerente se crea activo con clave temporal y sin correo; debe cambiarla al entrar', async () => {
    app.get(RateLimiter).reset()
    const sa = await login(SA.email, SA.password)
    const base = { name: `Empresa Directa ${run}`, country: 'PE', plan: 'basico', onboarding: 'directa' }

    // Con alta directa, el gerente necesita nombre y contraseña temporal
    await api().post('/api/platform/companies').set(bearer(sa)).send({ ...base, manager: { email: DIRECT_MGR.email } }).expect(400)

    const before = mail.outbox.length
    const r = await api()
      .post('/api/platform/companies')
      .set(bearer(sa))
      .send({ ...base, manager: { email: DIRECT_MGR.email, name: 'Gael Directo', password: DIRECT_MGR.temp } })
      .expect(201)
    directCompanyId = r.body.company.id
    expect(r.body.company.onboarding).toBe('directa')
    expect(r.body.member).toMatchObject({ email: DIRECT_MGR.email, role: 'gerente', mustChangePassword: true })
    expect(r.body.invitation).toBeUndefined()
    expect(mail.outbox.length).toBe(before)

    const first = await api().post('/api/auth/login').send({ email: DIRECT_MGR.email, password: DIRECT_MGR.temp }).expect(200)
    expect(first.body.user).toMatchObject({ role: 'gerente', mustChangePassword: true })
    await api().get('/api/team/members').set(bearer(first.body.token)).expect(403)
    const ok = await api()
      .post('/api/auth/change-password')
      .set(bearer(first.body.token))
      .send({ currentPassword: DIRECT_MGR.temp, newPassword: DIRECT_MGR.password })
      .expect(200)
    const m = await api().get('/api/team/members').set(bearer(ok.body.token)).expect(200)
    expect(m.body.onboarding).toBe('directa')

    // Otro gerente para la misma empresa existente: también por alta directa
    await api().post(`/api/platform/companies/${directCompanyId}/invitations`).set(bearer(sa)).send({ email: mailOf('otro'), name: 'Otro' }).expect(400)
  })
})

describe('modo demo (REQUIRE_AUTH=false)', () => {
  let demo: INestApplication
  beforeAll(async () => {
    demo = await createTestApp({ REQUIRE_AUTH: 'false', MAIL_DRIVER: 'console' })
  })
  afterAll(async () => {
    await demo?.close()
  })

  it('sin token funciona la operación, pero el panel de plataforma exige sesión', async () => {
    const d = () => request(demo.getHttpServer())
    await d().get('/api/bootstrap').expect(200)
    await d().get('/api/team/members').expect(200)
    await d().get('/api/platform/companies').expect(401)
    await d().get('/api/auth/me').expect(401)
  })
})

import { passwordProblem, generatePassword } from '../auth/passwords'
import { isEmail } from '../components/people'
import { toUSD, convert, fmtMoney, DEFAULT_RATES } from './money'
import { addMonths, buildPlan, finalizePlan, planProblems } from './cobranza'

describe('passwordProblem (alta directa en Equipo)', () => {
  it('exige 10+ caracteres, letra y número', () => {
    expect(passwordProblem('corta1')).toMatch(/10 caracteres/)
    expect(passwordProblem('solamenteletras')).toMatch(/letra y un número/)
    expect(passwordProblem('1234567890')).toMatch(/letra y un número/)
    expect(passwordProblem('valida12345')).toBeNull()
  })
  it('rechaza más de 72 bytes y confirmaciones distintas', () => {
    expect(passwordProblem('a1' + 'x'.repeat(80))).toMatch(/demasiado larga/)
    expect(passwordProblem('valida12345', 'otra12345678')).toMatch(/no coinciden/)
    expect(passwordProblem('valida12345', 'valida12345')).toBeNull()
  })
})

describe('generatePassword', () => {
  it('siempre cumple las reglas, respeta el largo y evita caracteres confusos', () => {
    for (let i = 0; i < 200; i++) {
      const p = generatePassword()
      expect(p).toHaveLength(16)
      expect(passwordProblem(p)).toBeNull()
      expect(p).not.toMatch(/[0O1lI]/)
    }
    expect(generatePassword(24)).toHaveLength(24)
  })
})

describe('isEmail', () => {
  it.each([
    ['nombre@empresa.com', true],
    ['  a@b.pe ', true],
    ['sin-arroba.com', false],
    ['a@b.c', false],
    ['', false],
    [undefined, false],
  ])('%s → %s', (e, ok) => {
    expect(isEmail(e)).toBe(ok)
  })
})

describe('money', () => {
  it('convierte entre monedas con las tasas', () => {
    expect(toUSD(372, 'PEN', DEFAULT_RATES)).toBeCloseTo(100)
    expect(convert(100, 'USD', 'BOB', DEFAULT_RATES)).toBeCloseTo(696)
    expect(convert(372, 'PEN', 'BOB', DEFAULT_RATES)).toBeCloseTo(696)
  })
  it('formatea con símbolo y en compacto', () => {
    expect(fmtMoney(44000, 'USD', { compact: true })).toBe('US$ 44 k')
    expect(fmtMoney(2500000, 'USD', { compact: true })).toBe('US$ 2.5 M')
    expect(fmtMoney(1500, 'PEN')).toMatch(/^S\/ 1.?500$/)
  })
})

describe('buildPlan', () => {
  const sum = (p) => Math.round(p.reduce((s, x) => s + x.amount, 0) * 100) / 100
  it('contado, mitad y cuotas suman el total exacto', () => {
    expect(buildPlan(1000, 'contado')).toHaveLength(1)
    expect(sum(buildPlan(1000.01, 'mitad'))).toBe(1000.01)
    const c = buildPlan(10000, 'cuotas', { initialPct: 30, n: 3 })
    expect(c).toHaveLength(4)
    expect(c[0].amount).toBe(3000)
    expect(sum(c)).toBe(10000)
    expect(sum(buildPlan(999.99, 'cuotas', { initialPct: 0, n: 7 }))).toBe(999.99)
  })
  it('cuotas mensuales desde la fecha elegida, conservando el día', () => {
    const c = buildPlan(3000, 'cuotas', { initialPct: 0, n: 3, firstDate: '2026-12-31' })
    expect(c.map((x) => x.date)).toEqual(['2026-12-31', '2027-01-31', '2027-02-28'])
    expect(sum(buildPlan(1000, 'personalizado'))).toBe(1000)
  })
})

describe('addMonths', () => {
  it('ajusta al último día del mes', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15')
  })
})

describe('finalizePlan / planProblems', () => {
  it('ordena por fecha y renumera etiquetas automáticas', () => {
    const out = finalizePlan([
      { n: 2, of: 2, label: 'Pago 2 de 2', amount: 600, date: '2027-02-15' },
      { n: 1, of: 2, label: 'Pago 1 de 2', amount: 300, date: '2026-11-27' },
      { n: 3, of: 3, label: 'Pago 3 de 3', amount: 100, date: '2026-12-20' },
    ])
    expect(out.map((x) => [x.label, x.date, x.n, x.of])).toEqual([
      ['Pago 1 de 3', '2026-11-27', 1, 3],
      ['Pago 2 de 3', '2026-12-20', 2, 3],
      ['Pago 3 de 3', '2027-02-15', 3, 3],
    ])
  })
  it('conserva la inicial (n = 0) y las etiquetas propias', () => {
    const out = finalizePlan([
      { n: 1, of: 1, label: 'Cuota 1 de 1', amount: 700, date: '2027-01-10' },
      { n: 0, of: 1, label: 'Inicial 30%', amount: 300, date: '2026-11-27' },
      { n: 2, of: 2, label: 'Al recibir la cosecha', amount: 100, date: '2027-05-01' },
    ])
    expect(out.map((x) => [x.label, x.n, x.of])).toEqual([['Inicial 30%', 0, 2], ['Cuota 1 de 2', 1, 2], ['Al recibir la cosecha', 2, 2]])
  })
  it('exige que los pagos sumen el total, con fecha y monto', () => {
    const ok = [{ label: 'A', amount: 400, date: '2026-12-01' }, { label: 'B', amount: '600', date: '2027-02-15' }]
    expect(planProblems(ok, 1000)).toEqual([])
    expect(planProblems(ok, 1200)[0]).toMatch(/Faltan/)
    expect(planProblems([{ label: 'A', amount: 0, date: '' }], 0).length).toBeGreaterThan(0)
  })
})

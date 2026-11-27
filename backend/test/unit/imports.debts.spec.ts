import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { cutoffFromHeader, parseDebtsWorkbook, parseInstallmentLine } from '../../src/modules/imports/excel/debts.js'

const OPTS = { today: '2026-11-27', currentYear: 2026 }

describe('parseInstallmentLine', () => {
  it.each([
    ['(20,000) 21/DIC/2026', { amount: 20000, dueDate: '2026-12-21', markedLate: false }],
    ['(10,000) 27/JUL/2026 - ATRASADO', { amount: 10000, dueDate: '2026-07-27', markedLate: true }],
    ['(22,500) 30/JUN/2027', { amount: 22500, dueDate: '2027-06-30', markedLate: false }],
    ['25/06/2026 - ATRASADO', { amount: null, dueDate: '2026-06-25', markedLate: true }],
    ['(S/ 1.500,50) 05/ENE/2027', { amount: 1500.5, dueDate: '2027-01-05', markedLate: false }],
  ])('%s', (line, expected) => {
    expect(parseInstallmentLine(line, 2026)).toEqual(expected)
  })

  it('texto sin fecha', () => {
    expect(parseInstallmentLine('PENDIENTE', 2026)).toBeNull()
  })
})

it('fecha de corte desde el encabezado', () => {
  expect(cutoffFromHeader('PAGOS A DICIEMBRE 2026')).toBe('2026-12-31')
  expect(cutoffFromHeader('SALDO A FEBRERO DE 2027')).toBe('2027-02-28')
  expect(cutoffFromHeader('MONTO')).toBeNull()
})

/** Mismo formato que "DEUDAS HASTA DICIEMBRE 2026.xlsx" */
function sample() {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Pagos a diciembre 2026')
  ws.addRow(['VENDEDOR - MAQ. AGRÍCOLA'])
  ws.mergeCells('A1:E1')
  ws.addRow([])
  ws.addRow(['AÑO', 'CLIENTE', 'COMPROBANTE', 'VENCIMIENTOS', 'PAGOS A DICIEMBRE 2026'])
  const rows = [
    [2025, 'CLIENTE UNO', 'BG05 - 00010236', '25/06/2026 - ATRASADO', 50000],
    [2026, 'CLIENTE DOS', 'BG05 - 00011980', '(10,000) 27/JUL/2026 - ATRASADO\n(20,000) 21/DIC/2026\n(70,000) 26/JUL/2027', 30000],
    [2026, 'CLIENTE TRES', 'EG05 - 00002682', '(20,000) 31/JUL/2026 - ATRASADO\n(22,500) 15/DIC/2026\n(22,500) 30/JUN/2027', 40500],
  ]
  for (const r of rows) ws.addRow(r).getCell(5).numFmt = '"S/ " #,##0.00'
  ws.addRow(['', '', '', '', { formula: 'SUM(E4:E6)', result: 120500 }]).getCell(5).numFmt = '"S/ " #,##0.00'
  return wb
}

describe('parseDebtsWorkbook', () => {
  const { sheets, rows } = parseDebtsWorkbook(sample(), OPTS)
  const byName = (n: string) => rows.find((r) => r.name === n)!

  it('encabezado, título, fecha de corte; la fila de totales no es una deuda', () => {
    expect(sheets[0]).toMatchObject({ headerRow: 3, cutoff: '2026-12-31', title: 'VENDEDOR - MAQ. AGRÍCOLA', rows: 3 })
    expect(rows).toHaveLength(3)
  })

  it('una sola fecha sin monto: el monto es la columna de pagos', () => {
    expect(byName('CLIENTE UNO')).toMatchObject({
      currency: 'PEN',
      country: 'PE',
      year: 2025,
      product: 'Venta BG05 - 00010236',
      installments: [{ n: 1, of: 1, label: 'Saldo pendiente', amount: 50000, dueDate: '2026-06-25' }],
      abonos: [],
      invalid: false,
    })
  })

  it('cuotas que cuadran con la columna: sin abono, incluye las de 2027', () => {
    const r = byName('CLIENTE DOS')
    expect(r.installments.map((q) => [q.label, q.amount, q.dueDate])).toEqual([
      ['Cuota 1 de 3', 10000, '2026-07-27'],
      ['Cuota 2 de 3', 20000, '2026-12-21'],
      ['Cuota 3 de 3', 70000, '2027-07-26'],
    ])
    expect(r.abonos).toEqual([])
    expect(r.total).toBe(100000)
  })

  it('la columna dice menos que las cuotas: la diferencia es un abono en la cuota más antigua', () => {
    const r = byName('CLIENTE TRES')
    expect(r.abonos).toEqual([{ n: 1, label: 'Cuota 1 de 3', amount: 2000, dueDate: '2026-07-31' }])
    expect(r.installments.map((q) => q.amount)).toEqual([18000, 22500, 22500])
    expect(r.total).toBe(65000)
    expect(r.issues.some((i) => /abono de 2000/.test(i.message))).toBe(true)
  })
})

const REAL = resolve(import.meta.dirname, '../../../DEUDAS HASTA DICIEMBRE 2026.xlsx')
it.runIf(existsSync(REAL))('Excel real de deudas', async () => {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(REAL)
  const { rows } = parseDebtsWorkbook(wb, OPTS)
  expect(rows).toHaveLength(5)
  expect(rows.every((r) => !r.invalid && r.currency === 'PEN')).toBe(true)
  // Lo pendiente hasta diciembre 2026 coincide con la columna (S/ 180,500 en total)
  const dueByDec = rows.reduce((s, r) => s + r.installments.filter((q) => q.dueDate <= '2026-12-31').reduce((a, q) => a + q.amount, 0), 0)
  expect(dueByDec).toBe(180500)
  expect(rows.flatMap((r) => r.abonos)).toEqual([{ n: 1, label: 'Cuota 1 de 3', amount: 2000, dueDate: '2026-07-31' }])
})

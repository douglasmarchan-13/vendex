import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { groupRows } from '../../src/modules/imports/excel/group.js'
import { parseWorkbook } from '../../src/modules/imports/excel/parse-workbook.js'

const OPTS = { today: '2026-11-27', currentYear: 2026 }
const HEAD = ['FECHA', 'TELEFONO', 'CONTACTO/CLIENTE', 'EMPRESA', 'RUC/DNI', 'PRODUCTO', 'MONTO', 'CONTACTO', 'UBICACIÓN', 'STATUS 1', 'STATUS 2']
const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m - 1, day))

/** Libro con el mismo formato que el Excel de los vendedores */
function sampleWorkbook() {
  const wb = new ExcelJS.Workbook()
  const base = wb.addWorksheet('BASE DE DATOS CLIENTES')
  base.addRow([]) // el encabezado está en la fila 2
  base.addRow(HEAD)
  base.addRow([d(2024, 4, 18), '935 036 148', 'Wilder Jair Cabos Leyva', '', '', 'Molino 2tn', 'US$ 60,036.00 ', 'SOLO', 'CAJAMARCA',
    { text: 'SE LE ENVIO COTIZACION', hyperlink: 'file:///C:\\Users\\U\\COT%20MOLINO%202T%20WILDER.pdf' }, 'EL CLIENTE ESTA ANALIZANDO LAS POTENCIAS Y CONSUMO', '}'])
  base.addRow([d(2024, 6, 8), 935634824, 'DARWIN CRUZ CASTILLO', '', '', 'SECADORA 30TN', '', 'WERNER', 'BAJO BIAVO', 'SE ENVIO COTIZACION', 'LE PARECE QUE MUY ELEVADO EL PRECIO'])
  base.addRow(Array(12).fill(2026)) // fila separadora
  base.addRow(['', 959030427, '', '', '', '', '', '', '', '', '']) // solo teléfono
  base.addRow(['27 Enero de 2026', '926282207\n953647105', 'IDER GUERERRO', 'GUERRERO DE DIOS', 20611817062, 'ZENVAN 1M3', 24000, 'VISITA DE CAMPO', 'PIURA', '', 'MUY INTERESADO'])
  base.addRow([d(2024, 10, 22), 900183617, 'JERLY LOPEZ', '', 77703471, 'MOLINO COMPACTO 1TN', 23000, '', 'FACEBOOK', 'SE ENVIO COTIZACION', ''])
  base.addRow([d(2025, 1, 7), 974834116, 'ALEJANDRO GARCIA', '', '', 'MOTOCULTOR 18 HP', '', 'TIENDA', 'POMAHUACA', '', 'ESTA INTERESADO'])
  base.addRow([d(2024, 6, 6), 937506376, 'RUTH PINEDO', '', '', 'SECADORA 35TN INOX', '', 'SOLO', 'NUEVA CAJAMARCA', 'DEBE VENIR LA SEMANA', 'ESTAN PROGRAMANDO VIAJE DESPUES DEL 15-07', 'COMPRARON KEPLER WEBBER'])
  base.addRow([d(1899, 12, 30), 973305461, 'ROMAN DE LA CRUZ', '', { text: 'roman@correo.com', hyperlink: 'mailto:roman@correo.com' }, 'PULIDORA DE ARROZ\nMESA PADDY', 11318, 'SR DEMETRIO', 'PIURA', '', 'COMPRO WORD USADA'])

  const bo = wb.addWorksheet('BOLIVIA')
  bo.addRow(['FECHA', 'TELEFONO', 'CONTACTO/CLIENTE', 'CEDULA', 'PRODUCTO', 'MONTO', 'CONTACTO', 'LUGAR', 'UBICACIÓN', 'STATUS 1', 'STATUS 2'])
  bo.addRow([d(2025, 3, 6), '+591 67210469', 'GILBERTO CHAMBI COPA', 4244125, 'ZUKAI 350 QUINUA', 33000, 'FACEBOOK', 'CHALLAPATA', 'ORURO', 'PRECIO DE LA MAQUINA PUESTO EN DESAGUADERO', ''])

  const pot = wb.addWorksheet('CLIENTES POTENCIALES')
  pot.addRow(HEAD)
  pot.addRow([d(2024, 6, 8), 935634824, 'DARWIN CRUZ CASTILLO', '', '', 'SECADORA 30TN', 51500, 'WERNER', 'BAJO BIAVO', 'SE ENVIO COTIZACION', 'LE PARECE QUE MUY ELEVADO EL PRECIO',
    'EL BANCO LE OTORGO CREDITO MEDIO MILLON', 'SE LLAMO 02-04-2025 AUN SIGUE INTERESADO'])
  return wb
}

describe('parseWorkbook', () => {
  const parsed = parseWorkbook(sampleWorkbook(), OPTS)
  const row = (sheet: string, r: number) => parsed.rows.find((x) => x.sheet === sheet && x.row === r)!

  it('encuentra el encabezado de cada hoja y las columnas extra', () => {
    expect(parsed.sheets.map((s) => [s.name, s.country, s.headerRow])).toEqual([
      ['BASE DE DATOS CLIENTES', 'PE', 2],
      ['BOLIVIA', 'BO', 1],
      ['CLIENTES POTENCIALES', 'PE', 1],
    ])
    expect(parsed.sheets[2].extraColumns).toEqual(['L', 'M'])
  })

  it('salta la fila separadora "2026"', () => {
    expect(parsed.sheets[0].skipped).toEqual([{ row: 5, reason: 'Fila separadora "2026"' }])
  })

  it('normaliza la primera fila (monto en texto y enlace a la cotización)', () => {
    expect(row('BASE DE DATOS CLIENTES', 3)).toMatchObject({
      date: '2024-04-18',
      name: 'Wilder Jair Cabos Leyva',
      phones: ['+51 935 036 148'],
      amount: 60036,
      currency: 'USD',
      source: { channel: null },
      city: 'CAJAMARCA',
      notes: [
        { text: 'SE LE ENVIO COTIZACION (archivo: COT MOLINO 2T WILDER.pdf)', column: 'STATUS 1' },
        { text: 'EL CLIENTE ESTA ANALIZANDO LAS POTENCIAS Y CONSUMO', column: 'STATUS 2' },
      ],
    })
  })

  it('fila solo con teléfono: incompleta', () => {
    expect(row('BASE DE DATOS CLIENTES', 6)).toMatchObject({ incomplete: true, phones: ['+51 959 030 427'] })
  })

  it('fecha en texto, dos teléfonos y RUC numérico', () => {
    expect(row('BASE DE DATOS CLIENTES', 7)).toMatchObject({
      date: '2026-01-27',
      phones: ['+51 926 282 207', '+51 953 647 105'],
      doc: '20611817062',
      source: { channel: 'Visita de campo' },
    })
  })

  it('canal escrito en UBICACIÓN con CONTACTO vacío: se toma como canal', () => {
    const r = row('BASE DE DATOS CLIENTES', 8)
    expect(r).toMatchObject({ city: '', source: { channel: 'Facebook' } })
    expect(r.issues.map((i) => i.field)).toContain('location')
  })

  it('TIENDA: sin canal, con nota', () => {
    expect(row('BASE DE DATOS CLIENTES', 9).source).toEqual({ channel: null, note: 'Llegó por la tienda', raw: 'TIENDA' })
  })

  it('correo en la columna RUC, fecha 00/01/1900, producto en dos líneas', () => {
    const r = row('BASE DE DATOS CLIENTES', 11)
    expect(r).toMatchObject({ date: null, email: 'roman@correo.com', doc: '', product: 'PULIDORA DE ARROZ / MESA PADDY' })
    expect(r.issues.map((i) => i.field)).toContain('date')
  })

  it('Bolivia: Lugar = ciudad, Ubicación = región, cédula', () => {
    expect(row('BOLIVIA', 2)).toMatchObject({ country: 'BO', city: 'CHALLAPATA', region: 'ORURO', doc: '4244125', phones: ['+591 67210469'] })
  })
})

describe('groupRows', () => {
  const contacts = groupRows(parseWorkbook(sampleWorkbook(), OPTS).rows, OPTS)
  const byName = (n: string) => contacts.find((c) => c.name === n)!

  it('une al mismo cliente de dos hojas en un contacto con un solo trato', () => {
    const darwin = byName('DARWIN CRUZ CASTILLO')
    expect(darwin.rows).toEqual([
      { sheet: 'BASE DE DATOS CLIENTES', row: 4 },
      { sheet: 'CLIENTES POTENCIALES', row: 2 },
    ])
    expect(darwin.deals).toHaveLength(1)
    expect(darwin.deals[0]).toMatchObject({ product: 'SECADORA 30TN', amount: 51500, stage: 'negociacion' })
    // Las notas repetidas en ambas hojas no se duplican
    expect(darwin.activities.map((a) => a.text)).toEqual([
      'Referido por: WERNER',
      'SE ENVIO COTIZACION',
      'LE PARECE QUE MUY ELEVADO EL PRECIO',
      'EL BANCO LE OTORGO CREDITO MEDIO MILLON',
      'SE LLAMO 02-04-2025 AUN SIGUE INTERESADO',
    ])
    expect(darwin.activities.at(-1)!.date).toBe('2025-04-02')
  })

  it('el historial no retrocede en el tiempo', () => {
    const dates = byName('RUTH PINEDO').activities.map((a) => a.date)
    expect(dates).toEqual(['2024-06-06', '2024-07-15', '2024-07-15'])
  })

  it('TIENDA queda como nota en el historial', () => {
    expect(byName('ALEJANDRO GARCIA').activities[0].text).toBe('Llegó por la tienda')
  })

  it('teléfono principal y secundarios', () => {
    expect(byName('IDER GUERERRO')).toMatchObject({ phone: '+51 926 282 207', otherPhones: ['+51 953 647 105'] })
  })

  it('"COMPRÓ" se marca para revisar', () => {
    const r = byName('ROMAN DE LA CRUZ')
    expect(r.deals[0]).toMatchObject({ stage: 'pausa', mentionsPurchase: true })
    expect(r.issues.some((i) => /compró/.test(i.message))).toBe(true)
  })

  it('sin producto no hay trato', () => {
    expect(contacts.find((c) => c.incomplete)!.deals).toEqual([])
  })
})

// Corrida en seco sobre el Excel real, si está en la raíz del proyecto (no se sube al repositorio)
const REAL = resolve(import.meta.dirname, '../../../BASE DE DATOS CLIENTES.xlsx')
describe.runIf(existsSync(REAL))('Excel real de los vendedores', () => {
  it('se lee completo sin errores inesperados', async () => {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(REAL)
    const parsed = parseWorkbook(wb, OPTS)
    const contacts = groupRows(parsed.rows, OPTS)
    const deals = contacts.flatMap((c) => c.deals)
    const stages = Object.fromEntries(['nuevo', 'contactado', 'cotizacion', 'negociacion', 'pausa'].map((s) => [s, deals.filter((x) => x.stage === s).length]))
    const issues = contacts.flatMap((c) => c.issues)
    const byMsg: Record<string, number> = {}
    for (const i of issues) {
      const k = i.message.replace(/".*"/, '"…"').replace(/\(\d{4}-\d{2}-\d{2}\)/, '(…)')
      byMsg[k] = (byMsg[k] ?? 0) + 1
    }
    console.log(JSON.stringify({
      sheets: parsed.sheets.map((s) => ({ name: s.name, headerRow: s.headerRow, rows: s.rows, extra: s.extraColumns, skipped: s.skipped.length })),
      contacts: contacts.length,
      incomplete: contacts.filter((c) => c.incomplete).length,
      merged: contacts.filter((c) => c.rows.length > 1).length,
      deals: deals.length,
      dealsWithAmount: deals.filter((x) => x.amount > 0).length,
      stages,
      activities: contacts.reduce((n, c) => n + c.activities.length, 0),
      nextActionsWithDate: deals.filter((x) => x.nextAt).length,
      issues: byMsg,
    }, null, 2))
    expect(parsed.sheets.every((s) => s.headerRow)).toBe(true)
    expect(contacts.length).toBeGreaterThan(250)
    expect(contacts.every((c) => c.incomplete || c.name)).toBe(true)
  })
})

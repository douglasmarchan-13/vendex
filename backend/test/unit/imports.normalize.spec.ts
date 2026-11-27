import { describe, expect, it } from 'vitest'
import {
  dateInNote,
  fileNameFromLink,
  inferStage,
  isMeaningfulNote,
  nextAction,
  parseAmount,
  parseDateCell,
  parsePhones,
  parseSource,
} from '../../src/modules/imports/excel/normalize.js'

const TODAY = '2026-11-27'
const Y = 2026

describe('parseAmount', () => {
  it.each([
    [160000, 160000, 'USD'],
    ['US$ 60,036.00 ', 60036, 'USD'],
    ['USD 160.000,00', 160000, 'USD'],
    ['US$ 151.350.00', 151350, 'USD'],
    ['USD 147.000,00', 147000, 'USD'],
    ['US$ 2.300', 2300, 'USD'],
    ['S/ 2,300.50', 2300.5, 'PEN'],
    ['Bs 4.500', 4500, 'BOB'],
  ])('%s → %s %s', (input, amount, currency) => {
    expect(parseAmount(input)).toMatchObject({ amount, currency })
  })

  it('vacío o sin números', () => {
    expect(parseAmount(null).amount).toBeNull()
    expect(parseAmount('A CONSULTAR')).toMatchObject({ amount: null, warning: expect.any(String) })
  })
})

describe('parseDateCell', () => {
  it('fecha real de Excel', () => {
    expect(parseDateCell(new Date(Date.UTC(2024, 3, 18)), TODAY, Y)).toEqual({ date: '2024-04-18' })
  })

  it.each([
    ['27 Enero de 2026', '2026-01-27'],
    ['26 de febrero de 2026', '2026-02-26'],
    ['04 de septiembre de 2026', '2026-09-04'],
    ['06/06/2024', '2024-06-06'],
  ])('texto "%s"', (input, date) => {
    expect(parseDateCell(input, TODAY, Y)).toEqual({ date })
  })

  it('sin año: se asume el año actual y se avisa', () => {
    expect(parseDateCell('06-mar.', TODAY, Y)).toEqual({ date: '2026-03-06', warning: expect.stringContaining('2026') })
  })

  it('celdas en 0 (00/01/1900) y 19/01/1900 se descartan', () => {
    expect(parseDateCell(new Date(Date.UTC(1899, 11, 30)), TODAY, Y).date).toBeNull()
    expect(parseDateCell(new Date(Date.UTC(1900, 0, 19)), TODAY, Y).date).toBeNull()
  })

  it('fechas futuras se descartan con aviso', () => {
    expect(parseDateCell(new Date(Date.UTC(2026, 11, 19)), TODAY, Y)).toMatchObject({ date: null, warning: expect.stringContaining('futura') })
  })

  it('números y textos sin fecha', () => {
    expect(parseDateCell(2026, TODAY, Y).date).toBeNull()
    expect(parseDateCell('pendiente', TODAY, Y).date).toBeNull()
  })
})

describe('dateInNote', () => {
  it('fechas numéricas dentro del texto', () => {
    expect(dateInNote('SE LLAMO 02-04-2025 AUN SIGUE', null, Y)).toBe('2025-04-02')
    expect(dateInNote('LLAMAR EL LUNES 19-05', '2025-05-10', Y)).toBe('2025-05-19')
    expect(dateInNote('22-11-2024 TELF. APAGADO', null, Y)).toBe('2024-11-22')
    expect(dateInNote('ZENVAN 1M3', null, Y)).toBeNull()
  })
})

describe('parsePhones', () => {
  it.each([
    ['935 036 148', 'PE', ['+51 935 036 148']],
    [935036148, 'PE', ['+51 935 036 148']],
    [' 991 143 216', 'PE', ['+51 991 143 216']],
    ['+51 918 964 872', 'PE', ['+51 918 964 872']],
    ['+591 67210469', 'BO', ['+591 67210469']],
    ['59176054535', 'BO', ['+591 76054535']],
    [77058592, 'BO', ['+591 77058592']],
    ['926282207\n953647105', 'PE', ['+51 926 282 207', '+51 953 647 105']],
    ['995420621 \n959976828', 'PE', ['+51 995 420 621', '+51 959 976 828']],
  ] as const)('%s', (input, country, phones) => {
    expect(parsePhones(input, country).phones).toEqual(phones)
  })

  it('un número boliviano en la hoja de Perú cambia el país', () => {
    expect(parsePhones('+591 67210469', 'PE')).toMatchObject({ phones: ['+591 67210469'], country: 'BO' })
  })
})

describe('parseSource', () => {
  it('SOLO = llegó solo, sin canal', () => {
    expect(parseSource('SOLO ').channel).toBeNull()
    expect(parseSource('').channel).toBeNull()
  })

  it.each([
    ['FACEBOOK', 'Facebook'],
    ['TIKTOK', 'TikTok'],
    ['VISITA', 'Visita de campo'],
    ['VISITA DE CAMPO', 'Visita de campo'],
    ['RECOMENDACIÓN', 'Referido'],
  ])('%s → %s', (input, channel) => {
    expect(parseSource(input)).toMatchObject({ channel, referredBy: undefined })
  })

  it('un nombre de persona se toma como referido', () => {
    expect(parseSource('SR DEMETRIO')).toEqual({ channel: 'Referido', referredBy: 'SR DEMETRIO', raw: 'SR DEMETRIO' })
    expect(parseSource('AMIGO GRUPO CRB')).toMatchObject({ channel: 'Referido', referredBy: 'AMIGO GRUPO CRB' })
  })
})

describe('notas', () => {
  it('descarta basura de una o dos letras', () => {
    expect(isMeaningfulNote('}')).toBe(false)
    expect(isMeaningfulNote(' + ')).toBe(false)
    expect(isMeaningfulNote('7')).toBe(false)
    expect(isMeaningfulNote('NO CONTESTA')).toBe(true)
  })

  it('nombre del archivo de un enlace local de cotización', () => {
    expect(fileNameFromLink('file:///C:\\Users\\X\\COTIZACIONES%20MOLINERIA\\COT%20MOLINO%202T%20WILDER.pdf')).toBe('COT MOLINO 2T WILDER.pdf')
    expect(fileNameFromLink('mailto:a@b.com')).toBeNull()
  })
})

describe('inferStage', () => {
  it.each([
    [[], 'nuevo'],
    [['POR LLAMAR'], 'nuevo'],
    [['NO CONTESTA'], 'contactado'],
    [['SE LE ENVIO COTIZACION'], 'cotizacion'],
    [['ENVIAR COTIZACION'], 'contactado'],
    [['SE LE ENVIO COTIZACION', 'POR AHORA NO'], 'pausa'],
    [['SE ENVIO COTIZACION', 'NO CUENTA CON EL CAPITAL SUFICIENTE'], 'pausa'],
    [['NO SE ENVIO COTIZACION, PRECIO DE LA MAQUINA MUY ELEVADO'], 'pausa'],
    [['SE ENVIO COTIZACION', 'LE PARECE ELEVADO', 'EL BANCO LE OTORGO CREDITO'], 'negociacion'],
    [['SE ENVIO COTIZACION', 'NO CONTESTA'], 'cotizacion'],
    [['ESTA INTERESADO LO VA A CONVERSAR CON SUS HERMANOS'], 'contactado'],
  ])('%j → %s', (notes, stage) => {
    expect(inferStage(notes).stage).toBe(stage)
  })

  it('"COMPRÓ" queda en pausa y marcado para revisar', () => {
    expect(inferStage(['SE ENVIO COTIZACION', 'COMPRO WORD USADA'])).toEqual({ stage: 'pausa', mentionsPurchase: true })
    expect(inferStage(['COMPRO ABONO 12000USD RESTA 8000USD']).mentionsPurchase).toBe(true)
  })
})

describe('nextAction', () => {
  it('última nota con una acción y fecha futura', () => {
    expect(nextAction(['SE ENVIO COTIZACION', 'LLAMAR EL LUNES 30-11'], '2026-11-20', TODAY, Y)).toEqual({ text: 'LLAMAR EL LUNES 30-11', at: '2026-11-30' })
  })

  it('fecha pasada: acción sin fecha', () => {
    expect(nextAction(['LLAMAR EL LUNES 19-05'], '2025-05-10', TODAY, Y)).toEqual({ text: 'LLAMAR EL LUNES 19-05', at: null })
  })

  it('la última nota no pide nada', () => {
    expect(nextAction(['LLAMAR', 'NO CONTESTA'], null, TODAY, Y)).toBeNull()
  })
})

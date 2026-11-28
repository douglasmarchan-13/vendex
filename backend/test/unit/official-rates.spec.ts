import { describe, expect, it } from 'vitest'
import { parseBcb, parseBcrp, parseBcv, parseLocaleNumber, readSource, SOURCES } from '../../src/modules/settings/official-rates/sources.js'

// Fragmentos tomados de las páginas oficiales (noviembre 2026)
const BCV = `
<div id="dolar" class="col-sm-12 col-xs-12 ">
  <div class="field-content" >
    <div class="row recuadrotsmc">
      <div class="col-sm-6 col-xs-6"><span style="display: inline; margin-left: 15px;"> USD</span></div>
      <div class="col-sm-6 col-xs-6 centrado textp" style="padding-top:2px; font-weight: bold;" > <strong class="strong-tb">928,54540000</strong>  </div>
    </div>
  </div>
</div>
<div class="pull-right dinpro center">
Fecha Valor: <span  property="dc:date" datatype="xsd:dateTime" content="2026-11-30T00:00:00-04:00" class="date-display-single">Lunes, 30 Noviembre  2026</span>
</div>`

const BCB = `
<article class="bcb-kpi2-card is-tc-oficial has-range-label">
  <div class="bcb-kpi2-hd">
    <p class="bcb-kpi2-name">Tipo de cambio oficial</p>
    <div class="bcb-kpi2-asof"><time datetime="2026-11-28">VIGENTE PARA EL SÁBADO 28, DOMINGO 29 Y LUNES 30 DE NOVIEMBRE, 2026</time></div>
  </div>
  <div class="bcb-kpi2-body"><div class="bcb-tco-value"><div class="bcb-tco-amount">
    <span class="bcb-tco-num">11,90</span>
  </div></div></div>
</article>
<article class="bcb-kpi2-card is-cotizaciones"><time datetime="2026-11-30">x</time><div class="bcb-quote-value">3.640,68</div></article>`

const BCRP = JSON.stringify({
  config: { title: 'Tipo de cambio', series: [{ name: 'TC Sistema bancario SBS (S/ por US$) - Venta', dec: '3' }] },
  periods: [
    { name: '25.Nov.26', values: ['3.496'] },
    { name: '26.Nov.26', values: ['3.484'] },
    { name: '27.Nov.26', values: ['n.d.'] },
  ],
})

describe('tipo de cambio oficial: parsers', () => {
  it('números con formato latino', () => {
    expect(parseLocaleNumber('928,54540000')).toBe(928.5454)
    expect(parseLocaleNumber('11,90')).toBe(11.9)
    expect(parseLocaleNumber('1.234,56')).toBe(1234.56)
    expect(parseLocaleNumber('abc')).toBeNaN()
    expect(parseLocaleNumber('1,2,3')).toBeNaN()
  })

  it('BCV (Venezuela): tasa del dólar y fecha valor', () => {
    expect(parseBcv(BCV)).toEqual({ rate: 928.5454, date: '2026-11-30' })
  })

  it('BCB (Bolivia): tipo de cambio oficial, no otras cotizaciones', () => {
    expect(parseBcb(BCB)).toEqual({ rate: 11.9, date: '2026-11-28' })
  })

  it('BCRP (Perú): último día con dato, ignora "n.d."', () => {
    expect(parseBcrp(BCRP)).toEqual({ rate: 3.484, date: '2026-11-26' })
  })

  it('si la página cambia de formato, falla en vez de inventar un valor', () => {
    expect(() => parseBcv('<html>mantenimiento</html>')).toThrow()
    expect(() => parseBcb('<html></html>')).toThrow()
    expect(() => parseBcrp('<html>')).toThrow()
    expect(() => parseBcrp(JSON.stringify({ periods: [{ name: '27.Nov.26', values: ['n.d.'] }] }))).toThrow()
  })

  it('rechaza valores fuera de rango', () => {
    const pen = SOURCES.find((s) => s.code === 'PEN')!
    const bad = JSON.stringify({ periods: [{ name: '26.Nov.26', values: ['348.4'] }] })
    expect(() => readSource(pen, bad, 'x')).toThrow(/fuera de rango/)
    expect(readSource(pen, BCRP, 'x')).toMatchObject({ code: 'PEN', rate: 3.484, source: 'BCRP' })
  })

  it('la URL del BCRP consulta las últimas 3 semanas', () => {
    const pen = SOURCES.find((s) => s.code === 'PEN')!
    expect(pen.url(new Date('2026-11-28T12:00:00Z'))).toBe(
      'https://estadisticas.bcrp.gob.pe/estadisticas/series/api/PD04640PD/json/2026-11-07/2026-11-28',
    )
  })
})

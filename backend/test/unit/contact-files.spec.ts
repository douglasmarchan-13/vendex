import { readFileSync, existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { cleanFileName, looksLikePdf } from '../../src/modules/contacts/contact-files.service.js'

/** Como llega el nombre desde multer: los bytes UTF-8 leídos como latin1 */
const asMulter = (name: string) => Buffer.from(name, 'utf8').toString('latin1')

describe('cleanFileName', () => {
  it('recupera tildes, Ñ y ° del nombre que entrega multer', () => {
    const name = 'EDGAR RIOS CAÑETE TRITON 10 MAIZ Factura Proforma N° 2026-481v1.pdf'
    expect(cleanFileName(asMulter(name))).toBe(name)
  })

  it('deja igual un nombre que ya venía bien', () => {
    expect(cleanFileName('Cotización Ñandú.pdf')).toBe('Cotización Ñandú.pdf')
    expect(cleanFileName('proforma.PDF')).toBe('proforma.PDF')
  })

  it('quita rutas y caracteres de control, y agrega .pdf si falta', () => {
    expect(cleanFileName('C:\\fakepath\\..\\cot.pdf')).toBe('cot.pdf')
    expect(cleanFileName('../../etc/passwd')).toBe('passwd.pdf')
    expect(cleanFileName('a\u0000b\nc.pdf')).toBe('abc.pdf')
    expect(cleanFileName('   ')).toBe('cotizacion.pdf')
  })

  it('limita el largo a 200 caracteres', () => {
    const out = cleanFileName('x'.repeat(400) + '.pdf')
    expect(out.length).toBe(200)
    expect(out.endsWith('.pdf')).toBe(true)
  })
})

describe('looksLikePdf', () => {
  it('reconoce la cabecera %PDF-', () => {
    expect(looksLikePdf(Buffer.from('%PDF-1.7\n...'))).toBe(true)
    expect(looksLikePdf(Buffer.from('\r\n%PDF-1.4'))).toBe(true)
  })

  it('rechaza otros archivos', () => {
    expect(looksLikePdf(Buffer.from('PK\u0003\u0004 (un .xlsx)'))).toBe(false)
    expect(looksLikePdf(Buffer.from('<html>'))).toBe(false)
  })

  const sample = '../EDGAR RIOS CAÑETE TRITON 10 MAIZ Factura Proforma N° 2026-481v1.pdf'
  it.skipIf(!existsSync(sample))('acepta la proforma de ejemplo del proyecto', () => {
    expect(looksLikePdf(readFileSync(sample))).toBe(true)
  })
})

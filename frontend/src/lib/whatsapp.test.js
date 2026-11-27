import { mergeTemplates, renderTemplate, waLink, waPhone } from './whatsapp'

describe('whatsapp', () => {
  it('normaliza teléfonos a formato internacional', () => {
    expect(waPhone('+51 942 318 506', 'PE')).toBe('51942318506')
    expect(waPhone('942318506', 'PE')).toBe('51942318506')
    expect(waPhone('51942318506', 'PE')).toBe('51942318506')
    expect(waPhone('0414-1234567', 'VE')).toBe('584141234567')
    expect(waPhone('0059171234567', 'BO')).toBe('59171234567')
    expect(waPhone('71234567', 'BO')).toBe('59171234567')
    expect(waPhone('', 'PE')).toBe('')
  })

  it('completa variables y limpia las vacías', () => {
    expect(renderTemplate('Hola {nombre}, ¿vio {producto} ({precio})?', { nombre: 'Rosa', producto: 'la secadora', precio: '' }))
      .toBe('Hola Rosa, ¿vio la secadora?')
  })

  it('la versión del vendedor reemplaza la por defecto y suma las propias', () => {
    const list = mergeTemplates([
      { key: 'seguimiento', kind: 'venta', label: 'Mío', body: 'x' },
      { key: 'custom-a', kind: 'venta', label: 'A', body: 'y' },
    ], 'venta')
    expect(list.find((t) => t.key === 'seguimiento')).toMatchObject({ label: 'Mío', edited: true })
    expect(list.at(-1)).toMatchObject({ key: 'custom-a', own: true })
    expect(list.every((t) => t.kind === 'venta')).toBe(true)
  })

  it('arma el enlace wa.me', () => {
    expect(waLink('51942318506', 'Hola ¿qué tal?')).toBe('https://wa.me/51942318506?text=Hola%20%C2%BFqu%C3%A9%20tal%3F')
  })
})

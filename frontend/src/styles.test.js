import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Vitest entrega los .css vacíos (incluso con ?raw): se lee el archivo desde la raíz del frontend
const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')

describe('index.css · sin scroll horizontal en el teléfono', () => {
  it('html y body recortan el desborde horizontal', () => {
    expect(css).toMatch(/html,\s*body\s*\{[^}]*overflow-x:\s*clip/)
  })
  it('los hijos de grid pueden encogerse (una columna implícita no crece con el contenido)', () => {
    expect(css).toMatch(/\.grid\s*>\s*\*\s*\{[^}]*min-width:\s*0/)
  })
  it('las palabras largas se parten', () => {
    expect(css).toMatch(/body\s*\{[^}]*overflow-wrap:\s*break-word/)
  })
})

describe('index.css · animaciones', () => {
  // Un transform retenido al terminar la animación (fill-mode both/forwards) convierte al elemento
  // en contenedor de sus hijos position:fixed: el modal de Equipo quedaba desplazado dentro de <main>.
  it.each(['anim-fade', 'anim-up', 'anim-slide', 'anim-pop'])('.%s no retiene el estado final', (cls) => {
    const rule = css.match(new RegExp(`\\.${cls}\\s*\\{([^}]*)\\}`))?.[1]
    expect(rule).toBeTruthy()
    expect(rule).toMatch(/backwards/)
    expect(rule).not.toMatch(/\b(both|forwards)\b/)
  })
})

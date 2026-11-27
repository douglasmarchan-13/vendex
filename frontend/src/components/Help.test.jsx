import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HelpButton } from './Help'
import { HELP, BASICS, forRole } from '../data/help'

beforeEach(() => localStorage.clear())

describe('HelpButton', () => {
  it('abre la guía del módulo con sus 3 pasos y deja de marcarlo como nuevo', async () => {
    render(<HelpButton module="embudo" role="vendedor" modules={['hoy', 'embudo']} />)
    expect(screen.getByTestId('help-new')).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText('Ayuda de este módulo'))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/Ayuda · Embudo de ventas/)).toBeInTheDocument()
    expect(within(dialog).getAllByRole('listitem').length).toBeGreaterThanOrEqual(3)
    expect(screen.queryByTestId('help-new')).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('vx-help-seen'))).toContain('embudo')
  })

  it('oculta lo que es solo del gerente a un vendedor', async () => {
    render(<HelpButton module="embudo" role="vendedor" />)
    await userEvent.click(screen.getByLabelText('Ayuda de este módulo'))
    expect(screen.queryByText('Filtro por vendedor')).not.toBeInTheDocument()
  })

  it('permite saltar a la ayuda de otro módulo', async () => {
    render(<HelpButton module="hoy" role="gerente" modules={['hoy', 'cobranza']} />)
    await userEvent.click(screen.getByLabelText('Ayuda de este módulo'))
    await userEvent.click(screen.getByRole('button', { name: 'Cobranza' }))
    expect(screen.getByText(/Ayuda · Cobranza/)).toBeInTheDocument()
  })

  it('no muestra nada para un módulo sin ayuda', () => {
    const { container } = render(<HelpButton module="nada" role="gerente" />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('contenido de ayuda', () => {
  it('cada módulo tiene título corto, introducción, 3 pasos y funciones para cada rol', () => {
    for (const [id, h] of Object.entries(HELP)) {
      expect(h.short, id).toBeTruthy()
      expect(h.intro, id).toBeTruthy()
      expect(h.steps, id).toHaveLength(3)
      for (const role of ['gerente', 'vendedor']) expect(forRole(h.features, role).length, `${id}/${role}`).toBeGreaterThan(0)
    }
    expect(forRole(BASICS, 'vendedor').length).toBeLessThan(BASICS.length)
  })
})

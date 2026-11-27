import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import { Sidebar, TopBar } from './Shell'

vi.mock('../store', () => ({
  useApp: () => ({
    openModal: () => {},
    data: { contacts: [], deals: [], payments: [], tasks: [], rates: { USD: 1 } },
    inCountry: () => true,
    toast: () => {},
    openContact: () => {},
    toggleTask: () => {},
    sellers: { andres: { id: 'andres', name: 'Andrés Ramírez', active: true } },
    canManage: true,
    sellerFilter: 'ALL',
    setSellerFilter: () => {},
    country: 'ALL',
    setCountry: () => {},
    currency: 'USD',
    setCurrency: () => {},
    contactById: {},
    money: (n) => String(n),
    isSnoozed: () => false,
  }),
}))
const auth = vi.hoisted(() => ({ user: { role: 'gerente', name: 'Ana' } }))
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ logout: () => {}, user: auth.user }) }))
vi.mock('../views/Collections', () => ({ useCobros: () => ({ overdue: [], today: [], week: [], soon: [] }) }))

const renderBar = () => render(<MemoryRouter><TopBar view="equipo" /></MemoryRouter>)

describe('TopBar responsive', () => {
  it('los filtros van en línea solo desde xl y en una segunda fila debajo de xl', () => {
    renderBar()
    const [inline, row] = screen.getAllByLabelText('Vendedor')
    expect(inline).toHaveClass('hidden', 'xl:block')
    expect(inline).not.toHaveClass('md:block')
    const second = row.parentElement
    expect(second).toHaveClass('xl:hidden', 'flex-col', 'sm:flex-row')
    expect(second).not.toHaveClass('md:hidden')
  })

  it('el selector de países compacto se encoge y recorta los nombres en vez de desbordar', () => {
    renderBar()
    const venezuela = screen.getAllByText('Venezuela').at(-1)
    expect(venezuela).toHaveClass('truncate')
    expect(venezuela.closest('button')).toHaveClass('min-w-0', 'flex-auto')
    expect(venezuela.closest('button').parentElement).toHaveClass('w-full', 'min-w-0')
  })

  it('en teléfonos muy angostos (<360px) se oculta el texto "Vendex" y queda el logo', () => {
    renderBar()
    expect(screen.getByText('Vendex')).toHaveClass('hidden', 'min-[360px]:inline')
  })

  it('el grupo de acciones no se encoge ni parte el botón "Nuevo trato"', () => {
    renderBar()
    const btn = screen.getByRole('button', { name: /nuevo trato/i })
    expect(btn.parentElement).toHaveClass('whitespace-nowrap')
    expect(btn.parentElement.parentElement).toHaveClass('shrink-0')
  })
})

describe('Sidebar: Restablecer demo', () => {
  const renderSide = (user) => {
    auth.user = user
    return render(<MemoryRouter><Sidebar view="hoy" /></MemoryRouter>)
  }

  it('aparece en la empresa demo (el backend envía canResetDemo)', () => {
    renderSide({ role: 'gerente', name: 'Demo', canResetDemo: true })
    expect(screen.getByRole('button', { name: /restablecer demo/i })).toBeInTheDocument()
  })

  it('no aparece para el gerente de otra empresa', () => {
    renderSide({ role: 'gerente', name: 'Douglas', companyName: 'test', canResetDemo: false })
    expect(screen.queryByRole('button', { name: /restablecer demo/i })).not.toBeInTheDocument()
  })
})

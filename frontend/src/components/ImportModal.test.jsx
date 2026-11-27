import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import ImportModal from './ImportModal'

const api = vi.hoisted(() => ({ preview: vi.fn(), commit: vi.fn(), undo: vi.fn() }))
const app = vi.hoisted(() => ({ toast: vi.fn(), reload: vi.fn() }))
vi.mock('../lib/api', () => ({ importsApi: api }))
vi.mock('../store', () => ({ useApp: () => app }))

const contact = (key, over = {}) => ({
  key, status: 'nuevo', name: key, company: '', phone: '+51 935 036 148', otherPhones: [], doc: '', country: 'PE', city: 'PIURA', region: '',
  channel: null, source: 'SOLO', createdAt: '2025-01-04', deals: [{ product: 'TRITON 10', amount: 135000, currency: 'USD', stage: 'cotizacion', mentionsPurchase: false }],
  activities: [{ date: '2025-01-04', text: 'SE ENVIO COTIZACION' }], issues: [], rows: [], ...over,
})

const PREVIEW = {
  fileName: 'BASE DE DATOS CLIENTES.xlsx',
  sheets: [{ name: 'BASE DE DATOS CLIENTES', country: 'PE', found: true, rows: 3, skipped: 0 }],
  summary: { purchases: 1 },
  contacts: [
    contact('WILDER'),
    contact('ROMAN', { deals: [{ product: 'PULIDORA', amount: 0, currency: 'USD', stage: 'pausa', mentionsPurchase: true }], issues: [{ level: 'warning', message: 'Una nota dice que compró', from: 'X!8' }] }),
    contact('OTRO', { status: 'otro_vendedor', deals: [], activities: [] }),
  ],
}

const xlsx = () => new File(['x'], 'BASE DE DATOS CLIENTES.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

beforeEach(() => vi.clearAllMocks())

it('vista previa → marcar venta propia y quitar un contacto → importar', async () => {
  const user = userEvent.setup()
  api.preview.mockResolvedValue(PREVIEW)
  api.commit.mockResolvedValue({ id: 'b1', contacts: 1, deals: 1, activities: 1 })
  render(<ImportModal onClose={() => {}} />)

  const file = xlsx()
  await user.upload(document.querySelector('input[type=file]'), file)
  expect(api.preview).toHaveBeenCalledWith(file)
  expect(await screen.findByRole('button', { name: /importar 2 contactos/i })).toBeEnabled()
  // El contacto de otro vendedor no se puede marcar
  expect(screen.getByRole('checkbox', { name: 'Importar OTRO' })).toBeDisabled()

  await user.click(screen.getByRole('checkbox', { name: /fue venta nuestra/i }))
  await user.click(screen.getByRole('checkbox', { name: 'Importar WILDER' }))
  await user.click(screen.getByRole('button', { name: /importar 1 contactos/i }))

  expect(api.commit).toHaveBeenCalledWith(file, { exclude: ['WILDER'], sold: ['ROMAN'] })
  expect(await screen.findByText('Importación lista')).toBeInTheDocument()
  expect(app.reload).toHaveBeenCalled()
})

it('rechaza archivos que no son .xlsx sin llamar al servidor', async () => {
  const user = userEvent.setup({ applyAccept: false })
  render(<ImportModal onClose={() => {}} />)
  await user.upload(document.querySelector('input[type=file]'), new File(['a,b'], 'clientes.csv', { type: 'text/csv' }))
  expect(screen.getByText(/debe ser \.xlsx/i)).toBeInTheDocument()
  expect(api.preview).not.toHaveBeenCalled()
})

it('muestra el error del servidor', async () => {
  const user = userEvent.setup()
  api.preview.mockRejectedValue(new Error('No se encontró el encabezado'))
  render(<ImportModal onClose={() => {}} />)
  await user.upload(document.querySelector('input[type=file]'), xlsx())
  expect(await screen.findByText(/no se encontró el encabezado/i)).toBeInTheDocument()
})

it('después de importar se puede deshacer', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  api.preview.mockResolvedValue(PREVIEW)
  api.commit.mockResolvedValue({ id: 'b1', contacts: 2, deals: 2, activities: 2 })
  api.undo.mockResolvedValue({})
  render(<ImportModal onClose={onClose} />)
  await user.upload(document.querySelector('input[type=file]'), xlsx())
  await user.click(await screen.findByRole('button', { name: /importar 2 contactos/i }))
  const dialog = await screen.findByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: /deshacer importación/i }))
  expect(api.undo).toHaveBeenCalledWith('b1')
  expect(onClose).toHaveBeenCalled()
})

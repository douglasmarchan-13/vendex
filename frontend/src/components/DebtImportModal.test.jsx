import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import DebtImportModal from './DebtImportModal'

const api = vi.hoisted(() => ({ previewDebts: vi.fn(), commitDebts: vi.fn(), undo: vi.fn() }))
const app = vi.hoisted(() => ({ toast: vi.fn(), reload: vi.fn() }))
vi.mock('../lib/api', () => ({ importsApi: api }))
vi.mock('../store', () => ({ useApp: () => app }))

const debt = (key, over = {}) => ({
  key, status: 'nuevo', name: key, doc: '', voucher: 'BG05 - 1', product: 'Venta BG05 - 1', year: 2026, currency: 'PEN', country: 'PE',
  total: 65000, pending: 63000, abonos: [], issues: [],
  installments: [
    { label: 'Cuota 1 de 2', amount: 18000, dueDate: '2026-07-31', overdue: true },
    { label: 'Cuota 2 de 2', amount: 45000, dueDate: '2027-06-30', overdue: false },
  ],
  ...over,
})

const PREVIEW = {
  fileName: 'DEUDAS HASTA DICIEMBRE 2026.xlsx',
  sheets: [{ name: 'Pagos a diciembre 2026', found: true, rows: 2 }],
  summary: { overdueByCurrency: { PEN: 18000 } },
  debts: [
    debt('DIAZ', { abonos: [{ n: 1, label: 'Cuota 1 de 2', amount: 2000, dueDate: '2026-07-31' }] }),
    debt('SULCA', { status: 'sin_cambios' }),
  ],
}

const xlsx = () => new File(['x'], 'DEUDAS HASTA DICIEMBRE 2026.xlsx')

it('vista previa con cuotas, abono y vencidas → importar', async () => {
  const user = userEvent.setup()
  api.previewDebts.mockResolvedValue(PREVIEW)
  api.commitDebts.mockResolvedValue({ id: 'b1', contacts: 1, deals: 1, payments: 3, activities: 2 })
  render(<DebtImportModal onClose={() => {}} />)

  const file = xlsx()
  await user.upload(document.querySelector('input[type=file]'), file)
  expect(await screen.findByRole('button', { name: /importar 1 deudas/i })).toBeEnabled()
  expect(screen.getByText(/abono · cuota 1 de 2/i)).toBeInTheDocument()
  expect(screen.getAllByText(/vencida el/i)).toHaveLength(2)
  // Una deuda ya importada no se puede volver a marcar
  expect(screen.getByRole('checkbox', { name: 'Importar SULCA' })).toBeDisabled()

  await user.click(screen.getByRole('button', { name: /importar 1 deudas/i }))
  expect(api.commitDebts).toHaveBeenCalledWith(file, { exclude: [] })
  expect(await screen.findByText('Deudas importadas')).toBeInTheDocument()
  expect(screen.getByText(/1 ventas · 3 cuotas · 1 clientes nuevos/)).toBeInTheDocument()
  expect(app.reload).toHaveBeenCalled()
})

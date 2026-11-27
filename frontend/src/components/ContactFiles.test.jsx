import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import ContactFiles from './ContactFiles'
import { fmtSize, pdfProblem } from '../lib/files'

const api = vi.hoisted(() => ({ list: vi.fn(), upload: vi.fn(), url: vi.fn(), remove: vi.fn() }))
const app = vi.hoisted(() => ({ toast: vi.fn(), addSavedActivity: vi.fn() }))
vi.mock('../lib/api', () => ({ filesApi: api }))
vi.mock('../store', () => ({ useApp: () => app }))

const NAME = 'EDGAR RIOS CAÑETE TRITON 10 MAIZ Factura Proforma N° 2026-481v1.pdf'
const contact = { id: 'c1', name: 'Edgar Ríos' }
const deals = [
  { id: 'd-old', product: 'PULIDORA', stage: 'cerrado' },
  { id: 'd1', product: 'TRITON 10 MAIZ', stage: 'cotizacion' },
]
const saved = { id: 'f1', contactId: 'c1', dealId: 'd1', kind: 'cotizacion', fileName: NAME, size: 770414, note: '', by: 'andres', at: '2026-11-27T15:00:00Z' }
const pdf = (name = NAME, size = 770414) => {
  const f = new File(['%PDF-1.7'], name, { type: 'application/pdf' })
  Object.defineProperty(f, 'size', { value: size })
  return f
}

beforeEach(() => vi.clearAllMocks())

it('adjunta un PDF al trato abierto y lo agrega al historial', async () => {
  const user = userEvent.setup()
  api.list.mockResolvedValue([])
  api.upload.mockResolvedValue({ file: saved, activity: { id: 'a1', type: 'cotizacion', text: 'Cotización enviada', at: saved.at, by: 'andres' } })
  render(<ContactFiles contact={contact} deals={deals} />)
  expect(await screen.findByText('Sin cotizaciones adjuntas.')).toBeInTheDocument()

  const file = pdf()
  await user.upload(screen.getByTestId('pdf-input'), file)
  // Por defecto, el trato abierto (no el cerrado)
  expect(screen.getByRole('combobox')).toHaveValue('d1')
  await user.type(screen.getByPlaceholderText(/Nota/), 'Válida 15 días')
  await user.click(screen.getByRole('button', { name: /^Adjuntar$/ }))

  expect(api.upload).toHaveBeenCalledWith('c1', { file, dealId: 'd1', note: 'Válida 15 días' })
  expect(await screen.findByRole('button', { name: `Ver ${NAME}` })).toBeInTheDocument()
  expect(screen.getByText(/TRITON 10 MAIZ · .* · 752 KB/)).toBeInTheDocument()
  expect(app.addSavedActivity).toHaveBeenCalledWith('c1', expect.objectContaining({ id: 'a1' }))
})

it('rechaza archivos que no son PDF sin subirlos', async () => {
  const user = userEvent.setup({ applyAccept: false })
  api.list.mockResolvedValue([])
  render(<ContactFiles contact={contact} deals={deals} />)
  await screen.findByText('Sin cotizaciones adjuntas.')
  await user.upload(screen.getByTestId('pdf-input'), new File(['x'], 'foto.png', { type: 'image/png' }))
  expect(app.toast).toHaveBeenCalledWith('Solo se pueden adjuntar archivos PDF')
  expect(screen.queryByRole('button', { name: /^Adjuntar$/ })).not.toBeInTheDocument()
})

it('"Ver" abre una pestaña con el enlace firmado', async () => {
  const user = userEvent.setup()
  api.list.mockResolvedValue([saved])
  api.url.mockResolvedValue({ url: 'https://x.supabase.co/storage/v1/object/sign/contact-files/a.pdf?token=t' })
  const tab = { location: { href: '' }, close: vi.fn() }
  const open = vi.spyOn(window, 'open').mockReturnValue(tab)
  render(<ContactFiles contact={contact} deals={deals} />)
  await user.click(await screen.findByRole('button', { name: `Ver ${NAME}` }))
  expect(open).toHaveBeenCalledWith('', '_blank')
  expect(api.url).toHaveBeenCalledWith('c1', 'f1')
  expect(tab.location.href).toContain('/object/sign/contact-files/')
  open.mockRestore()
})

it('pdfProblem / fmtSize', () => {
  expect(pdfProblem(pdf())).toBeNull()
  expect(pdfProblem(pdf('big.pdf', 11 * 1024 * 1024))).toMatch(/máximo es 10 MB/)
  expect(fmtSize(2_500_000)).toBe('2.4 MB')
})

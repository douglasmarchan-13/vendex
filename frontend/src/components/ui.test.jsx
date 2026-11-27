import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { Modal } from './ui'

const open = (props = {}) =>
  render(
    // Contenedor con transform, como el <main class="anim-fade">: no debe atrapar al modal
    <main data-testid="main" style={{ transform: 'translateY(4px)' }}>
      <Modal open onClose={props.onClose || (() => {})} title="Agregar a tu equipo" subtitle="Sub" footer={<button>Crear usuario</button>} {...props}>
        <input aria-label="Correo" />
      </Modal>
    </main>,
  )

describe('Modal', () => {
  it('no renderiza nada cerrado', () => {
    render(<Modal open={false} onClose={() => {}} title="X">contenido</Modal>)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('se monta en <body> (portal), fuera del contenedor con transform', () => {
    open()
    const dialog = screen.getByRole('dialog')
    expect(screen.getByTestId('main')).not.toContainElement(dialog)
    const overlay = dialog.parentElement
    expect(overlay.parentElement).toBe(document.body)
    expect(overlay).toHaveClass('fixed', 'inset-0', 'z-50')
  })

  it('se centra en pantallas sm+ y es hoja inferior en celular', () => {
    open()
    const overlay = screen.getByRole('dialog').parentElement
    expect(overlay).toHaveClass('items-end', 'sm:items-center', 'justify-center')
  })

  it('limita su alto a la ventana y el cuerpo tiene scroll propio', () => {
    open()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveClass('max-h-[92dvh]', 'sm:max-h-[calc(100dvh-2rem)]', 'flex-col')
    const body = screen.getByLabelText('Correo').parentElement
    expect(body).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto')
    expect(screen.getByText('Crear usuario').parentElement).toHaveClass('shrink-0')
  })

  it('bloquea el scroll del fondo y lo restaura al cerrar', () => {
    document.body.style.overflow = 'auto'
    const { unmount } = open()
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('auto')
  })

  it('cierra con Escape, con el fondo y con la X', () => {
    const onClose = vi.fn()
    open({ onClose })
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(screen.getByRole('dialog').previousSibling)
    fireEvent.click(screen.getByLabelText('Cerrar'))
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('muestra título, subtítulo y pie', () => {
    open()
    expect(screen.getByRole('heading', { name: 'Agregar a tu equipo' })).toBeInTheDocument()
    expect(screen.getByText('Sub')).toBeInTheDocument()
    expect(screen.getByText('Crear usuario')).toBeInTheDocument()
  })
})

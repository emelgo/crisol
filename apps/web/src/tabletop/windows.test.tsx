import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef } from 'react'
import { describe, expect, it } from 'vitest'
import '../i18n.ts'
import { clampBox, MIN, useWindows, WindowLayer, WindowsProvider } from './windows.tsx'

let api: ReturnType<typeof useWindows> = null

function Grab() {
  api = useWindows()
  return null
}

function Harness() {
  const area = useRef<HTMLDivElement>(null)
  return (
    <WindowsProvider area={area}>
      <div ref={area}>
        <Grab />
        <WindowLayer />
      </div>
    </WindowsProvider>
  )
}

const page = (id: string, title: string) => ({ id, title, render: () => <p>Texto de {title}</p> })
const box = (title: string) => screen.getByRole('dialog', { name: title }) as HTMLElement

describe('las ventanas de la Mesa', () => {
  it('varias a la vez; abrir otra vez la misma la trae delante en vez de repetirla', () => {
    render(<Harness />)
    act(() => api?.open(page('a', 'Aldric Varn')))
    act(() => api?.open(page('b', 'Puerto Gris')))
    expect(screen.getAllByRole('dialog')).toHaveLength(2)
    expect(within(box('Aldric Varn')).getByText('Texto de Aldric Varn')).toBeDefined()
    // La última, delante (y en cascada: no tapa del todo a la anterior)
    expect(Number(box('Puerto Gris').style.zIndex)).toBeGreaterThan(Number(box('Aldric Varn').style.zIndex))
    expect(box('Puerto Gris').style.left).not.toBe(box('Aldric Varn').style.left)
    act(() => api?.open(page('a', 'Aldric Varn')))
    expect(screen.getAllByRole('dialog')).toHaveLength(2)
    expect(Number(box('Aldric Varn').style.zIndex)).toBeGreaterThan(Number(box('Puerto Gris').style.zIndex))
  })

  it('se minimiza abajo a la izquierda, vuelve a su sitio y se cierra', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    act(() => api?.open(page('a', 'Aldric Varn')))
    const left = box('Aldric Varn').style.left
    await user.click(screen.getByRole('button', { name: 'Minimizar Aldric Varn' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    const dock = within(screen.getByRole('list', { name: 'Ventanas minimizadas' }))
    await user.click(dock.getByRole('button', { name: 'Aldric Varn' }))
    expect(box('Aldric Varn').style.left).toBe(left)
    expect(screen.queryByRole('list', { name: 'Ventanas minimizadas' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Cerrar Aldric Varn' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('con el teclado, desde su título: flechas para moverla, Mayúsculas y flechas para estirarla; y se recuerda', async () => {
    const user = userEvent.setup()
    const view = render(<Harness />)
    act(() => api?.open(page('a', 'Aldric Varn')))
    const before = {
      left: Number.parseFloat(box('Aldric Varn').style.left),
      width: Number.parseFloat(box('Aldric Varn').style.width)
    }
    within(box('Aldric Varn')).getByRole('heading', { name: 'Aldric Varn' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(Number.parseFloat(box('Aldric Varn').style.left)).toBe(before.left + 24)
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}')
    expect(Number.parseFloat(box('Aldric Varn').style.width)).toBe(before.width + 24)
    view.unmount()
    render(<Harness />)
    act(() => api?.open(page('a', 'Aldric Varn')))
    expect(Number.parseFloat(box('Aldric Varn').style.left)).toBe(before.left + 24)
  })

  it('no se sale de la Mesa ni baja de su tamaño mínimo', () => {
    const area = { width: 1000, height: 700 }
    expect(clampBox({ x: -50, y: 900, width: 100, height: 100 }, area)).toEqual({
      x: 0,
      y: 700 - MIN.height,
      width: MIN.width,
      height: MIN.height
    })
    expect(clampBox({ x: 900, y: 10, width: 2000, height: 300 }, area)).toEqual({
      x: 0,
      y: 10,
      width: 1000,
      height: 300
    })
  })
})

import { render, renderHook, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../i18n.ts'
import { loadedGameIcons, loadGameIcons } from './game-icons.ts'
import { Icon, useIconLabel } from './icon.tsx'
import { IconBrowser } from './icon-browser.tsx'

const search = () => screen.getByRole('searchbox', { name: 'Buscar un icono' })
const sections = () => within(screen.getByRole('toolbar', { name: 'Grupos de iconos' }))
const section = (name: string) => sections().getByRole('button', { name })
const buttons = () => [...document.querySelectorAll<HTMLElement>('[data-icono]')]

describe('los iconos', () => {
  it('un emoji, tal cual; uno de rol, su dibujo como máscara (del color del texto), también uno nuevo', () => {
    const { container } = render(
      <>
        <Icon value="🐉" />
        <Icon value="gi:dragon-head" />
        <Icon value="gi:kenku-head" />
      </>
    )
    const [emoji, game, added] = container.querySelectorAll('span')
    expect(emoji?.textContent).toBe('🐉')
    expect(game?.textContent).toBe('')
    expect(game?.getAttribute('style')).toContain('/iconos/dragon-head.svg')
    expect(added?.getAttribute('style')).toContain('/iconos/kenku-head.svg')
  })

  it('su nombre sale de la lista, que se pide aparte una sola vez', async () => {
    expect(await loadGameIcons()).toBe(loadedGameIcons())
    expect(renderHook(() => useIconLabel('gi:dragon-head')).result.current).toBe('Dragón')
    expect(renderHook(() => useIconLabel('🐉')).result.current).toBe('🐉')
    expect(renderHook(() => useIconLabel(null)).result.current).toBeNull()
    expect(renderHook(() => useIconLabel('gi:no-existe')).result.current).toBeNull()
  })

  it('el buscador: abre en Destacados (o en el grupo del elegido); por su nombre, sin tildes; elegir da «gi:<id>»', async () => {
    const onPick = vi.fn()
    const { unmount } = render(<IconBrowser value="gi:castle" onPick={onPick} />)
    expect(section('Destacados').getAttribute('aria-pressed')).toBe('true')
    await userEvent.type(search(), 'castillo')
    expect(screen.getByRole('button', { name: 'Castillo' }).getAttribute('aria-pressed')).toBe('true')
    await userEvent.clear(search())
    await userEvent.type(search(), 'dragon')
    expect(screen.queryByRole('button', { name: 'Castillo' })).toBeNull()
    // Buscando, ningún grupo marcado: busca en todos
    expect(
      sections()
        .getAllByRole('button')
        .some((button) => button.getAttribute('aria-pressed') === 'true')
    ).toBe(false)
    expect(buttons()[0]?.getAttribute('aria-label')).toBe('Dragón')
    await userEvent.click(screen.getByRole('button', { name: 'Dragón' }))
    expect(onPick).toHaveBeenCalledWith('gi:dragon-head')
    expect(screen.getByRole('link', { name: 'game-icons.net' })).toBeDefined()
    await userEvent.clear(search())
    await userEvent.type(search(), 'zzzz')
    expect(screen.getByText('Ningún icono se llama así.')).toBeDefined()
    unmount()
    // Uno que no es de los destacados: su grupo
    render(<IconBrowser value="gi:kenku-head" onPick={onPick} />)
    expect(section('Criaturas').getAttribute('aria-pressed')).toBe('true')
  })

  it('los grupos: pulsar uno lo enseña (y quita la búsqueda); con flechas, una sola parada', async () => {
    render(<IconBrowser value={null} onPick={() => {}} />)
    await userEvent.type(search(), 'espada')
    await userEvent.click(section('Armas'))
    expect((search() as HTMLInputElement).value).toBe('')
    expect(screen.getByText(/^Armas · \d+$/)).toBeDefined()
    const buttonsOf = sections().getAllByRole('button')
    expect(buttonsOf.filter((button) => button.tabIndex === 0)).toEqual([section('Armas')])
    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(section('Armaduras y ropa'))
    expect(section('Armaduras y ropa').getAttribute('aria-pressed')).toBe('true')
    await userEvent.keyboard('{Home}')
    expect(document.activeElement).toBe(section('Destacados'))
    await userEvent.keyboard('{End}')
    expect(document.activeElement).toBe(section('Ciencia y técnica'))
  })

  it('muchos: solo se pintan las filas a la vista', () => {
    render(<IconBrowser value={null} onPick={() => {}} />)
    expect(screen.getByText('Destacados · 337')).toBeDefined()
    expect(buttons().length).toBeGreaterThan(0)
    expect(buttons().length).toBeLessThan(337)
  })

  it('la rejilla, con el teclado: una sola parada; flechas (abajo, una fila), Inicio y Fin; Intro elige', async () => {
    const onPick = vi.fn()
    render(<IconBrowser value={null} onPick={onPick} />)
    // Pocos (sin pintar solo una parte); sin maquetar, la rejilla tiene 8 columnas
    await userEvent.type(search(), 'espada')
    const grid = within(screen.getByRole('group', { name: /iconos/ }))
    expect(grid.getAllByRole('button').length).toBe(buttons().length)
    const stops = () => buttons().filter((button) => button.tabIndex === 0)
    expect(stops()).toEqual([buttons()[0]])
    buttons()[0]?.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(buttons()[1])
    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(buttons()[9])
    await userEvent.keyboard('{ArrowUp}{ArrowLeft}')
    expect(document.activeElement).toBe(buttons()[0])
    // Sin salirse por el principio
    await userEvent.keyboard('{ArrowLeft}')
    expect(document.activeElement).toBe(buttons()[0])
    await userEvent.keyboard('{End}')
    await waitFor(() => expect(document.activeElement).toBe(buttons().at(-1)))
    expect(stops()).toEqual([buttons().at(-1)])
    await userEvent.keyboard('{Home}')
    expect(document.activeElement).toBe(buttons()[0])
    // Otra tecla no hace nada
    await userEvent.keyboard('a')
    expect(document.activeElement).toBe(buttons()[0])
    await userEvent.keyboard('{Enter}')
    expect(onPick).toHaveBeenCalledWith(`gi:${buttons()[0]?.dataset.icono}`)
  })
})

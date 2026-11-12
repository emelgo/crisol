import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../i18n.ts'
import { Icon, iconLabel } from './icon.tsx'
import { IconBrowser } from './icon-browser.tsx'

describe('los iconos', () => {
  it('un emoji, tal cual; uno de rol, su dibujo como máscara (del color del texto)', () => {
    const { container } = render(
      <>
        <Icon value="🐉" />
        <Icon value="gi:dragon-head" />
      </>
    )
    const [emoji, game] = container.querySelectorAll('span')
    expect(emoji?.textContent).toBe('🐉')
    expect(game?.textContent).toBe('')
    expect(game?.getAttribute('style')).toContain('/iconos/dragon-head.svg')
    expect(iconLabel('gi:dragon-head')).toBe('Dragón')
    expect(iconLabel('🐉')).toBe('🐉')
  })

  it('el buscador: por su nombre, sin tildes, y elegir uno da «gi:<id>»; abajo, su crédito', async () => {
    const onPick = vi.fn()
    render(<IconBrowser value="gi:castle" onPick={onPick} />)
    expect(screen.getByRole('button', { name: 'Castillo' }).getAttribute('aria-pressed')).toBe('true')
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar un icono' }), 'dragon')
    expect(screen.queryByRole('button', { name: 'Castillo' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Dragón' }))
    expect(onPick).toHaveBeenCalledWith('gi:dragon-head')
    expect(screen.getByRole('link', { name: 'game-icons.net' })).toBeDefined()
    await userEvent.clear(screen.getByRole('searchbox', { name: 'Buscar un icono' }))
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar un icono' }), 'zzzz')
    expect(screen.getByText('Ningún icono se llama así.')).toBeDefined()
  })

  it('el buscador, con el teclado: una sola parada; flechas por la rejilla (abajo, una fila), Inicio y Fin', async () => {
    // jsdom no maqueta: la rejilla dice tener 3 columnas
    const real = window.getComputedStyle
    const computed = vi
      .spyOn(window, 'getComputedStyle')
      .mockImplementation((element) =>
        element.tagName === 'UL' ? ({ gridTemplateColumns: '1fr 1fr 1fr' } as CSSStyleDeclaration) : real(element)
      )
    try {
      render(<IconBrowser value={null} onPick={() => {}} />)
      const buttons = () => [...document.querySelectorAll<HTMLElement>('[data-icono]')]
      const stops = () => buttons().filter((button) => button.tabIndex === 0)
      expect(stops()).toEqual([buttons()[0]])
      buttons()[0]?.focus()
      await userEvent.keyboard('{ArrowRight}')
      expect(document.activeElement).toBe(buttons()[1])
      await userEvent.keyboard('{ArrowDown}')
      expect(document.activeElement).toBe(buttons()[4])
      await userEvent.keyboard('{ArrowUp}{ArrowLeft}')
      expect(document.activeElement).toBe(buttons()[0])
      // Sin salirse por el principio
      await userEvent.keyboard('{ArrowLeft}')
      expect(document.activeElement).toBe(buttons()[0])
      await userEvent.keyboard('{End}')
      expect(document.activeElement).toBe(buttons().at(-1))
      expect(stops()).toEqual([buttons().at(-1)])
      await userEvent.keyboard('{Home}')
      expect(document.activeElement).toBe(buttons()[0])
      // Otra tecla no hace nada
      await userEvent.keyboard('a')
      expect(document.activeElement).toBe(buttons()[0])
    } finally {
      computed.mockRestore()
    }
  })
})

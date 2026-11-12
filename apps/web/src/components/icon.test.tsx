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
})

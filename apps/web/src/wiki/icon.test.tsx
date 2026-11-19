import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import '../i18n.ts'
import { IconChoices, titleIcons } from './icon.tsx'

/** El icono de un formulario, con lo elegido a la vista */
function Form({ start = null }: { start?: string | null }) {
  const [icon, setIcon] = useState<string | null>(start)
  return (
    <>
      <IconChoices value={icon} onChange={setIcon} />
      <output aria-label="Elegido">{icon ?? 'ninguno'}</output>
      <button type="button">Fuera</button>
    </>
  )
}
const chosen = () => screen.getByRole('status', { name: 'Elegido' }).textContent

describe('el icono en un formulario', () => {
  it('los iconos de la app, sin emojis por defecto: elegir uno lo pone en el botón y el foco vuelve a él', async () => {
    render(<Form />)
    const button = screen.getByRole('button', { name: 'Sin icono' })
    expect(screen.queryByRole('radio')).toBeNull()
    expect(screen.queryByRole('textbox', { name: 'Otro emoji' })).toBeNull()
    await userEvent.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    // Se abre para buscar
    expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: 'Buscar un icono' }))
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar un icono' }), 'castillo')
    await userEvent.click(screen.getByRole('button', { name: 'Castillo' }))
    expect(chosen()).toBe('gi:castle')
    expect(screen.queryByRole('searchbox', { name: 'Buscar un icono' })).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Castillo' }))
  })

  it('«Quitar el icono», solo con uno puesto; un emoji de antes se sigue viendo', async () => {
    render(<Form start="🐉" />)
    await userEvent.click(screen.getByRole('button', { name: '🐉' }))
    await userEvent.click(screen.getByRole('button', { name: 'Quitar el icono' }))
    expect(chosen()).toBe('ninguno')
    await userEvent.click(screen.getByRole('button', { name: 'Sin icono' }))
    expect(screen.queryByRole('button', { name: 'Quitar el icono' })).toBeNull()
  })

  it('Escape cierra el buscador (sin elegir) y el foco vuelve al botón; pulsar fuera también lo cierra', async () => {
    render(<Form start="gi:castle" />)
    const button = screen.getByRole('button', { name: 'Castillo' })
    await userEvent.click(button)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('searchbox', { name: 'Buscar un icono' })).toBeNull()
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(button)
    expect(chosen()).toBe('gi:castle')
    await userEvent.click(button)
    // Pulsar dentro no lo cierra; fuera, sí
    await userEvent.click(screen.getByRole('searchbox', { name: 'Buscar un icono' }))
    expect(screen.getByRole('searchbox', { name: 'Buscar un icono' })).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Fuera' }))
    expect(screen.queryByRole('searchbox', { name: 'Buscar un icono' })).toBeNull()
  })
})

describe('«:» en un título', () => {
  it('propone los iconos de la app por su nombre (sin tildes), unos pocos; sin nada escrito, los primeros', () => {
    expect(titleIcons('dragon').map((icon) => icon.id)).toContain('dragon-head')
    expect(titleIcons('').length).toBe(16)
    expect(titleIcons('zzzz')).toEqual([])
  })
})

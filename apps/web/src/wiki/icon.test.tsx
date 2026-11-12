import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import '../i18n.ts'
import { IconChoices } from './icon.tsx'

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
  it('otro emoji escrito o pegado se elige; lo que no es un emoji, no', async () => {
    render(<Form />)
    const other = screen.getByRole('textbox', { name: 'Otro emoji' })
    await userEvent.type(other, 'abc')
    expect(chosen()).toBe('ninguno')
    await userEvent.clear(other)
    await userEvent.type(other, '🦑')
    expect(chosen()).toBe('🦑')
    // Marcada como la elegida
    expect(other.hasAttribute('data-chosen')).toBe(true)
    await userEvent.click(screen.getByRole('radio', { name: 'Sin icono' }))
    expect(chosen()).toBe('ninguno')
    expect(other.hasAttribute('data-chosen')).toBe(false)
  })

  it('«Más iconos» abre el buscador: elegir uno lo pone como una casilla más y el foco vuelve al botón', async () => {
    render(<Form />)
    const more = screen.getByRole('button', { name: 'Más iconos' })
    await userEvent.click(more)
    expect(more.getAttribute('aria-expanded')).toBe('true')
    // Se abre para buscar
    expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: 'Buscar un icono' }))
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar un icono' }), 'castillo')
    await userEvent.click(screen.getByRole('button', { name: 'Castillo' }))
    expect(chosen()).toBe('gi:castle')
    expect(screen.queryByRole('searchbox', { name: 'Buscar un icono' })).toBeNull()
    expect(document.activeElement).toBe(more)
    // Sale como una casilla más, ya marcada
    expect(screen.getByRole('radio', { name: 'Castillo' })).toHaveProperty('checked', true)
  })

  it('Escape cierra el buscador (sin elegir) y el foco vuelve al botón; pulsar fuera también lo cierra', async () => {
    render(<Form start="🐉" />)
    const more = screen.getByRole('button', { name: 'Más iconos' })
    await userEvent.click(more)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('searchbox', { name: 'Buscar un icono' })).toBeNull()
    expect(more.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(more)
    expect(chosen()).toBe('🐉')
    await userEvent.click(more)
    // Pulsar dentro no lo cierra; fuera, sí
    await userEvent.click(screen.getByRole('searchbox', { name: 'Buscar un icono' }))
    expect(screen.getByRole('searchbox', { name: 'Buscar un icono' })).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Fuera' }))
    expect(screen.queryByRole('searchbox', { name: 'Buscar un icono' })).toBeNull()
    // Y otra vez el botón lo abre y lo cierra
    await userEvent.click(more)
    await userEvent.click(more)
    expect(more.getAttribute('aria-expanded')).toBe('false')
  })
})

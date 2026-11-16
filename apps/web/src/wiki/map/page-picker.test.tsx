import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../../i18n.ts'
import { PagePicker } from './page-picker.tsx'

const PAGES = [
  { id: crypto.randomUUID(), title: 'El robo del relicario de Valdren', path: ['El robo del relicario de Valdren'] },
  { id: crypto.randomUUID(), title: 'Valdren', path: ['Ciudades', 'Valdren'] },
  { id: crypto.randomUUID(), title: 'Costa Gris', path: ['Costa Gris'] }
]

function picker(value = '') {
  const onCommit = vi.fn()
  render(
    <>
      <label htmlFor="p">Página</label>
      <PagePicker id="p" value={value} pages={PAGES} placeholder="Sin página" onCommit={onCommit} />
    </>
  )
  return { onCommit, input: screen.getByRole('combobox', { name: 'Página' }) }
}

describe('el desplegable de páginas de un pin o una región', () => {
  it('sugiere primero las que empiezan por lo escrito; las flechas eligen e Intro la pone', async () => {
    const { onCommit, input } = picker()
    await userEvent.type(input, 'val')
    const options = screen.getAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual([
      'ValdrenCiudades',
      'El robo del relicario de Valdren',
      'Página nueva: «val»'
    ])
    expect(options[0]?.getAttribute('aria-selected')).toBe('true')
    await userEvent.keyboard('{ArrowDown}{Enter}')
    expect(onCommit).toHaveBeenCalledWith('El robo del relicario de Valdren')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('un nombre que no tiene ninguna, como página nueva; vaciarlo, sin página; Escape solo cierra', async () => {
    const { onCommit, input } = picker('Costa Gris')
    await userEvent.clear(input)
    await userEvent.type(input, 'Puerto Ceniza')
    await userEvent.click(screen.getByRole('option', { name: /Página nueva/ }))
    expect(onCommit).toHaveBeenLastCalledWith('Puerto Ceniza')
    await userEvent.clear(input)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).toBeNull()
    await userEvent.tab()
    expect(onCommit).toHaveBeenLastCalledWith('')
  })
})

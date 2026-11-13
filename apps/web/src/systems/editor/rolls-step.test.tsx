import { cinco } from '@crisol/systems/fixtures'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { lastSaved, renderEditor } from './testing.tsx'

const ROLLS = /¿Cómo se tira\?/
const row = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) })
const openRow = async (name: string) => {
  await userEvent.click(row(name))
  return within(row(name).closest('li') as HTMLElement)
}

describe('el paso «¿Cómo se tira?» del editor de sistemas', () => {
  it('el dado de siempre se escribe con sus espacios; sin él, las tiradas nuevas empiezan con 1d20', async () => {
    const { api, id } = await renderEditor({ step: ROLLS })
    const dice = screen.getByLabelText<HTMLInputElement>('El dado de siempre')
    expect(dice.value).toBe('2d6')
    await userEvent.clear(dice)
    await userEvent.type(dice, '2d6 + 1')
    expect(dice.value).toBe('2d6 + 1')
    await waitFor(async () => expect((await lastSaved(api, id)).dice).toEqual({ critical: 'none', default: '2d6 + 1' }))
    await userEvent.clear(dice)
    await waitFor(async () => expect((await lastSaved(api, id)).dice).toEqual({ critical: 'none' }))
    await userEvent.click(screen.getByRole('button', { name: 'Una tirada' }))
    expect(screen.getByLabelText<HTMLInputElement>('Se tira').value).toBe('1d20')
  })

  it('cuándo es crítico se elige entre las reglas de siempre', async () => {
    const { api, id } = await renderEditor({ step: ROLLS })
    const critical = screen.getByLabelText<HTMLSelectElement>('Cuándo es crítico')
    expect(critical.value).toBe('none')
    expect([...critical.options].map((o) => o.text)).toContain('Un 20 natural (un 1, pifia)')
    await userEvent.selectOptions(critical, 'Dados iguales')
    await waitFor(async () => expect((await lastSaved(api, id)).dice).toEqual({ default: '2d6', critical: 'doubles' }))
  })

  it('una tirada nueva: su nombre ya con el foco y su fórmula leída en palabras; las sugerencias la completan', async () => {
    const { api, id } = await renderEditor({ step: ROLLS })
    await userEvent.click(screen.getByRole('button', { name: 'Una tirada' }))
    const name = screen.getByLabelText<HTMLInputElement>('Nombre')
    expect(document.activeElement).toBe(name)
    await userEvent.clear(name)
    await userEvent.type(name, 'Esquivar')
    const roll = within(row('Esquivar').closest('li') as HTMLElement)
    expect(roll.getByLabelText<HTMLInputElement>('Se tira').value).toBe('2d6')
    // Lo que hay en la ficha: las cifras, lo que se calcula y lo que se gasta
    const suggest = within(roll.getByText('Añadir de la ficha:').parentElement as HTMLElement)
    expect(suggest.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Vigor',
      'Astucia',
      'Presencia',
      'Heridas',
      'Defensa',
      'Carga'
    ])
    await userEvent.click(suggest.getByRole('button', { name: 'Astucia' }))
    expect(roll.getByLabelText<HTMLInputElement>('Se tira').value).toBe('2d6 + @astucia')
    expect(roll.getByText('Se lee:').textContent).toMatch(/Astucia/)
    await waitFor(async () =>
      expect((await lastSaved(api, id)).rolls?.tirada_nueva).toEqual({ label: 'Esquivar', formula: '2d6 + @astucia' })
    )
  })

  it('«Tirar una vez» tira con la ficha de ejemplo; otra fórmula borra el resultado; una que no se puede, lo dice', async () => {
    const { api } = await renderEditor({ step: ROLLS })
    await userEvent.click(screen.getByRole('button', { name: 'Una tirada' }))
    const roll = within(row('Tirada nueva').closest('li') as HTMLElement)
    const formula = roll.getByLabelText<HTMLInputElement>('Se tira')
    await userEvent.clear(formula)
    await userEvent.type(formula, '5')
    await userEvent.click(roll.getByRole('button', { name: 'Tirar una vez' }))
    // En el servidor, con el borrador tal cual
    expect(await roll.findByText('5', { selector: 'strong' })).toBeDefined()
    expect(api.calls.filter((c) => c === 'trySystemRoll')).toHaveLength(1)
    await userEvent.type(formula, ' + @nada')
    expect(roll.queryByText('5', { selector: 'strong' })).toBeNull()
    await userEvent.click(roll.getByRole('button', { name: 'Tirar una vez' }))
    expect(await roll.findByText('Esa tirada no se puede hacer')).toBeDefined()
  })

  it('una tirada por cada característica se prueba con la primera y se anuncia lo que sale', async () => {
    const { api } = await renderEditor({ system: cinco, step: ROLLS })
    expect(row('Prueba de característica').textContent).toContain('Una por cada una')
    const roll = await openRow('Prueba de característica')
    // Las de un conjunto, con el nombre del conjunto
    const suggest = within(roll.getByText('Añadir de la ficha:').parentElement as HTMLElement)
    expect(suggest.getByRole('button', { name: 'Puntuación (Características)' })).toBeDefined()
    expect(suggest.getByRole('button', { name: 'Modificador (Características)' })).toBeDefined()
    await userEvent.click(roll.getByRole('button', { name: 'Tirar una vez' }))
    // Se anuncia el total y su detalle: con la Fuerza de la ficha de ejemplo (14, +2)
    await waitFor(() =>
      expect(
        screen
          .getAllByRole('status')
          .map((s) => s.textContent)
          .join(' ')
      ).toMatch(/^\d+ · 1d20\+2\[Fuerza\]/)
    )
    expect(api.calls).toContain('trySystemRoll')
  })

  it('quitar la tirada de la iniciativa quita también la iniciativa', async () => {
    const { api, id } = await renderEditor({ system: { ...cinco, initiative: 'ataque' }, step: ROLLS })
    const roll = await openRow('Ataque')
    await userEvent.click(roll.getByRole('button', { name: 'Quitar' }))
    expect(await screen.findByText('«Ataque» quitado.', { selector: 'span' })).toBeDefined()
    await waitFor(async () => {
      const saved = await lastSaved(api, id)
      expect(saved.rolls?.ataque).toBeUndefined()
      expect(saved.initiative).toBeUndefined()
    })
  })
})

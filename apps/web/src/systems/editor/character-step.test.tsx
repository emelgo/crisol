import { fronteras } from '@crisol/systems/fixtures'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { lastSaved, renderEditor } from './testing.tsx'

/** La fila de un campo, por su nombre */
const row = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) })
const openRow = async (name: string) => {
  await userEvent.click(row(name))
  return row(name).closest('li') as HTMLElement
}
const example = () => within(screen.getByRole('region', { name: 'Ficha de ejemplo' }))
/** Lo que se anuncia a los lectores de pantalla (la región viva de la web) */
const announced = (text: string | RegExp) =>
  waitFor(() =>
    expect(
      screen
        .getAllByRole('status')
        .map((s) => s.textContent)
        .join(' ')
    ).toMatch(text)
  )

describe('el paso «¿Qué tiene un personaje?» del editor de sistemas', () => {
  it('una cifra: dónde empieza, como poco y como mucho; su resumen cambia con ellos y se guarda', async () => {
    const { api, id } = await renderEditor()
    expect(row('Vigor').textContent).toContain('de -1 a 3')
    const body = within(await openRow('Vigor'))
    const min = body.getByLabelText<HTMLInputElement>('Como poco')
    expect(min.value).toBe('-1')
    await userEvent.clear(body.getByLabelText('Como mucho'))
    await userEvent.type(body.getByLabelText('Como mucho'), '5')
    expect(row('Vigor').textContent).toContain('de -1 a 5')
    // Sin uno de los dos, el resumen dice dónde empieza
    await userEvent.clear(min)
    expect(row('Vigor').textContent).toContain('empieza en 0')
    await userEvent.clear(body.getByLabelText('Empieza en'))
    await userEvent.type(body.getByLabelText('Empieza en'), '2')
    expect(row('Vigor').textContent).toContain('empieza en 2')
    await waitFor(async () => {
      const vigor = (await lastSaved(api, id)).types.personaje?.fields.vigor
      expect(vigor).toMatchObject({ default: 2, max: 5 })
      expect(vigor && 'min' in vigor ? vigor.min : 'sin').toBeUndefined()
    })
  })

  it('su ayuda sale bajo su nombre; borrarla la quita', async () => {
    await renderEditor()
    expect(row('Vigor').textContent).toContain('De −1 a +3')
    const body = within(await openRow('Vigor'))
    const help = body.getByLabelText<HTMLInputElement>('Ayuda')
    await userEvent.clear(help)
    expect(row('Vigor').textContent).not.toContain('De −1 a +3')
    await userEvent.type(help, 'Para aguantar golpes')
    expect(row('Vigor').textContent).toContain('Para aguantar golpes')
  })

  it('algo que se gasta: su máximo es una cifra o una fórmula (con sus espacios: no se los come al escribir)', async () => {
    const { api, id } = await renderEditor()
    const body = within(await openRow('Heridas'))
    const max = body.getByLabelText<HTMLInputElement>('Cuánto hay como mucho')
    expect(max.value).toBe('6')
    await userEvent.clear(max)
    await userEvent.type(max, '3 + @vigor')
    expect(row('Heridas').textContent).toContain('máx. 3 + @vigor')
    await waitFor(async () =>
      expect((await lastSaved(api, id)).types.personaje?.fields.heridas).toMatchObject({ max: '3 + @vigor' })
    )
    await userEvent.clear(max)
    await userEvent.type(max, '8')
    await waitFor(async () =>
      expect((await lastSaved(api, id)).types.personaje?.fields.heridas).toMatchObject({ max: 8 })
    )
    // Sin máximo, sin resumen
    await userEvent.clear(max)
    expect(row('Heridas').textContent).not.toContain('máx.')
  })

  it('algo que se calcula: su fórmula, leída en palabras; si nombra algo que no existe, el campo lo dice', async () => {
    await renderEditor()
    const item = await openRow('Defensa')
    const formula = within(item).getByLabelText<HTMLInputElement>('Cómo se calcula')
    expect(formula.value).toBe('7 + @vigor')
    expect(formula.getAttribute('aria-invalid')).toBeNull()
    expect(row('Defensa').textContent).toContain('Vigor')
    await userEvent.clear(formula)
    await userEvent.type(formula, '7 + @nada')
    await waitFor(() => expect(formula.getAttribute('aria-invalid')).toBe('true'))
    const errors = document.getElementById(formula.getAttribute('aria-describedby') ?? '') as HTMLElement
    expect(within(errors).getByText(/@nada/)).toBeDefined()
    // Su fila y su paso lo marcan
    expect(within(row('Defensa')).getByText('Tiene errores')).toBeDefined()
  })

  it('un texto: cuántas líneas tiene (se puede vaciar para escribir otra cifra)', async () => {
    const { api, id } = await renderEditor()
    await userEvent.click(screen.getByRole('button', { name: 'Un texto' }))
    const lines = await screen.findByLabelText<HTMLInputElement>('Líneas')
    expect(lines.value).toBe('1')
    await userEvent.clear(lines)
    await userEvent.type(lines, '4')
    await waitFor(async () =>
      expect((await lastSaved(api, id)).types.personaje?.fields.texto_nuevo).toMatchObject({
        kind: 'text',
        label: 'Texto nuevo',
        lines: 4
      })
    )
  })

  it('varias a la vez: cuáles son (añadir lleva el foco al nuevo; la última no se quita) y la ficha las enseña', async () => {
    await renderEditor()
    expect(screen.queryByText(/Con esto ya se juega/)).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Varias a la vez' }))
    // Con unas características y algo que se gasta, ya se juega
    expect(await screen.findByText(/Con esto ya se juega/)).toBeDefined()
    const which = within(screen.getByRole('group', { name: 'Cuáles' }))
    await userEvent.clear(which.getByLabelText('Nombre 1'))
    await userEvent.type(which.getByLabelText('Nombre 1'), 'Fuerza')
    expect((await example().findAllByText('Fuerza')).length).toBeGreaterThan(0)
    await userEvent.click(which.getByRole('button', { name: 'Añadir otra' }))
    const added = which.getByLabelText<HTMLInputElement>('Nombre 3')
    expect(added.value).toBe('Nuevo')
    await waitFor(() => expect(document.activeElement).toBe(added))
    await userEvent.click(which.getByRole('button', { name: 'Quitar «Nuevo»' }))
    expect(which.queryByLabelText('Nombre 3')).toBeNull()
    await userEvent.click(which.getByRole('button', { name: 'Quitar «Dos»' }))
    expect(which.getByRole<HTMLButtonElement>('button', { name: 'Quitar «Fuerza»' }).disabled).toBe(true)
  })

  it('lo que tiene cada una: su nombre, otra cifra y «Su modificador», que la ficha calcula', async () => {
    await renderEditor()
    await userEvent.click(screen.getByRole('button', { name: 'Varias a la vez' }))
    const inside = within(await screen.findByRole('group', { name: 'Lo que tiene cada una' }))
    const value = inside.getByLabelText<HTMLInputElement>('Nombre (Una cifra)')
    expect(value.value).toBe('Valor')
    // La única no se quita
    expect(inside.getByRole<HTMLButtonElement>('button', { name: 'Quitar «Valor»' }).disabled).toBe(true)
    await userEvent.click(inside.getByRole('button', { name: 'Su modificador: (valor − 10) ÷ 2' }))
    expect(inside.getByLabelText<HTMLInputElement>('Nombre (Algo que se calcula)').value).toBe('Modificador')
    // Ya lo tiene: no se ofrece otra vez
    expect(inside.queryByRole('button', { name: /Su modificador/ })).toBeNull()
    // En la ficha de ejemplo, la primera vale 14: +2
    expect(await example().findByText('+2')).toBeDefined()
    await userEvent.clear(value)
    await userEvent.type(value, 'Puntuación')
    await userEvent.click(inside.getByRole('button', { name: 'Una cifra' }))
    expect(inside.getAllByLabelText('Nombre (Una cifra)').map((i) => (i as HTMLInputElement).value)).toEqual([
      'Puntuación',
      'Cifra nueva'
    ])
    await userEvent.click(inside.getByRole('button', { name: 'Quitar «Modificador»' }))
    expect(inside.queryByLabelText('Nombre (Algo que se calcula)')).toBeNull()
    expect(inside.getByRole('button', { name: 'Su modificador: (valor − 10) ÷ 2' })).toBeDefined()
  })

  it('una opción: sus opciones, que se añaden y se nombran', async () => {
    const { api, id } = await renderEditor()
    await userEvent.click(screen.getByRole('button', { name: 'Una opción' }))
    const options = within(await screen.findByRole('group', { name: 'Las opciones' }))
    await userEvent.click(options.getByRole('button', { name: 'Añadir otra opción' }))
    const third = options.getByLabelText<HTMLInputElement>('Nombre 3')
    await waitFor(() => expect(document.activeElement).toBe(third))
    await userEvent.clear(third)
    await userEvent.type(third, 'Tercera')
    expect(row('Opción nueva').textContent).toContain('Una, Otra, Tercera')
    await waitFor(async () =>
      expect((await lastSaved(api, id)).types.personaje?.fields.opcion_nueva).toMatchObject({
        options: [{ value: 'una' }, { value: 'otra' }, { value: 'nuevo', label: 'Tercera' }]
      })
    )
  })

  it('subir y bajar un campo: el foco sigue en su botón y se dice dónde quedó', async () => {
    const { api, id } = await renderEditor()
    await openRow('Astucia')
    await userEvent.click(screen.getByRole('button', { name: 'Subir «Astucia»' }))
    await announced('«Astucia», 1 de 8')
    // Llegó arriba: «Subir» se desactiva y el foco pasa a «Bajar»
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Subir «Astucia»' }).disabled).toBe(true)
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Bajar «Astucia»' })))
    await waitFor(async () =>
      expect(Object.keys((await lastSaved(api, id)).types.personaje?.fields ?? {}).slice(0, 2)).toEqual([
        'astucia',
        'vigor'
      ])
    )
    await userEvent.click(screen.getByRole('button', { name: 'Bajar «Astucia»' }))
    await announced('«Astucia», 2 de 8')
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Bajar «Astucia»' })))
    // El último no baja
    await openRow('Lleva')
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Bajar «Lleva»' }).disabled).toBe(true)
  })

  it('«Más» enseña las demás clases; añadir una lo cierra y la abre en su fila', async () => {
    await renderEditor()
    const more = screen.getByRole('button', { name: 'Más' })
    expect(more.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('button', { name: 'Un reloj' })).toBeNull()
    await userEvent.click(more)
    expect(more.getAttribute('aria-expanded')).toBe('true')
    for (const name of ['Algo que se calcula', 'Sí o no', 'Unos dados', 'Una lista', 'Un apartado', 'Una tabla'])
      expect(screen.getByRole('button', { name })).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Un reloj' }))
    expect(more.getAttribute('aria-expanded')).toBe('false')
    expect(row('Reloj nuevo').textContent).toContain('4 partes')
    expect(row('Reloj nuevo').getAttribute('aria-expanded')).toBe('true')
    // Una fila abierta se cierra al pulsarla
    await userEvent.click(row('Reloj nuevo'))
    expect(row('Reloj nuevo').getAttribute('aria-expanded')).toBe('false')
  })

  it('sin personajes, lo dice (y la ficha de ejemplo también)', async () => {
    const { personaje: _, ...types } = fronteras.types
    await renderEditor({
      system: { ...fronteras, types, rolls: {}, creation: [], card: [] }
    })
    expect(screen.getByText('Este sistema aún no tiene personajes.')).toBeDefined()
    expect(example().getByText('Cuando tenga un personaje, aquí saldrá su ficha.')).toBeDefined()
  })
})

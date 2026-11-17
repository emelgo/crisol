import { fronteras } from '@crisol/systems/fixtures'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderEditor } from './testing.tsx'

const announced = (text: string) =>
  waitFor(() =>
    expect(
      screen
        .getAllByRole('status')
        .map((s) => s.textContent)
        .join(' ')
    ).toContain(text)
  )

describe('el editor de un sistema: cargar, guardar y moverse por sus pasos', () => {
  it('si el sistema no llega, lo dice y deja reintentarlo', async () => {
    const { api } = await renderEditor({ fail: { getSystem: 'NOT_FOUND' }, ready: false })
    expect(await screen.findByText('Ya no existe')).toBeDefined()
    const before = api.calls.filter((c) => c === 'getSystem').length
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(api.calls.filter((c) => c === 'getSystem').length).toBeGreaterThan(before))
  })

  it('si alguien lo cambió mientras tanto, lo dice; «Volver a cargar» trae el de ahora', async () => {
    await renderEditor({ fail: { updateSystem: 'SYSTEM_CHANGED' } })
    await userEvent.click(screen.getByRole('button', { name: 'Una cifra' }))
    const alert = await screen.findByRole('alert', {}, { timeout: 4000 })
    expect(alert.textContent).toContain('Lo ha cambiado alguien mientras tanto: vuelve a abrirlo')
    await userEvent.click(within(alert).getByRole('button', { name: 'Volver a cargar' }))
    // El de ahora, sin lo que no se pudo guardar
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Cifra nueva/ })).toBeNull())
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('si no se puede guardar por otra cosa, dice qué pasó', async () => {
    await renderEditor({ fail: { updateSystem: 'NOT_FOUND' } })
    await userEvent.click(screen.getByRole('button', { name: 'Una cifra' }))
    expect((await screen.findByRole('alert', {}, { timeout: 4000 })).textContent).toBe('Ya no existe')
  })

  it('tras un error, arreglarlo guarda y se anuncia «Guardado»', async () => {
    const { api } = await renderEditor()
    await userEvent.click(screen.getByRole('button', { name: /^Defensa/ }))
    const formula = screen.getByLabelText('Cómo se calcula')
    await userEvent.type(formula, ' + @nada')
    await announced('Sin guardar: hay 1 error')
    await userEvent.clear(formula)
    await userEvent.type(formula, '8')
    await announced('Guardado')
    expect(api.calls).toContain('updateSystem')
  })

  it('«Siguiente» y «←» llevan al paso de al lado, con el foco en su pregunta', async () => {
    await renderEditor()
    expect(screen.queryByRole('button', { name: /^←/ })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente: Cómo se tira' }))
    const rolls = await screen.findByRole('heading', { level: 2, name: '¿Cómo se tira?' })
    expect(document.activeElement).toBe(rolls)
    expect(screen.getByRole('button', { name: /¿Cómo se tira\?/ }).getAttribute('aria-current')).toBe('step')
    await userEvent.click(screen.getByRole('button', { name: '← Qué tiene un personaje' }))
    const first = await screen.findByRole('heading', { level: 2, name: '¿Qué tiene un personaje?' })
    expect(document.activeElement).toBe(first)
    // El último no tiene «Siguiente»
    await userEvent.click(screen.getByRole('button', { name: /Avanzado/ }))
    expect(screen.queryByRole('button', { name: /^Siguiente/ })).toBeNull()
  })

  it('«Ir a…» un campo de una clase de cosa cerrada la abre y deja el foco en su fila', async () => {
    const system = structuredClone(fronteras)
    Object.assign(system.types.movimiento?.fields ?? {}, { bono: { kind: 'derived', label: 'Bono', formula: '@nada' } })
    await renderEditor({ system })
    // Su paso lo marca
    expect(
      await within(screen.getByRole('button', { name: /¿Qué se lleva\?/ })).findByText('Tiene errores')
    ).toBeDefined()
    const review = within(screen.getByRole('region', { name: 'Revisión' }))
    await userEvent.click(review.getByRole('button', { name: 'Ir a Qué se lleva' }))
    const bono = await screen.findByRole('button', { name: /^Bono/ })
    await waitFor(() => expect(document.activeElement).toBe(bono))
    expect(bono.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('button', { name: /^Movimiento/ }).getAttribute('aria-expanded')).toBe('true')
  })
})

describe('el «?» del editor', () => {
  it('se abre junto a él con un ejemplo; Escape lo cierra y el foco vuelve al «?»', async () => {
    await renderEditor({ step: /¿Cómo se tira\?/ })
    const help = screen.getByRole('button', { name: 'Qué es: El dado de siempre' })
    expect(help.getAttribute('aria-expanded')).toBe('false')
    await userEvent.click(help)
    expect(help.getAttribute('aria-expanded')).toBe('true')
    const note = screen.getByRole('note')
    expect(help.getAttribute('aria-controls')).toBe(note.id)
    expect(note.textContent).toContain('1d20 en un juego como 5e; 2d6 en uno como Fronteras.')
    // Pulsar dentro no lo cierra
    await userEvent.click(note)
    expect(screen.getByRole('note')).toBeDefined()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('note')).toBeNull()
    expect(document.activeElement).toBe(help)
  })

  it('pulsar fuera o en el «?» otra vez lo cierra', async () => {
    await renderEditor({ step: /¿Cómo se tira\?/ })
    const help = screen.getByRole('button', { name: 'Qué es: El dado de siempre' })
    await userEvent.click(help)
    await userEvent.click(screen.getByRole('heading', { level: 2, name: '¿Cómo se tira?' }))
    expect(screen.queryByRole('note')).toBeNull()
    await userEvent.click(help)
    expect(screen.getByRole('note')).toBeDefined()
    await userEvent.click(help)
    expect(screen.queryByRole('note')).toBeNull()
  })
})

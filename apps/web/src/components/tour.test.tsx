import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'

const ORG = { id: crypto.randomUUID(), name: 'Fateforge', role: 'owner' as const }
const FIRST = 'Un mundo guarda tu wiki, tus campañas y tus partidas.'

const renderWorlds = () => {
  const router = createAppRouter(createMemoryHistory({ initialEntries: ['/mundos'] }))
  const accounts = fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } })
  render(<App router={router} accounts={accounts.client} api={fakeApi({ organizations: [ORG] }).client} />)
}

const openSettings = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'Enrique' }))
  await userEvent.click(screen.getByRole('button', { name: 'Ajustes' }))
  return within(await screen.findByRole('dialog', { name: 'Ajustes' }))
}

describe('el recorrido', () => {
  beforeEach(() => localStorage.clear())

  it('va hacia atrás desde el segundo paso', async () => {
    renderWorlds()
    const bubble = within(await screen.findByRole('dialog', { name: FIRST }))
    expect(bubble.queryByRole('button', { name: 'Atrás' })).toBeNull()
    await userEvent.click(bubble.getByRole('button', { name: 'Siguiente' }))
    await userEvent.click(
      within(screen.getByRole('dialog', { name: /Historial|todo lo que se hace/ })).getByRole('button', {
        name: 'Atrás'
      })
    )
    expect(screen.getByRole('dialog', { name: FIRST })).toBeDefined()
  })

  it('saltado, vuelve a salir al cerrar Ajustes con la casilla marcada', async () => {
    renderWorlds()
    await userEvent.click(
      within(await screen.findByRole('dialog', { name: FIRST })).getByRole('button', { name: 'Saltar' })
    )
    expect(screen.queryByRole('dialog', { name: FIRST })).toBeNull()
    const settings = await openSettings()
    expect(settings.getByRole<HTMLInputElement>('checkbox', { name: 'Mostrar los recorridos' }).checked).toBe(true)
    await userEvent.click(settings.getByRole('button', { name: 'Cerrar' }))
    expect(await screen.findByRole('dialog', { name: FIRST })).toBeDefined()
  })

  it('con «Lo tengo claro», la casilla se ve sin marcar y al marcarla vuelve a salir', async () => {
    renderWorlds()
    await screen.findByRole('dialog', { name: FIRST })
    for (;;) {
      const next = screen.queryByRole('button', { name: 'Siguiente' })
      if (!next) break
      await userEvent.click(next)
    }
    await userEvent.click(screen.getByRole('checkbox', { name: 'Lo tengo claro' }))
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }))
    const settings = await openSettings()
    const box = settings.getByRole<HTMLInputElement>('checkbox', { name: 'Mostrar los recorridos' })
    expect(box.checked).toBe(false)
    await userEvent.click(box)
    await userEvent.click(settings.getByRole('button', { name: 'Cerrar' }))
    expect(await screen.findByRole('dialog', { name: FIRST })).toBeDefined()
  })

  it('al cerrar otra ventana no vuelve a salir', async () => {
    renderWorlds()
    await userEvent.click(
      within(await screen.findByRole('dialog', { name: FIRST })).getByRole('button', { name: 'Saltar' })
    )
    await userEvent.click(screen.getByRole('button', { name: 'Historial' }))
    await userEvent.click(
      within(await screen.findByRole('dialog', { name: 'Historial' })).getByRole('button', { name: 'Cerrar' })
    )
    await new Promise((resolve) => setTimeout(resolve, 600))
    expect(screen.queryByRole('dialog', { name: FIRST })).toBeNull()
  })
})

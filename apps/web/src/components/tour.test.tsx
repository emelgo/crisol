import { createMemoryHistory } from '@tanstack/react-router'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'

const ORG = { id: crypto.randomUUID(), name: 'Fateforge', role: 'owner' as const }
const FIRST = 'Un mundo guarda sus páginas, tus campañas y tus partidas.'
const HELP = 'Tutorial guiado de esta vista'

const renderWorlds = () => {
  const router = createAppRouter(createMemoryHistory({ initialEntries: ['/mundos'] }))
  const accounts = fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } })
  render(<App router={router} accounts={accounts.client} api={fakeApi({ organizations: [ORG] }).client} />)
}

/** Hasta el final, con Siguiente y, en el último paso, Entendido */
const finish = async () => {
  for (;;) {
    const next = screen.queryByRole('button', { name: 'Siguiente' })
    if (!next) break
    await userEvent.click(next)
  }
  await userEvent.click(screen.getByRole('button', { name: 'Entendido' }))
}

/** Lo que tarda en salir solo, y un poco más */
const wait = () => new Promise((resolve) => setTimeout(resolve, 600))

describe('el tutorial guiado', () => {
  beforeEach(() => localStorage.clear())

  it('sale la primera vez, sin Saltar ni «Lo tengo claro», y una vez acabado ya no sale solo', async () => {
    renderWorlds()
    const bubble = within(await screen.findByRole('dialog', { name: FIRST }))
    expect(bubble.queryByRole('button', { name: 'Saltar' })).toBeNull()
    await finish()
    expect(screen.queryByRole('checkbox', { name: 'Lo tengo claro' })).toBeNull()
    cleanup()
    renderWorlds()
    await screen.findByRole('button', { name: HELP })
    await wait()
    expect(screen.queryByRole('dialog', { name: FIRST })).toBeNull()
  })

  it('va hacia atrás desde el segundo paso', async () => {
    renderWorlds()
    const bubble = within(await screen.findByRole('dialog', { name: FIRST }))
    expect(bubble.queryByRole('button', { name: 'Atrás' })).toBeNull()
    await userEvent.click(bubble.getByRole('button', { name: 'Siguiente' }))
    await userEvent.click(screen.getByRole('button', { name: 'Atrás' }))
    expect(screen.getByRole('dialog', { name: FIRST })).toBeDefined()
  })

  it('el «?» lo vuelve a sacar', async () => {
    renderWorlds()
    await screen.findByRole('dialog', { name: FIRST })
    await finish()
    await userEvent.click(screen.getByRole('button', { name: HELP }))
    expect(screen.getByRole('dialog', { name: FIRST })).toBeDefined()
  })

  it('cerrado con Escape sin acabarlo, vuelve a salir la próxima vez', async () => {
    renderWorlds()
    await screen.findByRole('dialog', { name: FIRST })
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: FIRST })).toBeNull()
    cleanup()
    renderWorlds()
    expect(await screen.findByRole('dialog', { name: FIRST })).toBeDefined()
  })

  it('Ajustes ya no tiene la casilla', async () => {
    renderWorlds()
    await screen.findByRole('dialog', { name: FIRST })
    await finish()
    await userEvent.click(screen.getByRole('button', { name: 'Enrique' }))
    await userEvent.click(screen.getByRole('button', { name: 'Ajustes' }))
    const settings = within(await screen.findByRole('dialog', { name: 'Ajustes' }))
    expect(settings.queryByRole('checkbox')).toBeNull()
  })
})

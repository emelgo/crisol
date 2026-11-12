import type { World } from '@crisol/contracts'
import { cinco } from '@crisol/systems/fixtures'
import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'
import { readChapter, writeChapter } from './chapter-text.tsx'

const ORG = { id: crypto.randomUUID(), name: 'Fateforge', role: 'owner' as const }
const WORLD: World = {
  id: crypto.randomUUID(),
  organizationId: ORG.id,
  name: 'Eana',
  description: '',
  icon: null,
  color: null,
  cover: null,
  role: 'master',
  version: 1
}
const OWN = { ...structuredClone(cinco), id: crypto.randomUUID() }

const COMBATE = `Cada asalto dura seis segundos.

## La iniciativa

Tira 1d20.

> [!secreto]
> Los goblins huyen.`

async function renderBook(path: string) {
  const api = fakeApi({ organizations: [ORG], worlds: [WORLD], systems: [OWN] })
  const first = await api.client.call('saveChapter', {
    systemId: OWN.id,
    source: 'srd51',
    title: 'El combate',
    markdown: COMBATE
  })
  await api.client.call('saveChapter', { systemId: OWN.id, source: 'srd51', title: 'La magia', markdown: 'Espacios.' })
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }))
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
      api={api.client}
    />
  )
  return { api, router, first }
}

describe('el texto de un capítulo, en Markdown', () => {
  it('sus secretos van dentro y vuelven igual', () => {
    const { body, separates } = readChapter(COMBATE)
    expect(separates.size).toBe(1)
    const written = writeChapter(body, separates)
    expect(written).toContain('> [!secreto]')
    expect(written).toContain('> Los goblins huyen.')
    // Leído y escrito otra vez, no cambia
    const again = readChapter(written)
    expect(writeChapter(again.body, again.separates)).toBe(written)
  })
})

describe('el lector de capítulos (ADR-0025)', () => {
  beforeEach(() =>
    localStorage.setItem('crisol.recorridos.enrique@crisol.test', JSON.stringify({ seen: ['sistemas', 'compendio'] }))
  )

  it('abre en el primero, con sus secciones en el índice; «Siguiente» lleva al otro', async () => {
    const { router } = await renderBook(`/sistemas/${OWN.id}/libros/srd51`)
    const index = within(await screen.findByRole('navigation', { name: 'Capítulos' }))
    expect(index.getByRole('link', { name: 'El combate' }).getAttribute('aria-current')).toBe('page')
    expect(await index.findByRole('link', { name: 'La iniciativa' })).toBeDefined()
    expect(screen.getByLabelText('Título del capítulo')).toHaveProperty('value', 'El combate')
    // El secreto, al dueño
    expect(await screen.findByText('Los goblins huyen.')).toBeDefined()
    const pager = within(screen.getByRole('navigation', { name: 'Anterior y siguiente' }))
    await userEvent.click(pager.getByRole('link', { name: /Siguiente/ }))
    await waitFor(() => expect(screen.getByLabelText('Título del capítulo')).toHaveProperty('value', 'La magia'))
    expect(router.state.location.search).toMatchObject({ vista: 'capitulos' })
  })

  it('cambiar el título lo guarda con su versión y lo pone en el índice', async () => {
    const { api, first } = await renderBook(`/sistemas/${OWN.id}/libros/srd51`)
    const title = await screen.findByLabelText('Título del capítulo')
    await userEvent.clear(title)
    await userEvent.type(title, 'El asalto{Enter}')
    const index = within(screen.getByRole('navigation', { name: 'Capítulos' }))
    expect(await index.findByRole('link', { name: 'El asalto' })).toBeDefined()
    const saved = await api.client.call('getChapter', { chapterId: first.id })
    expect(saved).toMatchObject({ title: 'El asalto', version: 2 })
  })

  it('borrar uno pregunta antes y abre el siguiente', async () => {
    await renderBook(`/sistemas/${OWN.id}/libros/srd51`)
    await userEvent.click(await screen.findByRole('button', { name: 'Más acciones del capítulo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Borrar capítulo' }))
    const dialog = within(screen.getByRole('dialog', { name: '¿Borrar «El combate»?' }))
    await userEvent.click(dialog.getByRole('button', { name: 'Borrar capítulo' }))
    await waitFor(() => expect(screen.getByLabelText('Título del capítulo')).toHaveProperty('value', 'La magia'))
    const index = within(screen.getByRole('navigation', { name: 'Capítulos' }))
    expect(index.queryByRole('link', { name: 'El combate' })).toBeNull()
  })
})

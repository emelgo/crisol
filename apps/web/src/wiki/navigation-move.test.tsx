import type { World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'

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
const ids = { port: crypto.randomUUID(), velaria: crypto.randomUUID(), maela: crypto.randomUUID() }

const renderAt = (pageId: string) => {
  const api = fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    pages: [
      { id: ids.port, worldId: WORLD.id, title: 'Puerto Ceniza' },
      { id: ids.velaria, worldId: WORLD.id, title: 'Velaria' },
      { id: ids.maela, worldId: WORLD.id, title: 'Maela Varn' }
    ]
  })
  const router = createAppRouter(createMemoryHistory({ initialEntries: [`/mundos/${WORLD.id}/wiki/${pageId}`] }))
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
      api={api.client}
    />
  )
  return { api, router }
}
const tabs = async () => within(await screen.findByRole('navigation', { name: 'Páginas abiertas' }))
const titles = async () => (await tabs()).getAllByRole('link').map((link) => link.textContent)

/** Abre las tres páginas, una tras otra */
async function openAll(router: ReturnType<typeof renderAt>['router']) {
  for (const [pageId, title] of [
    [ids.velaria, 'Velaria'],
    [ids.maela, 'Maela Varn']
  ] as const) {
    await router.navigate({ to: '/mundos/$worldId/wiki/$pageId', params: { worldId: WORLD.id, pageId } })
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeDefined()
  }
  await waitFor(async () => expect(await titles()).toEqual(['Puerto Ceniza', 'Velaria', 'Maela Varn']))
}

describe('recolocar las pestañas', () => {
  it('Alt y las flechas la mueven a izquierda y derecha; en los bordes no hace nada', async () => {
    const { router, api } = renderAt(ids.port)
    await screen.findByRole('heading', { level: 1, name: 'Puerto Ceniza' })
    await openAll(router)
    ;(await tabs()).getByRole('link', { name: 'Maela Varn' }).focus()
    await userEvent.keyboard('{Alt>}{ArrowLeft}{/Alt}')
    await waitFor(async () => expect(await titles()).toEqual(['Puerto Ceniza', 'Maela Varn', 'Velaria']))
    await userEvent.keyboard('{Alt>}{ArrowLeft}{/Alt}')
    await waitFor(async () => expect(await titles()).toEqual(['Maela Varn', 'Puerto Ceniza', 'Velaria']))
    const saves = api.calls.filter((call) => call === 'setWikiTabs').length
    // Ya la primera: más a la izquierda, nada; sin Alt, tampoco
    ;(await tabs()).getByRole('link', { name: 'Maela Varn' }).focus()
    await userEvent.keyboard('{Alt>}{ArrowLeft}{/Alt}')
    await userEvent.keyboard('{ArrowRight}')
    expect(api.calls.filter((call) => call === 'setWikiTabs')).toHaveLength(saves)
    expect(await titles()).toEqual(['Maela Varn', 'Puerto Ceniza', 'Velaria'])
    ;(await tabs()).getByRole('link', { name: 'Maela Varn' }).focus()
    await userEvent.keyboard('{Alt>}{ArrowRight}{/Alt}')
    await waitFor(async () => expect(await titles()).toEqual(['Puerto Ceniza', 'Maela Varn', 'Velaria']))
  })

  it('arrastrando una pestaña se pone en el sitio de otra', async () => {
    const { router } = renderAt(ids.port)
    await screen.findByRole('heading', { level: 1, name: 'Puerto Ceniza' })
    await openAll(router)
    const item = async (name: string) => (await tabs()).getByRole('link', { name }).closest('li') as HTMLElement
    const dragged = await item('Maela Varn')
    const target = await item('Puerto Ceniza')
    // Pasar por encima sin arrastrar nada no marca nada
    fireEvent.dragOver(target)
    expect(target.hasAttribute('data-over')).toBe(false)
    fireEvent.dragStart(dragged, { dataTransfer: { effectAllowed: 'all', setData: () => undefined } })
    expect(dragged.hasAttribute('data-dragging')).toBe(true)
    fireEvent.dragOver(target)
    expect(target.hasAttribute('data-over')).toBe(true)
    fireEvent.drop(target)
    await waitFor(async () => expect(await titles()).toEqual(['Maela Varn', 'Puerto Ceniza', 'Velaria']))
    expect((await item('Maela Varn')).hasAttribute('data-dragging')).toBe(false)

    // Soltarla sobre sí misma, o acabar sin soltar, la deja donde estaba
    const again = await item('Velaria')
    fireEvent.dragStart(again, { dataTransfer: { effectAllowed: 'all', setData: () => undefined } })
    fireEvent.drop(again)
    fireEvent.dragStart(again, { dataTransfer: { effectAllowed: 'all', setData: () => undefined } })
    fireEvent.dragEnd(again)
    expect(again.hasAttribute('data-dragging')).toBe(false)
    expect(await titles()).toEqual(['Maela Varn', 'Puerto Ceniza', 'Velaria'])
  })
})

describe('marcar con grupos', () => {
  it('con grupos, se elige uno que ya existe; Escape cierra la elección', async () => {
    const { router } = renderAt(ids.port)
    await userEvent.click(await screen.findByRole('button', { name: 'Marcar' }))
    const bookmarks = async () => within(await screen.findByRole('region', { name: 'Marcadores' }))
    expect(await (await bookmarks()).findByRole('link', { name: 'Puerto Ceniza' })).toBeDefined()

    await router.navigate({ to: '/mundos/$worldId/wiki/$pageId', params: { worldId: WORLD.id, pageId: ids.maela } })
    await screen.findByRole('heading', { level: 1, name: 'Maela Varn' })
    const mark = await screen.findByRole('button', { name: 'Marcar' })
    await userEvent.click(mark)
    expect(mark.getAttribute('aria-expanded')).toBe('true')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Guardar en' })).toBeNull())
    expect(mark.getAttribute('aria-expanded')).toBe('false')
    // El foco vuelve a «Marcar»
    expect(document.activeElement).toBe(mark)

    await userEvent.click(mark)
    const choose = screen.getByRole('group', { name: 'Guardar en' })
    await userEvent.click(within(choose).getByRole('button', { name: /^Marcadores/ }))
    await waitFor(async () =>
      expect(
        within((await bookmarks()).getByRole('list'))
          .getAllByRole('link')
          .map((link) => link.textContent)
      ).toEqual(['Puerto Ceniza', 'Maela Varn'])
    )
  })
})

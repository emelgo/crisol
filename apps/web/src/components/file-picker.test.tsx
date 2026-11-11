import type { World } from '@crisol/contracts'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiProvider } from '../api/context.tsx'
import { fakeApi } from '../api/fake.ts'
import '../i18n.ts'
import { FilePicker } from './file-picker.tsx'

const ORG = { id: crypto.randomUUID(), name: 'Fateforge', role: 'owner' as const }
const WORLD = { id: crypto.randomUUID(), organizationId: ORG.id, name: 'Eana', role: 'master' } as World
const PLACES = crypto.randomUUID()
const SEALS = crypto.randomUUID()
const MAP = crypto.randomUUID()

function mount({ inWorld = true, chosenId = null as string | null } = {}) {
  const onPick = vi.fn()
  const onClose = vi.fn()
  const api = fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    folders: [
      { id: PLACES, worldId: WORLD.id, organizationId: ORG.id, parentId: null, name: 'Lugares' },
      { id: SEALS, worldId: null, organizationId: ORG.id, parentId: null, name: 'Sellos' }
    ],
    files: [
      { id: MAP, worldId: WORLD.id, organizationId: ORG.id, name: 'mapa.png', kind: 'image', folderId: PLACES },
      { worldId: WORLD.id, organizationId: ORG.id, name: 'reglas.pdf', kind: 'pdf' },
      { worldId: null, organizationId: ORG.id, name: 'runa.png', kind: 'image', folderId: SEALS, tags: ['magia'] },
      { worldId: null, organizationId: ORG.id, name: 'escudo.png', kind: 'image' }
    ]
  })
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ApiProvider client={api.client}>
        <FilePicker
          worldId={inWorld ? WORLD.id : undefined}
          kind="image"
          title="Elegir de tus archivos"
          chosenId={chosenId}
          onPick={onPick}
          onClose={onClose}
        />
      </ApiProvider>
    </QueryClientProvider>
  )
  return { onPick, onClose, dialog: within(screen.getByRole('dialog', { name: 'Elegir de tus archivos' })) }
}

describe('el selector de archivos', () => {
  it('las carpetas del mundo y «Comunes», cerradas, solo con lo del tipo pedido; pulsar una la despliega', async () => {
    const user = userEvent.setup()
    const { dialog } = mount()
    const places = await dialog.findByRole('button', { name: 'Lugares' })
    expect(places.getAttribute('aria-expanded')).toBe('false')
    expect(dialog.getByRole('button', { name: 'Comunes' })).toBeDefined()
    expect(dialog.queryByRole('button', { name: 'reglas.pdf' })).toBeNull()
    expect(dialog.queryByRole('button', { name: 'mapa.png' })).toBeNull()
    await user.click(places)
    expect(places.getAttribute('aria-expanded')).toBe('true')
    expect(dialog.getByRole('button', { name: 'mapa.png' })).toBeDefined()
  })

  it('pulsar un archivo lo elige y cierra la ventana', async () => {
    const user = userEvent.setup()
    const { dialog, onPick, onClose } = mount()
    await user.click(await dialog.findByRole('button', { name: 'Comunes' }))
    await user.click(dialog.getByRole('button', { name: 'escudo.png' }))
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ name: 'escudo.png' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('al buscar, lo encontrado dentro de todas sus carpetas, también por #etiqueta', async () => {
    const user = userEvent.setup()
    const { dialog } = mount()
    await dialog.findByRole('button', { name: 'Lugares' })
    await user.type(dialog.getByRole('searchbox'), '#mag')
    expect(dialog.getByRole('button', { name: 'Comunes' }).getAttribute('aria-expanded')).toBe('true')
    expect(dialog.getByRole('button', { name: 'Sellos' })).toBeDefined()
    expect(dialog.getByRole('button', { name: 'runa.png' })).toBeDefined()
    expect(dialog.queryByRole('button', { name: 'Lugares' })).toBeNull()
    await user.clear(dialog.getByRole('searchbox'))
    await user.type(dialog.getByRole('searchbox'), 'nada así')
    expect(dialog.getByText('Ningún archivo se llama así.')).toBeDefined()
  })

  it('el ya elegido sale marcado, con sus carpetas abiertas', async () => {
    const { dialog } = mount({ chosenId: MAP })
    const map = await dialog.findByRole('button', { name: 'mapa.png' })
    expect(map.getAttribute('aria-current')).toBe('true')
  })

  it('sin mundo (al crear uno), solo los comunes, sin «Comunes»', async () => {
    const { dialog } = mount({ inWorld: false })
    expect(await dialog.findByRole('button', { name: 'Sellos' })).toBeDefined()
    expect(dialog.getByRole('button', { name: 'escudo.png' })).toBeDefined()
    expect(dialog.queryByRole('button', { name: 'Comunes' })).toBeNull()
    expect(dialog.queryByRole('button', { name: 'Lugares' })).toBeNull()
  })
})

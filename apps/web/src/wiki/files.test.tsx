import type { World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'

const ORG = { id: crypto.randomUUID(), name: 'Fateforge', role: 'owner' as const }
const WORLD: World = { id: crypto.randomUUID(), organizationId: ORG.id, name: 'Eana', role: 'master', version: 1 }

const filesApi = () =>
  fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    files: [
      { worldId: WORLD.id, name: 'Mapa de Eana.png', kind: 'image', size: 2.5 * 1024 * 1024 },
      { worldId: WORLD.id, name: 'Bestiario.pdf', kind: 'pdf', mime: 'application/pdf', size: 300 * 1024, usedBy: 2 },
      { worldId: WORLD.id, name: 'Notas.txt', kind: 'other', mime: 'application/octet-stream', size: 512 }
    ]
  })

const renderAt = (path: string, api = filesApi()) => {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }))
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
      api={api.client}
    />
  )
  return api
}
const group = async (name: RegExp) => within(await screen.findByRole('region', { name }))

describe('los archivos del mundo', () => {
  it('desde la wiki se llega; se ordenan por tipo, con su tamaño, y el nombre los abre', async () => {
    renderAt(`/mundos/${WORLD.id}/wiki`)
    await userEvent.click(await screen.findByRole('link', { name: 'Archivos' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Archivos de Eana' })).toBeDefined()
    const images = await group(/Imágenes/)
    const map = images.getByRole('link', { name: 'Mapa de Eana.png' })
    expect(map.getAttribute('target')).toBe('_blank')
    expect(map.getAttribute('href')).toMatch(/^\/api\/files\//)
    expect(images.getByText('2,5 MB')).toBeDefined()
    expect((await group(/PDF/)).getByRole('link', { name: 'Bestiario.pdf' })).toBeDefined()
    expect((await group(/Otros/)).getByText('0,5 kB')).toBeDefined()
  })

  it('subir varios: cada uno con su progreso; al acabar, en su carpeta, y uno muy grande no se intenta', async () => {
    const api = renderAt(`/mundos/${WORLD.id}/archivos`)
    await screen.findByRole('heading', { level: 1, name: 'Archivos de Eana' })
    const input = document.querySelector<HTMLInputElement>('input[type=file][multiple]')
    if (!input) throw new Error('sin campo de archivos')
    const huge = new File(['x'], 'Enorme.pdf', { type: 'application/pdf' })
    Object.defineProperty(huge, 'size', { value: 300 * 1024 * 1024 })
    await userEvent.upload(input, [
      new File(['%PDF'], 'Atlas.pdf', { type: 'application/pdf' }),
      new File(['png'], 'Escudo.png', { type: 'image/png' }),
      huge
    ])
    const uploads = await group(/Subidas/)
    await waitFor(() => expect(uploads.getAllByText('Subido')).toHaveLength(2))
    expect(uploads.getByText('No se pudo: Pasa de 250 MB')).toBeDefined()
    expect(api.calls.filter((call) => call === 'uploadFile')).toHaveLength(2)
    expect((await group(/PDF/)).getByRole('link', { name: 'Atlas.pdf' })).toBeDefined()
    expect((await group(/Imágenes/)).getByRole('link', { name: 'Escudo.png' })).toBeDefined()
    await userEvent.click(uploads.getByRole('button', { name: 'Quitar las terminadas' }))
    expect(screen.queryByRole('region', { name: /Subidas/ })).toBeNull()
  })

  it('renombrar (sin repetir nombre), reemplazar y mandar a la papelera, de donde vuelve', async () => {
    const api = renderAt(`/mundos/${WORLD.id}/archivos`)
    await userEvent.click(await screen.findByRole('button', { name: 'Renombrar Mapa de Eana.png' }))
    const field = screen.getByLabelText('Nuevo nombre de Mapa de Eana.png')
    await userEvent.clear(field)
    await userEvent.type(field, 'bestiario.pdf{Enter}')
    expect(await screen.findByText('Ya hay un archivo con ese nombre')).toBeDefined()
    await userEvent.clear(field)
    await userEvent.type(field, 'Mapa del norte.png{Enter}')
    expect(await screen.findByRole('link', { name: 'Mapa del norte.png' })).toBeDefined()

    const replace = document.querySelectorAll<HTMLInputElement>('li input[type=file]')[0]
    if (!replace) throw new Error('sin campo de reemplazo')
    await userEvent.upload(replace, new File(['nuevo'], 'otro.png', { type: 'image/png' }))
    await waitFor(() => expect(api.calls).toContain('uploadFile'))

    await userEvent.click(screen.getByRole('button', { name: 'Borrar Bestiario.pdf' }))
    // Lo usan dos páginas: se avisa
    expect(screen.getByText(/Lo usan 2 páginas/)).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Borrar' }))
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Bestiario.pdf' })).toBeNull())
    const trash = await api.client.call('listTrash', { worldId: WORLD.id })
    expect(trash.items).toMatchObject([{ kind: 'file', name: 'Bestiario.pdf' }])
    await api.client.call('restoreFile', { fileId: trash.items[0]?.id ?? '' })
    expect((await api.client.call('listFiles', { worldId: WORLD.id })).files.map((f) => f.name)).toContain(
      'Bestiario.pdf'
    )
  })
})

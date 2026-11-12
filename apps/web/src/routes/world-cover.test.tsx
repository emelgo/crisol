import type { World } from '@crisol/contracts'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createEvent, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiProvider } from '../api/context.tsx'
import { fakeApi } from '../api/fake.ts'
import '../i18n.ts'
import { CoverDialog } from './world-cover.tsx'

const ORG = { id: crypto.randomUUID(), name: 'Fateforge', role: 'owner' as const }
const WORLD = { id: crypto.randomUUID(), organizationId: ORG.id, name: 'Eana', role: 'master' } as World
const MAP = crypto.randomUUID()

function mount() {
  const api = fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    files: [{ id: MAP, worldId: WORLD.id, organizationId: ORG.id, name: 'Mapa.png', kind: 'image' }]
  })
  const onSave = vi.fn(async () => {})
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ApiProvider client={api.client}>
        <CoverDialog
          worldId={WORLD.id}
          title="Portada"
          cover={{ fileId: MAP, x: 50, y: 50 }}
          onSave={onSave}
          onClose={() => {}}
        />
      </ApiProvider>
    </QueryClientProvider>
  )
  const dialog = within(screen.getByRole('dialog', { name: 'Portada' }))
  return { api, onSave, dialog }
}

/** Lo que se arrastra encima: archivos del escritorio o, si no, otra cosa (un texto) */
const dragged = (files: File[] = [], types = files.length > 0 ? ['Files'] : ['text/plain']) => ({ types, files })

describe('la ventana de la portada', () => {
  it('acercar con su botón y con la rueda sobre la vista previa; se guarda con el acercamiento', async () => {
    const { onSave, dialog } = mount()
    const preview = await dialog.findByRole('button', { name: /Arrastra para encuadrar/ })
    const slider = dialog.getByRole<HTMLInputElement>('slider', { name: 'Acercar' })
    expect(slider.value).toBe('1')
    await userEvent.click(dialog.getByRole('button', { name: 'Acercar más' }))
    expect(Number(slider.value)).toBeCloseTo(1.1)
    // La rueda hacia arriba acerca y no mueve la página
    const wheel = createEvent.wheel(preview, { deltaY: -100, cancelable: true })
    fireEvent(preview, wheel)
    expect(wheel.defaultPrevented).toBe(true)
    expect(Number(slider.value)).toBeCloseTo(1.2)
    fireEvent.wheel(preview, { deltaY: 100 })
    expect(Number(slider.value)).toBeCloseTo(1.1)
    await userEvent.click(dialog.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    const [saved] = onSave.mock.calls[0] as unknown as [{ fileId: string; zoom: number }]
    expect(saved.fileId).toBe(MAP)
    expect(saved.zoom).toBeCloseTo(1.1)
  })

  it('una imagen del escritorio encima la marca; al irse, ya no; soltada, se sube y es la portada', async () => {
    const { api, dialog } = mount()
    const preview = await dialog.findByRole('button', { name: /Arrastra para encuadrar/ })
    // Lo que no son archivos no se admite
    fireEvent.dragOver(preview, { dataTransfer: dragged() })
    expect(preview.hasAttribute('data-over')).toBe(false)
    fireEvent.dragOver(preview, { dataTransfer: dragged([new File(['png'], 'Costa.png', { type: 'image/png' })]) })
    expect(preview.hasAttribute('data-over')).toBe(true)
    fireEvent.dragLeave(preview)
    expect(preview.hasAttribute('data-over')).toBe(false)
    fireEvent.drop(preview, { dataTransfer: dragged([new File(['png'], 'Costa.png', { type: 'image/png' })]) })
    await waitFor(() => expect(api.calls).toContain('uploadFile'))
    const costa = await waitFor(() => {
      const found = api.files.find((file) => file.name === 'Costa.png')
      if (!found) throw new Error('sin subir')
      return found
    })
    await waitFor(() => expect(preview.querySelector('img')?.getAttribute('src')).toBe(costa.url))
    // Soltar sin archivos no sube nada más
    fireEvent.drop(preview, { dataTransfer: dragged() })
    expect(api.calls.filter((call) => call === 'uploadFile')).toHaveLength(1)
  })

  it('«Subir imagen» abre el selector de archivos; lo que no es una imagen no se sube y se dice', async () => {
    const { api, dialog } = mount()
    await dialog.findByRole('button', { name: /Arrastra para encuadrar/ })
    const input = document.querySelector<HTMLInputElement>('input[type=file][accept="image/*"]')
    if (!input) throw new Error('sin campo de archivos')
    const opened = vi.spyOn(input, 'click')
    await userEvent.click(dialog.getByRole('button', { name: 'Subir imagen' }))
    expect(opened).toHaveBeenCalled()
    await userEvent
      .setup({ applyAccept: false })
      .upload(input, new File(['%PDF'], 'Atlas.pdf', { type: 'application/pdf' }))
    expect(await dialog.findByText('La portada tiene que ser una imagen del mundo')).toBeDefined()
    expect(api.calls).not.toContain('uploadFile')
  })
})

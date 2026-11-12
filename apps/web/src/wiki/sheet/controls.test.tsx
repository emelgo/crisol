import type { Page, World } from '@crisol/contracts'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiProvider } from '../../api/context.tsx'
import { fakeApi } from '../../api/fake.ts'
import '../../i18n.ts'
import { PrintDialog } from './controls.tsx'

const ORG = { id: crypto.randomUUID(), name: 'Fateforge', role: 'owner' as const }
const WORLD = { id: crypto.randomUUID(), organizationId: ORG.id, name: 'Eana', role: 'master' } as World
const PAGE = crypto.randomUUID()

async function mount(sheet?: Page['sheet']) {
  const api = fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    pages: [{ id: PAGE, worldId: WORLD.id, title: 'Puerto Ceniza' }]
  })
  if (sheet) await api.client.call('updatePage', { pageId: PAGE, sheet })
  api.calls.length = 0
  const page = await api.client.call('getPage', { pageId: PAGE })
  const onClose = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ApiProvider client={api.client}>
        <PrintDialog page={page} onClose={onClose} />
      </ApiProvider>
    </QueryClientProvider>
  )
  const dialog = within(screen.getByRole('dialog', { name: 'Imprimir o descargar' }))
  return { api, onClose, dialog }
}

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('«Imprimir o descargar»', () => {
  it('imprimir: el papel, la numeración y el pie se guardan en la página; se abre la impresión con su aspecto y los secretos', async () => {
    localStorage.setItem('crisol.aspecto-impresion', 'neutro')
    const tab = { location: { href: 'about:blank' }, close: vi.fn() }
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)
    const { api, onClose, dialog } = await mount()
    // De entrada, el de la última vez
    expect(dialog.getByRole('radio', { name: 'Blanco y negro' })).toHaveProperty('checked', true)
    await userEvent.selectOptions(dialog.getByLabelText('Papel'), 'Carta')
    const first = dialog.getByLabelText<HTMLInputElement>('Desde')
    await userEvent.clear(first)
    await userEvent.type(first, '3')
    await userEvent.click(dialog.getByRole('checkbox', { name: 'Pie con el título' }))
    await userEvent.click(dialog.getByRole('checkbox', { name: 'Incluir secretos' }))
    await userEvent.click(dialog.getByRole('button', { name: 'Imprimir' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    // La pestaña se abre al pulsar y, ya guardado, va a la impresión
    expect(open).toHaveBeenCalledWith('about:blank', '_blank')
    expect(tab.location.href).toBe(`/mundos/${WORLD.id}/imprimir/${PAGE}?imprimir=1&tema=neutro&secretos=1`)
    expect((await api.client.call('getPage', { pageId: PAGE })).sheet).toMatchObject({
      paper: 'letter',
      firstNumber: 3,
      footer: false,
      numbers: true
    })
    expect(localStorage.getItem('crisol.aspecto-impresion')).toBe('neutro')
  })

  it('sin numerar no pregunta «Desde»; un «Desde» que no vale vuelve al de antes al salir; «Cancelar» cierra sin guardar', async () => {
    const { api, onClose, dialog } = await mount()
    const first = dialog.getByLabelText<HTMLInputElement>('Desde')
    await userEvent.clear(first)
    await userEvent.type(first, '0')
    await userEvent.tab()
    expect(first.value).toBe('1')
    await userEvent.click(dialog.getByRole('checkbox', { name: 'Numerar' }))
    expect(dialog.queryByLabelText('Desde')).toBeNull()
    await userEvent.click(dialog.getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(api.calls).not.toContain('updatePage')
  })

  it('si no se puede guardar, la pestaña que se abrió se cierra y se dice por qué', async () => {
    const tab = { location: { href: 'about:blank' }, close: vi.fn() }
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)
    const { api, onClose, dialog } = await mount()
    const call = api.client.call.bind(api.client)
    api.client.call = ((name: string, input: unknown) => {
      if (name === 'updatePage') return Promise.reject(new Error('caído'))
      return call(name as never, input as never)
    }) as typeof api.client.call
    await userEvent.selectOptions(dialog.getByLabelText('Papel'), 'Carta')
    await userEvent.click(dialog.getByRole('button', { name: 'Imprimir' }))
    expect(await dialog.findByRole('alert')).toBeDefined()
    expect(tab.close).toHaveBeenCalled()
    expect(tab.location.href).toBe('about:blank')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('una página hecha para el pergamino sale con él; sin almacenamiento, también se puede descargar', async () => {
    const { api, onClose, dialog } = await mount({
      paper: 'a4',
      theme: 'pergamino',
      numbers: true,
      firstNumber: 1,
      footer: true,
      columns: 1
    })
    expect(dialog.getByRole('radio', { name: 'Pergamino' })).toHaveProperty('checked', true)
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    URL.createObjectURL = vi.fn(() => 'blob:pdf')
    URL.revokeObjectURL = vi.fn()
    await userEvent.click(dialog.getByRole('button', { name: 'Descargar PDF' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(api.calls).toContain('downloadPdf:pergamino')
  })

  it('sin almacenamiento, de entrada «Con colores» (no se sabe el de la última vez)', async () => {
    localStorage.setItem('crisol.aspecto-impresion', 'neutro')
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    const { dialog } = await mount()
    expect(dialog.getByRole('radio', { name: 'Con colores' })).toHaveProperty('checked', true)
  })

  it('si el navegador no deja abrir otra pestaña, la impresión se abre en esta', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null)
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {})
    const { onClose, dialog } = await mount()
    await userEvent.click(dialog.getByRole('radio', { name: 'Pergamino' }))
    await userEvent.click(dialog.getByRole('button', { name: 'Imprimir' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(assign).toHaveBeenCalledWith(`/mundos/${WORLD.id}/imprimir/${PAGE}?imprimir=1&tema=pergamino`)
  })
})

import type { Campaign, World } from '@crisol/contracts'
import { toFile } from '@crisol/systems'
import { cinco, fronteras } from '@crisol/systems/fixtures'
import { createMemoryHistory } from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
const OWN = { ...structuredClone(fronteras), id: crypto.randomUUID() }

function renderSystems(path = '/sistemas', campaigns: Campaign[] = []) {
  const api = fakeApi({ organizations: [ORG], worlds: [WORLD], campaigns, systems: [OWN] })
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }))
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
      api={api.client}
    />
  )
  return { api, router }
}

/** Sube un archivo al selector del cuadro «Sistema nuevo» */
const pick = (content: unknown, name = 'sistema.json') => {
  const input = screen.getByLabelText<HTMLInputElement>('Elegir el archivo')
  fireEvent.change(input, {
    target: {
      files: [
        new File([typeof content === 'string' ? content : JSON.stringify(content)], name, { type: 'application/json' })
      ]
    }
  })
}

describe('«Sistemas», en Mis mundos', () => {
  // Su tutorial guiado ya visto: si no, sale y se lleva el foco
  beforeEach(() =>
    localStorage.setItem('crisol.recorridos.enrique@crisol.test', JSON.stringify({ seen: ['sistemas', 'sistema'] }))
  )

  it('los tuyos y los de serie; al pasar por uno, lo que trae', async () => {
    renderSystems()
    const mine = within(await screen.findByRole('list', { name: 'Tuyos' }))
    expect(mine.getByRole('link', { name: 'Fronteras' })).toBeDefined()
    expect(mine.getByText('Subido de un archivo')).toBeDefined()
    expect(mine.getByRole('button', { name: 'Ajustes de Fronteras' })).toBeDefined()
    const builtIn = within(screen.getByRole('list', { name: 'De serie' }))
    expect(builtIn.getAllByRole('link').map((a) => a.textContent)).toEqual(['5e', 'En blanco'])
    const blankItem = within(builtIn.getByRole('link', { name: 'En blanco' }).closest('li') as HTMLElement)
    expect(blankItem.getByLabelText('No se puede cambiar')).toBeDefined()
    fireEvent.pointerEnter(mine.getByRole('link', { name: 'Fronteras' }).closest('li') as HTMLElement)
    const preview = within(screen.getByRole('complementary', { name: 'Lo que trae' }))
    expect(preview.getByText('Personaje')).toBeDefined()
    expect(preview.getByText('8 campos')).toBeDefined()
    expect(preview.getByText('Atributo')).toBeDefined()
    expect(preview.getByText('Sin licencia de fuera')).toBeDefined()
  })

  it('desde cero: con su nombre, y se abre', async () => {
    const { api, router } = renderSystems()
    await userEvent.click(await screen.findByRole('button', { name: 'Sistema nuevo' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Sistema nuevo' }))
    await userEvent.type(dialog.getByRole('textbox', { name: 'Nombre' }), 'Páramos')
    await userEvent.click(dialog.getByRole('button', { name: 'Crear el sistema' }))
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/sistemas\/[0-9a-f-]{36}$/))
    expect(await screen.findByRole('heading', { level: 1, name: 'Páramos' })).toBeDefined()
    const { systems } = await api.client.call('listSystems', {})
    expect(systems.find((each) => each.name === 'Páramos')?.basedOn?.id).toBe('blank')
  })

  it('copiar uno de serie, con su nombre de copia', async () => {
    const { api } = renderSystems()
    const builtIn = within(await screen.findByRole('list', { name: 'De serie' }))
    const blankItem = within(builtIn.getByRole('link', { name: 'En blanco' }).closest('li') as HTMLElement)
    await userEvent.click(blankItem.getByRole('button', { name: 'Copiar' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Sistema nuevo' }))
    expect(dialog.getByRole<HTMLInputElement>('textbox', { name: 'Nombre' }).value).toBe('En blanco (copia)')
    expect(dialog.getByRole<HTMLSelectElement>('combobox', { name: 'Copiar de' }).value).toBe('blank')
    await userEvent.click(dialog.getByRole('button', { name: 'Crear el sistema' }))
    await waitFor(() => expect(api.calls.includes('createSystem')).toBe(true))
  })

  it('de un archivo: el roto dice qué falla y no se sube; el bueno, sí', async () => {
    const { api, router } = renderSystems()
    await userEvent.click(await screen.findByRole('button', { name: 'Sistema nuevo' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Sistema nuevo' }))
    await userEvent.click(dialog.getByRole('radio', { name: 'De un archivo' }))
    const broken = structuredClone(fronteras)
    Object.assign(broken.types.personaje?.fields.defensa as object, { formula: '7 + @vigr' })
    pick(toFile(broken, []))
    const alert = within(await dialog.findByRole('alert'))
    expect(alert.getByText('No se ha subido: tiene un problema. Arréglalo y vuelve a subirlo.')).toBeDefined()
    expect(alert.getByText('Personaje › Defensa › Fórmula')).toBeDefined()
    expect(alert.getByText('No existe «@vigr» en Personaje. ¿Quizás «@vigor»?')).toBeDefined()
    expect(alert.getByText('system.types.personaje.fields.defensa.formula')).toBeDefined()
    expect(dialog.getByRole<HTMLButtonElement>('button', { name: 'Subir el sistema' }).disabled).toBe(true)
    pick('{ esto no es json', 'roto.json')
    expect(await dialog.findByText('No se entiende el archivo: no es un JSON')).toBeDefined()
    pick(toFile(cinco, []), 'cinco.json')
    await waitFor(() => expect(dialog.queryByRole('alert')).toBeNull())
    await userEvent.click(dialog.getByRole('button', { name: 'Subir el sistema' }))
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/sistemas\//))
    expect(api.calls.filter((c) => c === 'importSystem')).toHaveLength(1)
  })

  it('su engranaje: renombrarlo, bajarlo y borrarlo', async () => {
    const { api } = renderSystems()
    const created = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
    await userEvent.click(await screen.findByRole('button', { name: 'Ajustes de Fronteras' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Ajustes de Fronteras' }))
    expect(dialog.getByText('Versión 1')).toBeDefined()
    expect(dialog.getByText('Ninguna')).toBeDefined()
    await userEvent.click(dialog.getByRole('button', { name: 'Bajar' }))
    await waitFor(() => expect(created).toHaveBeenCalled())
    expect(api.calls.includes('exportSystem')).toBe(true)
    const name = dialog.getByRole('textbox', { name: 'Nombre' })
    await userEvent.clear(name)
    await userEvent.type(name, 'Fronteras del norte')
    await userEvent.click(dialog.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.getByRole('link', { name: 'Fronteras del norte' })).toBeDefined())
    created.mockRestore()
  })

  it('uno que usa una campaña no se borra, y dice cuál', async () => {
    const campaign: Campaign = {
      id: crypto.randomUUID(),
      worldId: WORLD.id,
      name: 'Los páramos',
      description: '',
      color: null,
      cover: null,
      role: 'master',
      version: 1,
      system: { id: OWN.id, name: 'Fronteras', defaultRoll: '2d6', critical: 'none' },
      systemChoices: { sources: [], language: 'es', settings: {} }
    }
    renderSystems('/sistemas', [campaign])
    await userEvent.click(await screen.findByRole('button', { name: 'Ajustes de Fronteras' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Ajustes de Fronteras' }))
    expect(dialog.getByText('Lo usan «Los páramos»: cámbiales el sistema antes de borrarlo.')).toBeDefined()
    expect(dialog.queryByRole('button', { name: 'Borrar el sistema' })).toBeNull()
  })
})

import type { Campaign, World } from '@crisol/contracts'
import { toFile } from '@crisol/systems'
import { cinco, fronteras } from '@crisol/systems/fixtures'
import { createMemoryHistory } from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { strToU8, zipSync } from 'fflate'
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
    localStorage.setItem('crisol.recorridos.enrique@crisol.test', JSON.stringify({ seen: ['sistemas'] }))
  )

  it('solo los tuyos (sin sistemas de serie); al pasar por uno, lo que trae', async () => {
    renderSystems()
    const mine = within(await screen.findByRole('list', { name: 'Sistemas' }))
    expect(mine.getByRole('link', { name: 'Fronteras' })).toBeDefined()
    expect(mine.getByText('Subido de un archivo')).toBeDefined()
    // Enrique, 2026-11-08: «no debemos tener sistemas de serie»
    expect(screen.queryByRole('list', { name: 'De serie' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'En blanco' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Copiar' })).toBeNull()
    // Su único enlace, su nombre: entra en el sistema, con sus libros (ADR-0021)
    expect(mine.getAllByRole('link').map((l) => l.textContent)).toEqual(['Fronteras'])
    fireEvent.pointerEnter(mine.getByRole('link', { name: 'Fronteras' }).closest('li') as HTMLElement)
    const preview = within(screen.getByRole('complementary', { name: 'Lo que trae' }))
    expect(preview.getByText('Personaje')).toBeDefined()
    expect(preview.getByText('8 campos')).toBeDefined()
    expect(preview.getByText('Atributo')).toBeDefined()
    expect(preview.getByText('Sin licencia de fuera')).toBeDefined()
  })

  it('uno nuevo: con el esqueleto se baja uno vacío; la IA, solo mencionada', async () => {
    const { api } = renderSystems()
    const created = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
    await userEvent.click(await screen.findByRole('button', { name: 'Sistema nuevo' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Sistema nuevo' }))
    // Dos caminos (el esqueleto y a mano); la IA, solo una mención: se le pide a ella, por el MCP
    const ways = within(dialog.getByRole('group', { name: 'Cómo hacer un sistema' }))
    expect(ways.getByRole('button', { name: /A mano/ })).toHaveProperty('disabled', false)
    expect(ways.queryByRole('button', { name: /IA/ })).toBeNull()
    expect(dialog.getByText(/pedírselo a tu IA/)).toBeDefined()
    await userEvent.click(ways.getByRole('button', { name: /Con el esqueleto/ }))
    expect(dialog.queryByRole('textbox', { name: 'Nombre' })).toBeNull()
    await userEvent.click(dialog.getByRole('button', { name: 'Bajar el esqueleto' }))
    await waitFor(() => expect(created).toHaveBeenCalled())
    expect(api.calls.filter((c) => c === 'exportSystem')).toHaveLength(1)
    expect(api.calls.includes('createSystem')).toBe(false)
    created.mockRestore()
  })

  it('a mano: con su nombre se crea en blanco y se abre su editor (tanda 8)', async () => {
    const { api, router } = renderSystems()
    await userEvent.click(await screen.findByRole('button', { name: 'Sistema nuevo' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Sistema nuevo' }))
    await userEvent.click(dialog.getByRole('button', { name: /A mano/ }))
    expect(dialog.getByRole('button', { name: 'Crear y empezar' })).toHaveProperty('disabled', true)
    await userEvent.type(dialog.getByLabelText('Cómo se llama el juego'), 'Mazmorras de bolsillo')
    await userEvent.click(dialog.getByRole('button', { name: 'Crear y empezar' }))
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/sistemas\/[^/]+\/reglas$/))
    expect(api.calls.includes('createSystem')).toBe(true)
    expect(await screen.findByRole('heading', { level: 2, name: '¿Qué tiene un personaje?' })).toBeDefined()
  })

  it('a mano: «Cancelar» cierra sin crear nada', async () => {
    const { api } = renderSystems()
    await userEvent.click(await screen.findByRole('button', { name: 'Sistema nuevo' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Sistema nuevo' }))
    await userEvent.click(dialog.getByRole('button', { name: /A mano/ }))
    await userEvent.type(dialog.getByLabelText('Cómo se llama el juego'), 'Mazmorras de bolsillo')
    await userEvent.click(dialog.getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Sistema nuevo' })).toBeNull())
    expect(api.calls.includes('createSystem')).toBe(false)
  })

  it('de un archivo: el roto dice qué falla y no se sube; el bueno, sí, y sale en los tuyos', async () => {
    const { api, router } = renderSystems()
    await userEvent.click(await screen.findByRole('button', { name: 'Sistema nuevo' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Sistema nuevo' }))
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
    // El bueno, soltado encima
    const good = new File([JSON.stringify(toFile(cinco, []))], 'cinco.json', { type: 'application/json' })
    fireEvent.drop(dialog.getByRole('group', { name: 'Archivo' }), { dataTransfer: { files: [good] } })
    await waitFor(() => expect(dialog.queryByRole('alert')).toBeNull())
    await userEvent.click(dialog.getByRole('button', { name: 'Subir el sistema' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Sistema nuevo' })).toBeNull())
    const mine = within(screen.getByRole('list', { name: 'Sistemas' }))
    expect(await mine.findByRole('link', { name: '5e de prueba' })).toBeDefined()
    expect(router.state.location.pathname).toBe('/sistemas')
    expect(api.calls.filter((c) => c === 'importSystem')).toHaveLength(1)
  })

  it('de Foundry: un zip dice qué trae, se eligen sus compendios y su idioma, y se trae', async () => {
    const { api } = renderSystems()
    await userEvent.click(await screen.findByRole('button', { name: 'Sistema nuevo' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Sistema nuevo' }))
    const drop = (bytes: Uint8Array, name: string) =>
      fireEvent.drop(dialog.getByRole('group', { name: 'Archivo' }), {
        dataTransfer: { files: [new File([bytes as BlobPart], name, { type: 'application/zip' })] }
      })
    drop(zipSync({ 'nada.txt': strToU8('x') }), 'nada.zip')
    expect(await dialog.findByText('Este zip no es un sistema ni un módulo que se pueda traer')).toBeDefined()
    const manifest = {
      id: 'mundo',
      title: 'Mundo Oscuro',
      version: '3.0',
      packs: [
        { name: 'conjuros', label: 'Conjuros', type: 'Item', path: 'packs/conjuros' },
        { name: 'bestias', label: 'Bestias', type: 'Actor', path: 'packs/bestias' }
      ]
    }
    drop(zipSync({ 'mundo/system.json': strToU8(JSON.stringify(manifest)) }), 'mundo.zip')
    expect(await dialog.findByText('Mundo Oscuro 3.0')).toBeDefined()
    expect(dialog.getByText('Sistema', { exact: true })).toBeDefined()
    const packs = within(dialog.getByRole('group', { name: 'Compendios que se traen' }))
    await userEvent.click(packs.getByRole('checkbox', { name: /Bestias/ }))
    await userEvent.selectOptions(dialog.getByRole('combobox', { name: 'Idioma de sus textos' }), 'es')
    await userEvent.click(dialog.getByRole('button', { name: 'Traer el sistema' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Sistema nuevo' })).toBeNull())
    expect(
      await within(screen.getByRole('list', { name: 'Sistemas' })).findByRole('link', { name: 'Mundo Oscuro' })
    ).toBeDefined()
    expect(api.calls.filter((c) => c === 'importFoundry')).toHaveLength(1)
  })

  it('su ventana, si es tuyo: renombrarlo, bajarlo y borrarlo', async () => {
    const { api } = renderSystems()
    const created = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
    await userEvent.click(await screen.findByRole('button', { name: 'Ajustes de Fronteras' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Ajustes de Fronteras' }))
    expect(within(dialog.getByText('Versión').closest('div') as HTMLElement).getByText('1')).toBeDefined()
    expect(dialog.getByText('Ninguna')).toBeDefined()
    await userEvent.click(dialog.getByRole('button', { name: 'Bajar' }))
    await waitFor(() => expect(created).toHaveBeenCalled())
    expect(api.calls.includes('exportSystem')).toBe(true)
    const name = dialog.getByRole<HTMLInputElement>('textbox', { name: 'Nombre' })
    await userEvent.type(name, ' viejas')
    await userEvent.click(dialog.getByRole('button', { name: 'Cancelar' }))
    expect(name.value).toBe('Fronteras')
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

  it('un sistema tiene su espacio: la barra cambia (su Inicio, Reglas y sus ajustes) y la llama vuelve a Sistemas', async () => {
    localStorage.setItem('crisol.recorridos.enrique@crisol.test', JSON.stringify({ seen: ['sistemas', 'sistema'] }))
    const { router } = renderSystems(`/sistemas/${OWN.id}`)
    const bar = within(await screen.findByRole('navigation', { name: 'Secciones' }))
    expect(await bar.findByRole('link', { name: 'Reglas' })).toBeDefined()
    expect(bar.queryByRole('link', { name: 'Plantillas' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Ajustes' })).toBeDefined()
    // Su Inicio, sin «Sistema» junto al nombre
    expect(
      screen.getByRole('heading', { level: 1, name: typeof OWN.name === 'string' ? OWN.name : (OWN.name.es ?? '') })
    ).toBeDefined()
    await userEvent.click(bar.getByRole('link', { name: 'Reglas' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Reglas' })).toBeDefined()
    await userEvent.click(bar.getByRole('link', { name: 'Crisol' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/sistemas'))
  })

  it('el compendio del sistema, sin campaña, y un libro por dentro con la vuelta al sistema', async () => {
    localStorage.setItem(
      'crisol.recorridos.enrique@crisol.test',
      JSON.stringify({ seen: ['sistemas', 'sistema', 'compendio'] })
    )
    const { router } = renderSystems(`/sistemas/${OWN.id}/compendio`)
    expect(await screen.findByRole('heading', { level: 1, name: 'Compendio' })).toBeDefined()
    expect(screen.getByRole('searchbox', { name: 'Buscar en el compendio' })).toBeDefined()
    const name = typeof OWN.name === 'string' ? OWN.name : (OWN.name.es ?? '')
    await router.navigate({ to: '/sistemas/$systemId/libros/$bookKey', params: { systemId: OWN.id, bookKey: 'base' } })
    const back = await screen.findByRole('link', { name })
    expect(back.getAttribute('href')).toBe(`/sistemas/${OWN.id}`)
    // Dentro de un libro, su índice por tipos (sin el conmutador «Por tipo / Por libro»)
    expect(await screen.findByRole('list', { name: 'Lo que trae, por tipo' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Por libro' })).toBeNull()
  })

  it('su aspecto: un icono y una portada subida desde su cuadro (va a los archivos comunes), con «Guardar»', async () => {
    const { api } = renderSystems()
    URL.createObjectURL = vi.fn(() => 'blob:portada')
    await userEvent.click(await screen.findByRole('button', { name: 'Ajustes de Fronteras' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Ajustes de Fronteras' }))
    await userEvent.click(dialog.getByRole('radio', { name: '🐉' }))
    await userEvent.click(dialog.getByRole('button', { name: 'Poner portada' }))
    const cover = within(await screen.findByRole('dialog', { name: 'Portada de Fronteras' }))
    const input = document.querySelector<HTMLInputElement>('input[type=file][accept="image/*"]')
    if (!input) throw new Error('sin campo de archivos')
    await userEvent.upload(input, new File(['png'], 'Fronteras.png', { type: 'image/png' }))
    // Aún sin subir: se ve en el cuadro y, al aceptarlo, en los ajustes
    expect(await cover.findByRole('button', { name: /Arrastra para encuadrar/ })).toBeDefined()
    expect(api.calls).not.toContain('uploadFile')
    await userEvent.click(cover.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Portada de Fronteras' })).toBeNull())
    expect(dialog.getByRole('button', { name: 'Cambiar la portada' })).toBeDefined()
    await userEvent.click(dialog.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Ajustes de Fronteras' })).toBeNull())
    // La imagen, en los comunes; el sistema, con su icono y esa portada
    const stored = api.files.find((file) => file.name === 'Fronteras.png')
    expect(stored?.worldId).toBeNull()
    const system = await api.client.call('getSystem', { systemId: OWN.id })
    expect(system.icon).toBe('🐉')
    expect(system.cover?.fileId).toBe(stored?.id)
  })

  it('un libro del sistema: sin portada, su color; la portada subida desde su cuadro se guarda al momento (en los comunes)', async () => {
    localStorage.setItem('crisol.recorridos.enrique@crisol.test', JSON.stringify({ seen: ['sistemas', 'sistema'] }))
    // Uno con libros
    const withBooks = { ...structuredClone(cinco), id: crypto.randomUUID() }
    const api = fakeApi({ organizations: [ORG], worlds: [WORLD], systems: [withBooks] })
    render(
      <App
        router={createAppRouter(createMemoryHistory({ initialEntries: [`/sistemas/${withBooks.id}`] }))}
        accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
        api={api.client}
      />
    )
    URL.createObjectURL = vi.fn(() => 'blob:tapa')
    // El engranaje de su primer libro
    const gear = await waitFor(() => {
      const found = screen
        .getAllByRole('button', { name: /^Ajustes de / })
        .find((button) => button.closest('[data-tour="sistema-libros"]'))
      if (!found) throw new Error('sin engranaje de libro')
      return found
    })
    const bookName = gear.getAttribute('aria-label')?.replace('Ajustes de ', '') ?? ''
    await userEvent.click(gear)
    const dialog = within(await screen.findByRole('dialog', { name: bookName }))
    // Sin portada, el color de su tapa
    await userEvent.click(dialog.getByRole('radio', { name: 'Musgo' }))
    expect(dialog.getByRole('radio', { name: 'Musgo' })).toHaveProperty('checked', true)
    await userEvent.click(dialog.getByRole('button', { name: 'Poner portada' }))
    const cover = within(await screen.findByRole('dialog', { name: `Portada de ${bookName}` }))
    const input = document.querySelector<HTMLInputElement>('input[type=file][accept="image/*"]')
    if (!input) throw new Error('sin campo de archivos')
    await userEvent.upload(input, new File(['png'], 'Tapa.png', { type: 'image/png' }))
    expect(await cover.findByRole('button', { name: /Arrastra para encuadrar/ })).toBeDefined()
    await userEvent.click(cover.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: `Portada de ${bookName}` })).toBeNull())
    const stored = api.files.find((file) => file.name === 'Tapa.png')
    expect(stored?.worldId).toBeNull()
    const { books: after } = await api.client.call('getSystemBooks', { systemId: withBooks.id })
    expect(after.find((book) => book.name === bookName)?.cover?.fileId).toBe(stored?.id)
  })

  it('sus reglas: en «Avanzado» del editor se baja su archivo', async () => {
    localStorage.setItem('crisol.recorridos.enrique@crisol.test', JSON.stringify({ seen: ['sistemas', 'sistema'] }))
    const { api } = renderSystems(`/sistemas/${OWN.id}/reglas`)
    const created = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
    expect(await screen.findByRole('heading', { level: 1, name: 'Reglas' })).toBeDefined()
    await userEvent.click(await screen.findByRole('button', { name: /Avanzado/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Bajar' }))
    await waitFor(() => expect(api.calls).toContain('exportSystem'))
    created.mockRestore()
  })

  it('quitarle la portada y el icono también se guarda', async () => {
    const { api } = renderSystems()
    const stored = await api.client.uploadFile(
      { organizationId: ORG.id, name: 'Vieja.png' },
      new File(['png'], 'Vieja.png', { type: 'image/png' })
    )
    const before = await api.client.call('getSystem', { systemId: OWN.id })
    await api.client.call('updateSystem', {
      systemId: OWN.id,
      version: before.version,
      changes: [
        { path: 'icon', value: '🐉' },
        { path: 'cover', value: { fileId: stored.id, x: 50, y: 50 } }
      ]
    })
    await userEvent.click(await screen.findByRole('button', { name: 'Ajustes de Fronteras' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Ajustes de Fronteras' }))
    await userEvent.click(dialog.getByRole('radio', { name: 'Sin icono' }))
    await userEvent.click(dialog.getByRole('button', { name: 'Cambiar la portada' }))
    const cover = within(await screen.findByRole('dialog', { name: 'Portada de Fronteras' }))
    await userEvent.click(await cover.findByRole('button', { name: 'Quitar la portada' }))
    await userEvent.click(cover.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Portada de Fronteras' })).toBeNull())
    await userEvent.click(dialog.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Ajustes de Fronteras' })).toBeNull())
    const system = await api.client.call('getSystem', { systemId: OWN.id })
    expect(system.icon ?? null).toBeNull()
    expect(system.cover ?? null).toBeNull()
  })
})

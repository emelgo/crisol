import type { World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { ApiError } from '../api/client.ts'
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
/** Una lista de archivos: la del mundo, o la de los comunes (dentro de su región) */
const cardsIn = async (region?: string) =>
  within(
    region
      ? await within(await screen.findByRole('region', { name: region })).findByRole('list', { name: 'Archivos' })
      : ((await screen.findAllByRole('list', { name: 'Archivos' }))[0] ?? document.body)
  )

beforeEach(() =>
  localStorage.setItem(
    'crisol.recorridos.enrique@crisol.test',
    JSON.stringify({ seen: ['mundos', 'mundo', 'archivos'] })
  )
)

describe('los archivos del mundo', () => {
  it('desde la barra se llega; en lista, con su tamaño; se filtran por tipo y se abren', async () => {
    renderAt(`/mundos/${WORLD.id}/wiki`)
    await userEvent.click(await screen.findByRole('link', { name: 'Archivos' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Archivos de Eana' })).toBeDefined()
    const list = await cardsIn()
    expect(await list.findByText('2,5 MB')).toBeDefined()
    expect(list.getByText('0,5 kB')).toBeDefined()
    // Un PDF se abre en otra pestaña
    const bestiary = list.getByRole('link', { name: 'Bestiario.pdf' })
    expect(bestiary.getAttribute('target')).toBe('_blank')
    expect(bestiary.getAttribute('href')).toMatch(/^\/api\/files\//)
    // Filtrar: solo las imágenes
    // El filtro del mundo (el primero; el otro es el de los comunes)
    await userEvent.click(screen.getAllByRole('button', { name: /Imágenes/ })[0] as HTMLElement)
    await waitFor(() => expect(list.queryByRole('link', { name: 'Bestiario.pdf' })).toBeNull())
    // Una imagen se ve en grande
    await userEvent.click(list.getByRole('button', { name: 'Mapa de Eana.png' }))
    expect(await screen.findByRole('dialog', { name: 'Mapa de Eana.png' })).toBeDefined()
  })

  it('subir varios: al acabar son ya sus tarjetas, sin lista de subidas; uno muy grande no se intenta y se quita', async () => {
    const api = renderAt(`/mundos/${WORLD.id}/archivos`)
    await screen.findByRole('heading', { level: 1, name: 'Archivos de Eana' })
    await screen.findAllByRole('button', { name: 'Subir archivos' })
    const input = document.querySelector<HTMLInputElement>('input[type=file][multiple]')
    if (!input) throw new Error('sin campo de archivos')
    const huge = new File(['x'], 'Enorme.pdf', { type: 'application/pdf' })
    Object.defineProperty(huge, 'size', { value: 300 * 1024 * 1024 })
    // Sin aplicar «accept», como al soltarlos en la pantalla: llegan también los que no se admiten
    await userEvent.setup({ applyAccept: false }).upload(input, [
      new File(['%PDF'], 'Atlas.pdf', { type: 'application/pdf' }),
      new File(['png'], 'Escudo.png', { type: 'image/png' }),
      huge,
      // Un programa: no se admite, ni se intenta
      new File(['MZ'], 'virus.exe', { type: 'application/octet-stream' })
    ])
    const list = await cardsIn()
    expect(await list.findByRole('link', { name: 'Atlas.pdf' })).toBeDefined()
    expect(await list.findByRole('button', { name: 'Escudo.png' })).toBeDefined()
    await waitFor(() => expect(screen.queryByRole('button', { name: /Cancelar la subida/ })).toBeNull())
    expect(api.calls.filter((call) => call === 'uploadFile')).toHaveLength(2)
    expect(list.getByText('No se pudo: Pasa de 250 MB')).toBeDefined()
    expect(list.getByText('No se pudo: Ese tipo de archivo no se puede subir')).toBeDefined()
    await userEvent.click(list.getByRole('button', { name: 'Quitar Enorme.pdf' }))
    expect(list.queryByText('Enorme.pdf')).toBeNull()
  })

  it('una subida se puede cancelar: se corta y no queda nada', async () => {
    const api = filesApi()
    let cancelled = false
    api.client.uploadFile = (_target, _file, _progress, signal) =>
      new Promise((_resolve, reject) =>
        signal?.addEventListener('abort', () => {
          cancelled = true
          reject(new ApiError('CANCELLED', 0))
        })
      )
    renderAt(`/mundos/${WORLD.id}/archivos`, api)
    await screen.findByRole('heading', { level: 1, name: 'Archivos de Eana' })
    await screen.findAllByRole('button', { name: 'Subir archivos' })
    const input = document.querySelector<HTMLInputElement>('input[type=file][multiple]')
    if (!input) throw new Error('sin campo de archivos')
    await userEvent.upload(input, [new File(['%PDF'], 'Lento.pdf', { type: 'application/pdf' })])
    expect(await screen.findByRole('progressbar', { name: 'Subiendo Lento.pdf' })).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar la subida de Lento.pdf' }))
    await waitFor(() => expect(screen.queryByText('Lento.pdf')).toBeNull())
    expect(cancelled).toBe(true)
    expect(screen.queryByText(/No se pudo/)).toBeNull()
  })

  it('su engranaje: renombrar (sin repetir nombre), reemplazar y mandar a la papelera, de donde vuelve', async () => {
    const api = renderAt(`/mundos/${WORLD.id}/archivos`)
    await userEvent.click(await screen.findByRole('button', { name: 'Ajustes de Mapa de Eana.png' }))
    const dialogElement = await screen.findByRole('dialog', { name: 'Ajustes de Mapa de Eana.png' })
    const dialog = within(dialogElement)
    const field = dialog.getByLabelText('Nombre del archivo')
    await userEvent.clear(field)
    await userEvent.type(field, 'bestiario.pdf')
    await userEvent.click(dialog.getByRole('button', { name: 'Guardar' }))
    expect(await dialog.findByText('Ya hay un archivo con ese nombre')).toBeDefined()
    await userEvent.clear(field)
    await userEvent.type(field, 'Mapa del norte.png')
    await userEvent.click(dialog.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByRole('button', { name: 'Mapa del norte.png' })).toBeDefined()

    // Renombrado, la ventana ya lleva el nombre nuevo
    const replace = dialogElement.querySelector<HTMLInputElement>('input[type=file]')
    if (!replace) throw new Error('sin campo de reemplazo')
    await userEvent.upload(replace, new File(['nuevo'], 'otro.png', { type: 'image/png' }))
    await waitFor(() => expect(api.calls).toContain('uploadFile'))
    await userEvent.click(dialog.getByRole('button', { name: 'Cerrar' }))

    await userEvent.click(screen.getByRole('button', { name: 'Ajustes de Bestiario.pdf' }))
    const settings = within(await screen.findByRole('dialog', { name: 'Ajustes de Bestiario.pdf' }))
    await userEvent.click(settings.getByRole('button', { name: 'Borrar el archivo' }))
    const confirm = within(await screen.findByRole('dialog', { name: '¿Borrar «Bestiario.pdf»?' }))
    // Lo usan dos páginas: se avisa; no hace falta escribir su nombre
    expect(confirm.getByText(/Lo usan 2 páginas/)).toBeDefined()
    await userEvent.click(confirm.getByRole('button', { name: 'Borrar el archivo' }))
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Bestiario.pdf' })).toBeNull())
    const trash = await api.client.call('listTrash', { worldId: WORLD.id })
    expect(trash.items).toMatchObject([{ kind: 'file', name: 'Bestiario.pdf' }])
    await api.client.call('restoreFile', { fileId: trash.items[0]?.id ?? '' })
    expect((await api.client.call('listFiles', { worldId: WORLD.id })).files.map((f) => f.name)).toContain(
      'Bestiario.pdf'
    )
  })
})

describe('los archivos en el móvil', () => {
  // Una pantalla estrecha
  beforeEach(() => {
    const narrow = (query: string) =>
      ({
        matches: query.includes('max-width'),
        addEventListener() {},
        removeEventListener() {}
      }) as unknown as MediaQueryList
    window.matchMedia = narrow
    return () => {
      Reflect.deleteProperty(window, 'matchMedia')
    }
  })

  it('al tocar un archivo sube su hoja: su detalle, abrirlo y sus ajustes; la carpeta se elige en un selector', async () => {
    renderAt(`/mundos/${WORLD.id}/archivos`)
    const list = await cardsIn()
    await userEvent.click(await list.findByRole('button', { name: 'Bestiario.pdf' }))
    const sheet = await screen.findByRole('dialog', { name: 'Bestiario.pdf' })
    expect(within(sheet).getByText('PDF')).toBeDefined()
    expect(within(sheet).getByRole('link', { name: 'Abrir' }).getAttribute('href')).toMatch(/^\/api\/files\//)
    await userEvent.click(within(sheet).getByRole('button', { name: 'Ajustes' }))
    expect(await screen.findByRole('dialog', { name: 'Ajustes de Bestiario.pdf' })).toBeDefined()
    await userEvent.keyboard('{Escape}')

    // Una carpeta nueva, y a ella desde el selector
    await userEvent.click(screen.getAllByRole('button', { name: 'Nueva carpeta' })[0] as HTMLElement)
    const create = await screen.findByRole('dialog', { name: 'Nueva carpeta' })
    await userEvent.type(within(create).getByLabelText('Nombre de la carpeta'), 'Mapas')
    await userEvent.click(within(create).getByRole('button', { name: 'Crear la carpeta' }))
    const picker = screen.getAllByRole('combobox', { name: 'Carpeta' })[0] as HTMLSelectElement
    await waitFor(() => expect(within(picker).getByRole('option', { name: 'Mapas' })).toBeDefined())
    await userEvent.selectOptions(picker, 'Mapas')
    expect(await screen.findByText('Esta carpeta está vacía.')).toBeDefined()
  })
})

describe('las carpetas de los archivos', () => {
  it('se crea una, se entra, se sube ahí y se vuelve por la ruta; un archivo se mueve desde su engranaje', async () => {
    const api = renderAt(`/mundos/${WORLD.id}/archivos`)
    // La del mundo (la primera; la otra es la de los comunes)
    await userEvent.click((await screen.findAllByRole('button', { name: 'Nueva carpeta' }))[0] as HTMLElement)
    const create = within(await screen.findByRole('dialog', { name: 'Nueva carpeta' }))
    await userEvent.type(create.getByLabelText('Nombre de la carpeta'), 'Mapas')
    await userEvent.click(create.getByRole('button', { name: 'Crear la carpeta' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir la carpeta Mapas' }))
    // En el árbol del mundo, la elegida
    const path = within((await screen.findAllByRole('navigation', { name: 'Carpetas' }))[0] as HTMLElement)
    expect(path.getByRole('button', { name: /^Mapas/ }).getAttribute('aria-current')).toBe('true')
    // Dentro, aún no hay nada; lo que se sube va a ella
    expect(screen.queryByRole('button', { name: 'Mapa de Eana.png' })).toBeNull()
    const input = document.querySelector<HTMLInputElement>('input[type=file][multiple]')
    if (!input) throw new Error('sin campo de archivos')
    await userEvent.upload(input, [new File(['png'], 'Costa.png', { type: 'image/png' })])
    expect(await screen.findByRole('button', { name: 'Costa.png' })).toBeDefined()
    const [folder] = (await api.client.call('listFiles', { worldId: WORLD.id })).folders
    expect(api.files.find((f) => f.name === 'Costa.png')?.folderId).toBe(folder?.id)
    // Por la ruta, a lo más alto; y desde su engranaje, el mapa a la carpeta
    // A lo más alto, por la ruta de encima de la lista
    await userEvent.click(
      within((await screen.findAllByRole('navigation', { name: 'Ruta de la carpeta' }))[0] as HTMLElement).getByRole(
        'button',
        { name: 'Todos' }
      )
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Ajustes de Mapa de Eana.png' }))
    const settings = within(await screen.findByRole('dialog', { name: 'Ajustes de Mapa de Eana.png' }))
    await userEvent.selectOptions(settings.getByLabelText('Carpeta'), 'Mapas')
    await waitFor(() => expect(api.files.find((f) => f.name === 'Mapa de Eana.png')?.folderId).toBe(folder?.id))
  })

  it('buscar encuentra en todas las carpetas, y dice en cuál está', async () => {
    const folder = {
      id: crypto.randomUUID(),
      worldId: WORLD.id,
      organizationId: ORG.id,
      parentId: null,
      name: 'Bestias'
    }
    const api = fakeApi({
      organizations: [ORG],
      worlds: [WORLD],
      folders: [folder],
      files: [
        { worldId: WORLD.id, name: 'Mapa de Eana.png', kind: 'image' },
        { worldId: WORLD.id, name: 'Bestiario.pdf', kind: 'pdf', mime: 'application/pdf', folderId: folder.id }
      ]
    })
    renderAt(`/mundos/${WORLD.id}/archivos`, api)
    expect(await screen.findByRole('button', { name: 'Abrir la carpeta Bestias' })).toBeDefined()
    expect(screen.queryByRole('link', { name: 'Bestiario.pdf' })).toBeNull()
    await userEvent.type(screen.getAllByRole('searchbox', { name: 'Buscar por nombre' })[0] as HTMLElement, 'bestia')
    const found = await screen.findByRole('link', { name: 'Bestiario.pdf' })
    expect(found.closest('li')?.textContent).toContain('Bestias')
    expect(screen.queryByRole('button', { name: 'Mapa de Eana.png' })).toBeNull()
  })

  it('borrar una carpeta no borra lo que tiene: pasa a la de arriba', async () => {
    const folder = {
      id: crypto.randomUUID(),
      worldId: WORLD.id,
      organizationId: ORG.id,
      parentId: null,
      name: 'Viejos'
    }
    const api = fakeApi({
      organizations: [ORG],
      worlds: [WORLD],
      folders: [folder],
      files: [{ worldId: WORLD.id, name: 'Antiguo.pdf', kind: 'pdf', mime: 'application/pdf', folderId: folder.id }]
    })
    renderAt(`/mundos/${WORLD.id}/archivos`, api)
    await userEvent.click(await screen.findByRole('button', { name: 'Ajustes de la carpeta Viejos' }))
    const settings = within(await screen.findByRole('dialog', { name: 'Ajustes de la carpeta Viejos' }))
    await userEvent.click(settings.getByRole('button', { name: 'Borrar la carpeta' }))
    const confirm = within(await screen.findByRole('dialog', { name: '¿Borrar «Viejos»?' }))
    expect(confirm.getByText(/pasa a la carpeta de arriba/)).toBeDefined()
    await userEvent.click(confirm.getByRole('button', { name: 'Borrar la carpeta' }))
    expect(await screen.findByRole('link', { name: 'Antiguo.pdf' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Abrir la carpeta Viejos' })).toBeNull()
  })
})

describe('los archivos comunes de la cuenta (ADR-0005)', () => {
  const withCommon = () =>
    fakeApi({
      organizations: [ORG],
      worlds: [WORLD],
      files: [
        { worldId: WORLD.id, name: 'Mapa de Eana.png', kind: 'image' },
        { worldId: null, organizationId: ORG.id, name: 'Escudo.png', kind: 'image' }
      ]
    })

  it('en los archivos de un mundo, la carpeta «Comunes» tiene los de la cuenta; lo que se sube ahí es común', async () => {
    const api = renderAt(`/mundos/${WORLD.id}/archivos`, withCommon())
    // Fuera de ella, solo los del mundo
    expect(await screen.findByRole('button', { name: 'Mapa de Eana.png' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Escudo.png' })).toBeNull()
    await userEvent.click(
      within(screen.getByRole('navigation', { name: 'Carpetas' })).getByRole('button', { name: /^Comunes/ })
    )
    expect(await screen.findByRole('button', { name: 'Escudo.png' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Mapa de Eana.png' })).toBeNull()
    // Sin engranaje: no se renombra ni se borra
    expect(screen.queryByRole('button', { name: 'Ajustes de la carpeta Comunes' })).toBeNull()
    const input = document.querySelector<HTMLInputElement>('input[type=file][multiple]')
    if (!input) throw new Error('sin campo de archivos')
    await userEvent.upload(input, [new File(['png'], 'Sello.png', { type: 'image/png' })])
    expect(await screen.findByRole('button', { name: 'Sello.png' })).toBeDefined()
    expect(api.files.find((f) => f.name === 'Sello.png')).toMatchObject({
      worldId: null,
      organizationId: ORG.id,
      folderId: null
    })
  })

  it('fuera de los mundos, «Archivos» en la barra lleva a los comunes', async () => {
    renderAt('/mundos', withCommon())
    await userEvent.click(await screen.findByRole('link', { name: 'Archivos' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Archivos comunes' })).toBeDefined()
    expect(await screen.findByRole('button', { name: 'Escudo.png' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Mapa de Eana.png' })).toBeNull()
  })
})

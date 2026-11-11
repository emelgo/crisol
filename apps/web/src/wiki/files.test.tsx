import type { World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { act, createEvent, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

/** Una carpeta del mundo (o, con worldId null, de los comunes) */
const folderOf = (name: string, parentId: string | null = null, worldId: string | null = WORLD.id) => ({
  id: crypto.randomUUID(),
  worldId,
  organizationId: ORG.id,
  parentId,
  name
})

/** La fila de un archivo o de una carpeta, por su nombre */
const rowOf = (name: string) =>
  screen.getByText(name, { selector: 'button, a' }).closest('[data-file-card]') as HTMLElement

/** La lista donde está una fila: la de lo más alto o la de lo de dentro de una carpeta */
const listOf = (name: string) => rowOf(name).closest('ul') as HTMLElement

/** Lo que hay en una lista (sin lo de sus carpetas), en el orden en que se ve: por el nombre de cada fila */
const namesIn = (list: HTMLElement) =>
  [...list.querySelectorAll(':scope > li > [data-file-card]')].map(
    (card) => card.querySelector('[aria-expanded], a, button')?.textContent?.trim() ?? ''
  )

/**
 * Arrastrar con el ratón. jsdom no mide: cada fila mide 100 de alto, así que la altura del puntero (y) dice la zona (el
 * cuarto de arriba, encima; el de abajo, debajo; en medio de una carpeta, dentro)
 */
function dragKit() {
  const box = vi
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockReturnValue({ top: 0, height: 100, left: 0, width: 400, bottom: 100, right: 400, x: 0, y: 0 } as DOMRect)
  const dataTransfer = { setData: () => {}, effectAllowed: '', dropEffect: '', types: [] as string[] }
  const at = (target: HTMLElement, type: 'dragEnter' | 'dragOver' | 'drop', y: number) => {
    const event = createEvent[type](target, { dataTransfer })
    Object.defineProperty(event, 'clientY', { value: y })
    fireEvent(target, event)
  }
  return {
    start: (row: HTMLElement) => fireEvent.dragStart(row, { dataTransfer }),
    end: (row: HTMLElement) => fireEvent.dragEnd(row, { dataTransfer }),
    enter: (row: HTMLElement, y: number) => at(row, 'dragEnter', y),
    over: (row: HTMLElement, y: number) => at(row, 'dragOver', y),
    drop: (row: HTMLElement, y: number) => at(row, 'drop', y),
    restore: () => box.mockRestore()
  }
}

describe('los archivos del mundo', () => {
  it('desde la barra se llega; en lista, con su tamaño; se filtran por tipo y se abren', async () => {
    localStorage.setItem('crisol.recorridos.enrique@crisol.test', JSON.stringify({ seen: ['mundo'] }))
    renderAt(`/mundos/${WORLD.id}/wiki`)
    // «Archivos» en la barra: su pantalla
    const sections = within(await screen.findByRole('navigation', { name: 'Secciones' }))
    await userEvent.click(await sections.findByRole('link', { name: 'Archivos' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Archivos de Eana' })).toBeDefined()
    const list = await cardsIn()
    expect(await list.findByText('2,5 MB')).toBeDefined()
    expect(list.getByText('0,5 kB')).toBeDefined()
    // Un PDF se abre en otra pestaña
    const bestiary = list.getByRole('link', { name: 'Bestiario.pdf' })
    expect(bestiary.getAttribute('target')).toBe('_blank')
    expect(bestiary.getAttribute('href')).toMatch(/^\/api\/files\//)
    // Filtrar: solo las imágenes
    await userEvent.click(screen.getByRole('button', { name: 'Imágenes' }))
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
    expect(await screen.findByRole('progressbar', { name: 'Subiendo Lento.pdf…' })).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar la subida de Lento.pdf' }))
    await waitFor(() => expect(screen.queryByText('Lento.pdf')).toBeNull())
    expect(cancelled).toBe(true)
    expect(screen.queryByText(/No se pudo/)).toBeNull()
  })

  it('su engranaje: renombrar (sin repetir nombre) y mandar a la papelera, de donde vuelve', async () => {
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

    // Sin reemplazar ni mover desde aquí: se sube otro y se arrastra
    expect(dialogElement.querySelector('input[type=file]')).toBeNull()
    expect(dialog.queryByLabelText('Carpeta')).toBeNull()
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

describe('las carpetas, en la misma lista (su árbol)', () => {
  it('pulsar una carpeta la despliega en su sitio; sus botones suben a ella y crean dentro; los de fuera, en lo más alto', async () => {
    const api = renderAt(`/mundos/${WORLD.id}/archivos`)
    // «Nueva carpeta», con su nombre fijo, en lo más alto
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva carpeta' }))
    const create = within(await screen.findByRole('dialog', { name: 'Nueva carpeta' }))
    await userEvent.type(create.getByLabelText('Nombre de la carpeta'), 'Mapas')
    await userEvent.click(create.getByRole('button', { name: 'Crear la carpeta' }))
    const maps = await screen.findByRole('button', { name: 'Mapas' })
    const [folder] = (await api.client.call('listFiles', { worldId: WORLD.id })).folders
    expect(folder?.parentId).toBeNull()
    expect(maps.getAttribute('aria-expanded')).toBe('false')
    await userEvent.click(maps)
    // Desplegada, sin entrar en ella: lo de fuera sigue a la vista
    expect(maps.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('button', { name: 'Mapa de Eana.png' })).toBeDefined()
    // Su botón de subir: a ella, y sale dentro, sangrada debajo
    const input = document.querySelector<HTMLInputElement>('input[type=file][multiple]')
    if (!input) throw new Error('sin campo de archivos')
    await userEvent.click(screen.getByRole('button', { name: 'Subir archivos a Mapas' }))
    await userEvent.upload(input, [new File(['png'], 'Costa.png', { type: 'image/png' })])
    expect(await screen.findByRole('button', { name: 'Costa.png' })).toBeDefined()
    expect(api.files.find((f) => f.name === 'Costa.png')?.folderId).toBe(folder?.id)
    await waitFor(() => expect(listOf('Costa.png')).not.toBe(listOf('Mapas')))
    expect(maps.closest('li')?.contains(rowOf('Costa.png'))).toBe(true)
    // Su botón de carpeta: una dentro (el cuadro dice dónde)
    await userEvent.click(screen.getByRole('button', { name: 'Nueva carpeta en Mapas' }))
    const inside = within(await screen.findByRole('dialog', { name: 'Nueva carpeta en Mapas' }))
    await userEvent.type(inside.getByLabelText('Nombre de la carpeta'), 'Norte')
    await userEvent.click(inside.getByRole('button', { name: 'Crear la carpeta' }))
    expect(await screen.findByRole('button', { name: 'Norte' })).toBeDefined()
    const folders = (await api.client.call('listFiles', { worldId: WORLD.id })).folders
    expect(folders.find((f) => f.name === 'Norte')?.parentId).toBe(folder?.id)
    // «Subir archivos» de arriba, con su nombre fijo: a lo más alto
    await userEvent.click(screen.getByRole('button', { name: 'Subir archivos' }))
    await userEvent.upload(input, [new File(['png'], 'Faro.png', { type: 'image/png' })])
    expect(await screen.findByRole('button', { name: 'Faro.png' })).toBeDefined()
    expect(api.files.find((f) => f.name === 'Faro.png')?.folderId).toBeNull()
    // Otra vez: se pliega
    await userEvent.click(maps)
    expect(maps.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('button', { name: 'Costa.png' })).toBeNull()
  })

  it('con el teclado: Intro, la flecha derecha la abre y la izquierda la cierra', async () => {
    const maps = folderOf('Mapas')
    const api = fakeApi({
      organizations: [ORG],
      worlds: [WORLD],
      folders: [maps],
      files: [{ worldId: WORLD.id, name: 'Costa.png', kind: 'image', folderId: maps.id }]
    })
    renderAt(`/mundos/${WORLD.id}/archivos`, api)
    const button = await screen.findByRole('button', { name: 'Mapas' })
    button.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(await screen.findByRole('button', { name: 'Costa.png' })).toBeDefined()
    await userEvent.keyboard('{ArrowLeft}')
    expect(button.getAttribute('aria-expanded')).toBe('false')
    await userEvent.keyboard('{Enter}')
    expect(button.getAttribute('aria-expanded')).toBe('true')
  })

  it('arrastrar, como las páginas: en medio de una carpeta, dentro; encima o debajo de una fila, a su carpeta; se ve al momento', async () => {
    const maps = folderOf('Mapas')
    const api = fakeApi({
      organizations: [ORG],
      worlds: [WORLD],
      folders: [maps],
      files: [
        { worldId: WORLD.id, name: 'Costa.png', kind: 'image', folderId: maps.id },
        { worldId: WORLD.id, name: 'Mapa de Eana.png', kind: 'image' },
        { worldId: WORLD.id, name: 'Notas.txt', kind: 'other', mime: 'text/plain' }
      ]
    })
    // El servidor tarda en mover el primero: lo movido ya se ve en su sitio
    let release = () => {}
    let slow = true
    const call = api.client.call
    api.client.call = (async (name, input) => {
      if (name === 'moveFile' && slow) {
        slow = false
        await new Promise<void>((resolve) => {
          release = resolve
        })
      }
      return call(name, input)
    }) as typeof call
    renderAt(`/mundos/${WORLD.id}/archivos`, api)
    await screen.findByRole('button', { name: 'Mapa de Eana.png' })
    const drag = dragKit()
    try {
      drag.start(rowOf('Mapa de Eana.png'))
      // Encima de Mapas iría a lo más alto, donde ya está: no se marca
      drag.over(rowOf('Mapas'), 10)
      expect(rowOf('Mapas').dataset.drop).toBeUndefined()
      // En medio: dentro, la carpeta resaltada (como en las páginas del mundo, sin más texto)
      drag.over(rowOf('Mapas'), 50)
      expect(rowOf('Mapas').dataset.drop).toBe('inside')
      drag.drop(rowOf('Mapas'), 50)
      // Ya dentro, con Mapas desplegada y lo movido iluminado, sin esperar al servidor
      const folder = screen.getByRole('button', { name: 'Mapas' })
      await waitFor(() => expect(folder.closest('li')?.contains(rowOf('Mapa de Eana.png'))).toBe(true))
      expect(folder.getAttribute('aria-expanded')).toBe('true')
      expect(rowOf('Mapa de Eana.png').classList.contains('received')).toBe(true)
      expect(api.files.find((f) => f.name === 'Mapa de Eana.png')?.folderId).toBeNull()
      release()
      await waitFor(() => expect(api.files.find((f) => f.name === 'Mapa de Eana.png')?.folderId).toBe(maps.id))
      expect(await screen.findByText('«Mapa de Eana.png», ahora en «Mapas»')).toBeDefined()

      // Para sacarla: encima de una fila de fuera (la raya dice que va a lo más alto)
      drag.start(rowOf('Costa.png'))
      // Al entrar en la fila ya sale (Chromium avisa primero solo con dragenter)
      drag.enter(rowOf('Notas.txt'), 10)
      expect(rowOf('Notas.txt').dataset.drop).toBe('before')
      drag.over(rowOf('Notas.txt'), 90)
      expect(rowOf('Notas.txt').dataset.drop).toBe('after')
      drag.drop(rowOf('Notas.txt'), 90)
      await waitFor(() => expect(listOf('Costa.png')).toBe(screen.getByRole('list', { name: 'Archivos' })))
      await waitFor(() => expect(api.files.find((f) => f.name === 'Costa.png')?.folderId).toBeNull())
    } finally {
      drag.restore()
    }
  })

  it('si el servidor no lo deja, vuelve a donde estaba', async () => {
    const maps = folderOf('Mapas')
    const api = fakeApi({
      organizations: [ORG],
      worlds: [WORLD],
      folders: [maps],
      files: [{ worldId: WORLD.id, name: 'Mapa de Eana.png', kind: 'image' }]
    })
    const call = api.client.call
    api.client.call = (async (name, input) => {
      if (name === 'moveFile') throw new ApiError('NOT_FOUND', 404)
      return call(name, input)
    }) as typeof call
    renderAt(`/mundos/${WORLD.id}/archivos`, api)
    await screen.findByRole('button', { name: 'Mapa de Eana.png' })
    const root = screen.getByRole('list', { name: 'Archivos' })
    const drag = dragKit()
    try {
      drag.start(rowOf('Mapa de Eana.png'))
      drag.over(rowOf('Mapas'), 50)
      drag.drop(rowOf('Mapas'), 50)
      await waitFor(() => expect(api.files[0]?.folderId).toBeNull())
      await waitFor(() => expect(listOf('Mapa de Eana.png')).toBe(root))
      expect(screen.getByRole('button', { name: 'Mapas' }).closest('li')?.contains(rowOf('Mapa de Eana.png'))).toBe(
        false
      )
    } finally {
      drag.restore()
    }
  })

  it('recolocar dentro de una carpeta: encima o debajo de uno de su tipo cambia su puesto, sin salir de ella; se ve al momento', async () => {
    const maps = folderOf('Mapas')
    const north = folderOf('Norte', maps.id)
    const south = folderOf('Sur', maps.id)
    const api = fakeApi({
      organizations: [ORG],
      worlds: [WORLD],
      folders: [maps, north, south],
      files: [
        { worldId: WORLD.id, name: 'A.png', kind: 'image', folderId: maps.id },
        { worldId: WORLD.id, name: 'B.png', kind: 'image', folderId: maps.id },
        { worldId: WORLD.id, name: 'C.png', kind: 'image', folderId: maps.id },
        { worldId: WORLD.id, name: 'Fuera.png', kind: 'image' }
      ]
    })
    // El servidor tarda: lo recolocado ya se ve en su puesto
    let release = () => {}
    let slow = true
    const call = api.client.call
    api.client.call = (async (name, input) => {
      if (name === 'moveFile' && slow) {
        slow = false
        await new Promise<void>((resolve) => {
          release = resolve
        })
      }
      return call(name, input)
    }) as typeof call
    renderAt(`/mundos/${WORLD.id}/archivos`, api)
    await userEvent.click(await screen.findByRole('button', { name: 'Mapas' }))
    await screen.findByRole('button', { name: 'C.png' })
    const inside = listOf('A.png')
    expect(namesIn(inside)).toEqual(['Norte', 'Sur', 'A.png', 'B.png', 'C.png'])
    const drag = dragKit()
    try {
      // C, encima de A: la raya, y al soltar, delante de A y dentro de Mapas
      drag.start(rowOf('C.png'))
      drag.over(rowOf('A.png'), 10)
      expect(rowOf('A.png').dataset.drop).toBe('before')
      drag.drop(rowOf('A.png'), 10)
      await waitFor(() => expect(namesIn(listOf('C.png'))).toEqual(['Norte', 'Sur', 'C.png', 'A.png', 'B.png']))
      expect(listOf('C.png')).toBe(inside)
      expect(rowOf('C.png').classList.contains('received')).toBe(true)
      expect(api.files.find((f) => f.name === 'C.png')?.position).toBeNull()
      release()
      // En el servidor, la primera vez, con los puestos de los tres
      await waitFor(() => expect(api.files.filter((f) => f.folderId === maps.id).every((f) => f.position)).toBe(true))
      expect(await screen.findByText('«C.png», en su nuevo sitio')).toBeDefined()
      expect(namesIn(listOf('C.png'))).toEqual(['Norte', 'Sur', 'C.png', 'A.png', 'B.png'])
      // Donde ya está (debajo de la de encima) no se marca: no cambiaría nada
      drag.start(rowOf('A.png'))
      drag.over(rowOf('C.png'), 90)
      expect(rowOf('C.png').dataset.drop).toBeUndefined()
      // Junto a una carpeta de su misma carpeta, tampoco: allí solo se ordena entre archivos
      drag.over(rowOf('Sur'), 90)
      expect(rowOf('Sur').dataset.drop).toBeUndefined()
      // Debajo de B, sí
      drag.over(rowOf('B.png'), 90)
      expect(rowOf('B.png').dataset.drop).toBe('after')
      drag.drop(rowOf('B.png'), 90)
      await waitFor(() => expect(namesIn(listOf('A.png'))).toEqual(['Norte', 'Sur', 'C.png', 'B.png', 'A.png']))
      // Las carpetas, entre ellas: Sur, encima de Norte
      drag.start(rowOf('Sur'))
      drag.over(rowOf('Norte'), 10)
      expect(rowOf('Norte').dataset.drop).toBe('before')
      drag.drop(rowOf('Norte'), 10)
      await waitFor(() => expect(namesIn(listOf('Sur'))).toEqual(['Sur', 'Norte', 'C.png', 'B.png', 'A.png']))
      await waitFor(async () =>
        expect(
          (await api.client.call('listFiles', { worldId: WORLD.id })).folders
            .filter((f) => f.parentId === maps.id)
            .map((f) => f.name)
        ).toEqual(['Sur', 'Norte'])
      )
      // Uno de fuera, dentro y en su puesto: encima de B
      drag.start(rowOf('Fuera.png'))
      drag.over(rowOf('B.png'), 10)
      expect(rowOf('B.png').dataset.drop).toBe('before')
      drag.drop(rowOf('B.png'), 10)
      await waitFor(() =>
        expect(namesIn(listOf('B.png'))).toEqual(['Sur', 'Norte', 'C.png', 'Fuera.png', 'B.png', 'A.png'])
      )
      await waitFor(() => expect(api.files.find((f) => f.name === 'Fuera.png')?.folderId).toBe(maps.id))
    } finally {
      drag.restore()
    }
  })

  it('si el servidor no deja recolocarlo, vuelve a su puesto', async () => {
    const maps = folderOf('Mapas')
    const api = fakeApi({
      organizations: [ORG],
      worlds: [WORLD],
      folders: [maps],
      files: [
        { worldId: WORLD.id, name: 'A.png', kind: 'image', folderId: maps.id },
        { worldId: WORLD.id, name: 'B.png', kind: 'image', folderId: maps.id }
      ]
    })
    const call = api.client.call
    let fail = () => {}
    api.client.call = (async (name, input) => {
      if (name === 'moveFile') {
        // Falla cuando ya se ve recolocado
        await new Promise<void>((resolve) => {
          fail = resolve
        })
        throw new ApiError('NOT_SIBLING', 400)
      }
      return call(name, input)
    }) as typeof call
    renderAt(`/mundos/${WORLD.id}/archivos`, api)
    await userEvent.click(await screen.findByRole('button', { name: 'Mapas' }))
    await screen.findByRole('button', { name: 'B.png' })
    const drag = dragKit()
    try {
      drag.start(rowOf('B.png'))
      drag.over(rowOf('A.png'), 10)
      drag.drop(rowOf('A.png'), 10)
      await waitFor(() => expect(namesIn(listOf('B.png'))).toEqual(['B.png', 'A.png']))
      fail()
      await waitFor(() => expect(namesIn(listOf('B.png'))).toEqual(['A.png', 'B.png']))
      expect(await screen.findByText('Solo se ordena junto a otro de su tipo en su carpeta')).toBeDefined()
      expect(api.files.every((f) => f.position === null)).toBe(true)
    } finally {
      drag.restore()
    }
  })

  it('mantener lo arrastrado sobre una carpeta cerrada la despliega sola', async () => {
    const maps = folderOf('Mapas')
    const api = fakeApi({
      organizations: [ORG],
      worlds: [WORLD],
      folders: [maps],
      files: [
        { worldId: WORLD.id, name: 'Costa.png', kind: 'image', folderId: maps.id },
        { worldId: WORLD.id, name: 'Mapa de Eana.png', kind: 'image' }
      ]
    })
    renderAt(`/mundos/${WORLD.id}/archivos`, api)
    await screen.findByRole('button', { name: 'Mapa de Eana.png' })
    const drag = dragKit()
    vi.useFakeTimers()
    try {
      drag.start(rowOf('Mapa de Eana.png'))
      drag.over(rowOf('Mapas'), 50)
      // Mientras, una raya se llena bajo la fila
      expect(rowOf('Mapas').classList.contains('arming')).toBe(true)
      act(() => vi.advanceTimersByTime(400))
      // Si se va (encima, donde no se puede soltar), no se despliega
      drag.over(rowOf('Mapas'), 10)
      expect(rowOf('Mapas').classList.contains('arming')).toBe(false)
      act(() => vi.advanceTimersByTime(1000))
      expect(screen.queryByRole('button', { name: 'Costa.png' })).toBeNull()
      // Vuelve al centro y se queda: el navegador repite el arrastre encima, sin volver a empezar
      drag.over(rowOf('Mapas'), 50)
      act(() => vi.advanceTimersByTime(500))
      drag.over(rowOf('Mapas'), 55)
      expect(screen.queryByRole('button', { name: 'Costa.png' })).toBeNull()
      act(() => vi.advanceTimersByTime(200))
      expect(screen.getByRole('button', { name: 'Costa.png' })).toBeDefined()
      expect(screen.getByRole('button', { name: 'Mapas' }).getAttribute('aria-expanded')).toBe('true')
      expect(rowOf('Mapas').classList.contains('arming')).toBe(false)
      drag.end(rowOf('Mapa de Eana.png'))
    } finally {
      vi.useRealTimers()
      drag.restore()
    }
  })

  it('una carpeta se mueve dentro de otra, pero no dentro de sí misma ni de las suyas', async () => {
    const maps = folderOf('Mapas')
    const north = folderOf('Norte', maps.id)
    const portraits = folderOf('Retratos')
    const api = fakeApi({ organizations: [ORG], worlds: [WORLD], folders: [maps, north, portraits], files: [] })
    renderAt(`/mundos/${WORLD.id}/archivos`, api)
    await userEvent.click(await screen.findByRole('button', { name: 'Mapas' }))
    await screen.findByRole('button', { name: 'Norte' })
    const drag = dragKit()
    try {
      // Mapas, en una de las suyas: no se marca
      drag.start(rowOf('Mapas'))
      drag.over(rowOf('Norte'), 50)
      expect(rowOf('Norte').dataset.drop).toBeUndefined()
      drag.end(rowOf('Mapas'))
      // Retratos, dentro de Norte
      drag.start(rowOf('Retratos'))
      drag.over(rowOf('Norte'), 50)
      expect(rowOf('Norte').dataset.drop).toBe('inside')
      drag.drop(rowOf('Norte'), 50)
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Norte' }).closest('li')?.contains(rowOf('Retratos'))).toBe(true)
      )
      const folders = (await api.client.call('listFiles', { worldId: WORLD.id })).folders
      await waitFor(async () =>
        expect(
          (await api.client.call('listFiles', { worldId: WORLD.id })).folders.find((f) => f.name === 'Retratos')
            ?.parentId
        ).toBe(north.id)
      )
      expect(folders).toHaveLength(3)
    } finally {
      drag.restore()
    }
  })
})

describe('los archivos en lo estrecho (la misma lista)', () => {
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

  it('buscar encuentra en todas las carpetas, y dice en cuál está', async () => {
    const folder = folderOf('Bestias')
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
    expect(await screen.findByRole('button', { name: 'Bestias' })).toBeDefined()
    expect(screen.queryByRole('link', { name: 'Bestiario.pdf' })).toBeNull()
    const search = screen.getByRole('searchbox', { name: 'Buscar por nombre o #etiqueta' })
    await userEvent.type(search, 'bestia')
    const found = await screen.findByRole('link', { name: 'Bestiario.pdf' })
    // En su árbol: dentro de su carpeta, desplegada (Enrique: «debe aparecer la carpeta en la que está»)
    const bestias = screen.getByRole('button', { name: 'Bestias' })
    expect(bestias.getAttribute('aria-expanded')).toBe('true')
    expect(bestias.closest('li')?.contains(found)).toBe(true)
    expect(screen.queryByRole('button', { name: 'Mapa de Eana.png' })).toBeNull()
    // Sin «Nueva carpeta» mientras se busca
    expect(screen.queryByRole('button', { name: 'Nueva carpeta' })).toBeNull()
    // Filtrar por tipo, también en todas
    await userEvent.clear(search)
    await userEvent.click(screen.getByRole('button', { name: 'PDF' }))
    expect(await screen.findByRole('link', { name: 'Bestiario.pdf' })).toBeDefined()
    expect(screen.getByText('1 archivo encontrado')).toBeDefined()
  })

  it('borrar una carpeta se lleva lo que tiene, avisando: sus archivos van a la papelera', async () => {
    const folder = folderOf('Viejos')
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
    expect(confirm.getByText(/con lo que tiene dentro/)).toBeDefined()
    await userEvent.click(confirm.getByRole('button', { name: 'Borrar la carpeta' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Viejos' })).toBeNull())
    expect(screen.queryByRole('link', { name: 'Antiguo.pdf' })).toBeNull()
    expect((await api.client.call('listTrash', { worldId: WORLD.id })).items).toMatchObject([{ name: 'Antiguo.pdf' }])
  })

  it('se eligen varios y se borran de una vez, con un aviso', async () => {
    const api = renderAt(`/mundos/${WORLD.id}/archivos`)
    const list = await cardsIn()
    await userEvent.click(await list.findByRole('checkbox', { name: 'Elegir Bestiario.pdf' }))
    await userEvent.click(list.getByRole('checkbox', { name: 'Elegir Notas.txt' }))
    const bar = within(screen.getByRole('group', { name: 'Lo elegido' }))
    expect(bar.getByText('2 elegidos')).toBeDefined()
    await userEvent.click(bar.getByRole('button', { name: 'Borrar' }))
    const confirm = within(await screen.findByRole('dialog', { name: '¿Borrar los 2 elegidos?' }))
    await userEvent.click(confirm.getByRole('button', { name: 'Borrar' }))
    await waitFor(() => expect(list.queryByRole('link', { name: 'Bestiario.pdf' })).toBeNull())
    expect(api.files.map((f) => f.name)).toEqual(['Mapa de Eana.png'])
    expect(screen.queryByRole('group', { name: 'Lo elegido' })).toBeNull()
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
    // Plegada, solo se ven los del mundo
    expect(await screen.findByRole('button', { name: 'Mapa de Eana.png' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Escudo.png' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Comunes' }))
    // Desplegada en su sitio: lo de la cuenta, dentro, y lo del mundo sigue a la vista
    expect(await screen.findByRole('button', { name: 'Escudo.png' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Mapa de Eana.png' })).toBeDefined()
    // Sin engranaje ni casilla: no se renombra ni se borra
    expect(screen.queryByRole('button', { name: 'Ajustes de la carpeta Comunes' })).toBeNull()
    expect(screen.queryByRole('checkbox', { name: 'Elegir Comunes' })).toBeNull()
    const input = document.querySelector<HTMLInputElement>('input[type=file][multiple]')
    if (!input) throw new Error('sin campo de archivos')
    await userEvent.click(screen.getByRole('button', { name: 'Subir archivos a Comunes' }))
    await userEvent.upload(input, [new File(['png'], 'Sello.png', { type: 'image/png' })])
    expect(await screen.findByRole('button', { name: 'Sello.png' })).toBeDefined()
    expect(api.files.find((f) => f.name === 'Sello.png')).toMatchObject({
      worldId: null,
      organizationId: ORG.id,
      folderId: null
    })
  })

  it('lo del mundo no va a los comunes, ni al revés: mientras se arrastra, sale apagado', async () => {
    renderAt(`/mundos/${WORLD.id}/archivos`, withCommon())
    await userEvent.click(await screen.findByRole('button', { name: 'Comunes' }))
    await screen.findByRole('button', { name: 'Escudo.png' })
    const drag = dragKit()
    try {
      drag.start(rowOf('Mapa de Eana.png'))
      // Levantado, y apagado lo que no lo admite: «Comunes» y lo suyo
      await waitFor(() => expect(rowOf('Comunes').classList.contains('dimmed')).toBe(true))
      expect(rowOf('Escudo.png').classList.contains('dimmed')).toBe(true)
      expect(rowOf('Mapa de Eana.png').closest('li')?.classList.contains('lifted')).toBe(true)
      drag.over(rowOf('Comunes'), 50)
      expect(rowOf('Comunes').dataset.drop).toBeUndefined()
      drag.over(rowOf('Escudo.png'), 10)
      expect(rowOf('Escudo.png').dataset.drop).toBeUndefined()
      // Para los lectores de pantalla, dicho
      expect(await screen.findByText('Un archivo del mundo no pasa a los comunes, ni al revés')).toBeDefined()
      drag.end(rowOf('Mapa de Eana.png'))
      await waitFor(() => expect(rowOf('Comunes').classList.contains('dimmed')).toBe(false))
      // Y al revés: un común no admite lo del mundo
      drag.start(rowOf('Escudo.png'))
      await waitFor(() => expect(rowOf('Mapa de Eana.png').classList.contains('dimmed')).toBe(true))
      expect(rowOf('Comunes').classList.contains('dimmed')).toBe(false)
      drag.over(rowOf('Mapa de Eana.png'), 10)
      expect(rowOf('Mapa de Eana.png').dataset.drop).toBeUndefined()
      drag.end(rowOf('Escudo.png'))
    } finally {
      drag.restore()
    }
  })

  it('en un mundo, sus carpetas se recolocan hasta justo antes de «Comunes» (siempre tras ellas), y los comunes, entre ellos', async () => {
    const api = fakeApi({
      organizations: [ORG],
      worlds: [WORLD],
      folders: [folderOf('Mapas'), folderOf('Retratos')],
      files: [
        { worldId: null, organizationId: ORG.id, name: 'Escudo.png', kind: 'image' },
        { worldId: null, organizationId: ORG.id, name: 'Lema.png', kind: 'image' }
      ]
    })
    renderAt(`/mundos/${WORLD.id}/archivos`, api)
    await screen.findByRole('button', { name: 'Comunes' })
    const root = screen.getByRole('list', { name: 'Archivos' })
    expect(namesIn(root)).toEqual(['Mapas', 'Retratos', 'Comunes'])
    const drag = dragKit()
    try {
      // Mapas, encima de «Comunes»: detrás de la última del mundo
      drag.start(rowOf('Mapas'))
      drag.over(rowOf('Comunes'), 10)
      expect(rowOf('Comunes').dataset.drop).toBe('before')
      drag.drop(rowOf('Comunes'), 10)
      await waitFor(() => expect(namesIn(root)).toEqual(['Retratos', 'Mapas', 'Comunes']))
      await waitFor(async () =>
        expect((await api.client.call('listFiles', { worldId: WORLD.id })).folders.map((f) => f.name)).toEqual([
          'Retratos',
          'Mapas'
        ])
      )
      // Ahí ya está: no se marca
      drag.start(rowOf('Mapas'))
      drag.over(rowOf('Comunes'), 10)
      expect(rowOf('Comunes').dataset.drop).toBeUndefined()
      drag.end(rowOf('Mapas'))
      // Dentro de «Comunes», Lema delante de Escudo
      await userEvent.click(screen.getByRole('button', { name: 'Comunes' }))
      await screen.findByRole('button', { name: 'Lema.png' })
      drag.start(rowOf('Lema.png'))
      drag.over(rowOf('Escudo.png'), 10)
      expect(rowOf('Escudo.png').dataset.drop).toBe('before')
      drag.drop(rowOf('Escudo.png'), 10)
      await waitFor(() => expect(namesIn(listOf('Lema.png'))).toEqual(['Lema.png', 'Escudo.png']))
      await waitFor(async () =>
        expect((await api.client.call('listCommonFiles', {})).files.map((f) => f.name)).toEqual([
          'Lema.png',
          'Escudo.png'
        ])
      )
    } finally {
      drag.restore()
    }
  })

  it('en los comunes (fuera de los mundos) se mueven: a una carpeta y, encima de una fila de fuera, otra vez arriba', async () => {
    const folder = folderOf('Sellos', null, null)
    const api = fakeApi({
      organizations: [ORG],
      worlds: [WORLD],
      folders: [folder],
      files: [
        { worldId: null, organizationId: ORG.id, name: 'Escudo.png', kind: 'image' },
        { worldId: null, organizationId: ORG.id, name: 'Lema.txt', kind: 'other', mime: 'text/plain' }
      ]
    })
    renderAt('/archivos', api)
    await screen.findByRole('button', { name: 'Escudo.png' })
    const shield = api.files.find((f) => f.name === 'Escudo.png')
    const drag = dragKit()
    try {
      drag.start(rowOf('Escudo.png'))
      drag.over(rowOf('Sellos'), 50)
      expect(rowOf('Sellos').dataset.drop).toBe('inside')
      drag.drop(rowOf('Sellos'), 50)
      await waitFor(() => expect(shield?.folderId).toBe(folder.id))
      // Ya dentro de Sellos (desplegada): encima de una fila de lo más alto, vuelve
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Sellos' }).closest('li')?.contains(rowOf('Escudo.png'))).toBe(true)
      )
      drag.start(rowOf('Escudo.png'))
      drag.over(rowOf('Lema.txt'), 10)
      expect(rowOf('Lema.txt').dataset.drop).toBe('before')
      drag.drop(rowOf('Lema.txt'), 10)
      await waitFor(() => expect(shield?.folderId).toBeNull())
    } finally {
      drag.restore()
    }
  })

  it('fuera de los mundos, «Archivos» en la barra lleva a los comunes', async () => {
    renderAt('/mundos', withCommon())
    await userEvent.click(await screen.findByRole('link', { name: 'Archivos' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Archivos comunes' })).toBeDefined()
    expect(await screen.findByRole('button', { name: 'Escudo.png' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Mapa de Eana.png' })).toBeNull()
  })
})

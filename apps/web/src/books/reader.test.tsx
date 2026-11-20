import type { World } from '@crisol/contracts'
import type { ContentItem } from '@crisol/systems'
import { cinco } from '@crisol/systems/fixtures'
import { createMemoryHistory } from '@tanstack/react-router'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Editor } from '@tiptap/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { ApiError } from '../api/client.ts'
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
const WOLF: ContentItem = { type: 'personaje', key: 'lobo', source: null, data: { name: { es: 'Lobo', en: 'Wolf' } } }

const COMBATE = `Cada asalto dura seis segundos.

## La iniciativa

Tira 1d20.

> [!secreto]
> Los goblins huyen.`

async function renderBook(
  path: string,
  {
    chapters = true,
    markdown = COMBATE,
    fail,
    failures = Number.POSITIVE_INFINITY,
    prepare,
    editing = true
  }: {
    /** Sin ellos, el libro vacío */
    chapters?: boolean
    /** El texto del primero */
    markdown?: string
    /** Una acción que falla (el servidor la rechaza)… */
    fail?: string
    /** …tantas veces (sin decirlo, siempre) */
    failures?: number
    /** Algo que preparar antes (subir una imagen) */
    prepare?: (api: ReturnType<typeof fakeApi>) => Promise<unknown>
    /** Ponerlo a escribir al abrirlo («⋯ › Editar»; se abre para leer) */
    editing?: boolean
  } = {}
) {
  const api = fakeApi({ organizations: [ORG], worlds: [WORLD], systems: [OWN], systemContent: { [OWN.id]: [WOLF] } })
  await prepare?.(api)
  const first = chapters
    ? await api.client.call('saveChapter', { systemId: OWN.id, source: 'srd51', title: 'El combate', markdown })
    : null
  if (chapters)
    await api.client.call('saveChapter', {
      systemId: OWN.id,
      source: 'srd51',
      title: 'La magia',
      markdown: 'Espacios.'
    })
  let left = failures
  const client = fail
    ? {
        ...api.client,
        call: ((name, input) => {
          if (name !== fail || left <= 0) return api.client.call(name, input)
          left -= 1
          return Promise.reject(new ApiError('BAD_REQUEST', 400))
        }) as typeof api.client.call
      }
    : api.client
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }))
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
      api={client}
    />
  )
  // Se abre para leer: el dueño lo pone a escribir desde «⋯»
  if (chapters && editing && path.startsWith('/sistemas/')) {
    const more = await screen
      .findByRole('button', { name: 'Más acciones del capítulo' }, { timeout: 1500 })
      .catch(() => null)
    if (more) {
      await userEvent.click(more)
      await userEvent.click(await screen.findByRole('button', { name: 'Editar' }))
    }
  }
  return { api, router, first: first ?? { id: '' } }
}

const BOOK = `/sistemas/${OWN.id}/libros/srd51`

/** El editor de un texto (TipTap lo cuelga de su elemento) */
const editorOf = (element: HTMLElement) => (element as HTMLElement & { editor: Editor }).editor

/** Un capítulo, como ha quedado guardado */
const savedText = async (api: ReturnType<typeof fakeApi>, chapterId: string) =>
  (await api.client.call('getChapter', { chapterId })).markdown

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
  afterEach(() => vi.restoreAllMocks())

  it('abre en el primero, con sus secciones en el índice; «Siguiente» lleva al otro', async () => {
    const { router } = await renderBook(BOOK)
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
    // Y «Anterior» vuelve
    const back = within(screen.getByRole('navigation', { name: 'Anterior y siguiente' }))
    await userEvent.click(back.getByRole('link', { name: /Anterior/ }))
    // Se abre para leer
    expect(await screen.findByRole('heading', { level: 2, name: 'El combate' })).toBeDefined()
  })

  it('una imagen del sistema en el texto (![[ruta]]), por su ruta; si falta, lo dice', async () => {
    await renderBook(BOOK, {
      markdown: 'Antes.\n\n![[systems/5e/tokens/trasgo.webp|Un trasgo|300]]\n\n![[iconos/no-esta.webp]]\n'
    })
    const image = (await screen.findByRole('img', { name: 'Un trasgo' })) as HTMLImageElement
    expect(image.getAttribute('src')).toBe(
      `/api/system-images/${OWN.id}?path=${encodeURIComponent('systems/5e/tokens/trasgo.webp')}`
    )
    expect(image.style.inlineSize).toBe('300px')
    // Sin texto alternativo es decorativa (sin papel de imagen): se busca por su dirección
    const missing = document.querySelector('img[src*="no-esta"]')
    if (!missing) throw new Error('falta la imagen')
    act(() => {
      missing.dispatchEvent(new Event('error'))
    })
    expect(await screen.findByText('Falta la imagen «iconos/no-esta.webp»')).toBeDefined()
  })

  it('una imagen del sistema lleva debajo el crédito de quien la hizo', async () => {
    await renderBook(BOOK, {
      markdown: '![[book/mesa.webp]]\n*Una mesa mágica*\n',
      prepare: (api) =>
        api.client.call('putSystemImages', {
          systemId: OWN.id,
          images: [{ path: 'book/mesa.webp', data: 'UklGRg==', license: 'unknown', credit: 'Luca Bancone' }]
        })
    })
    expect(await screen.findByText('Luca Bancone')).toBeDefined()
    expect(screen.getByText('Ilustración de')).toBeDefined()
    // Al leerlo (sin escribir en el texto), sin los ajustes de la imagen aunque quede elegida
    expect(screen.queryByLabelText('Ancho')).toBeNull()
  })

  it('el dueño marca un capítulo solo para el máster desde «⋯»: lleva su etiqueta y se guarda', async () => {
    const { api, first } = await renderBook(BOOK)
    await screen.findByLabelText('Título del capítulo')
    await userEvent.click(screen.getByRole('button', { name: 'Más acciones del capítulo' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Solo para el máster' }))
    expect(await screen.findByText('Solo para el máster', { selector: 'span' })).toBeDefined()
    await waitFor(async () => expect((await api.client.call('getChapter', { chapterId: first.id })).master).toBe(true))
    await userEvent.click(screen.getByRole('button', { name: 'Más acciones del capítulo' }))
    expect(await screen.findByRole('button', { name: 'Que lo lean los jugadores' })).toBeDefined()
  })

  it('sus enlaces (ADR-0033): a otro capítulo con su dirección, a una sección suya, y sin destino, solo su texto', async () => {
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    const { api } = await renderBook(BOOK, {
      markdown: 'Lee [[La magia]], [[#La iniciativa|la iniciativa]] y [[Nada]].\n\n## La iniciativa\n\nTira.'
    })
    // El de la sección, cuando ya está el texto (el índice y «Siguiente» también llevan a «La magia»)
    const section = await screen.findByRole('link', { name: 'la iniciativa' })
    const text = section.closest('.ProseMirror') as HTMLElement
    const magia = within(text).getByRole('link', { name: 'La magia' }) as HTMLAnchorElement
    const chapters = (await api.client.call('listBookChapters', { systemId: OWN.id, source: 'srd51' })).chapters
    const second = chapters.find((c: { title: string }) => c.title === 'La magia')
    expect(magia.getAttribute('href')).toContain(`capitulo=${second?.id}`)
    expect(within(text).queryByRole('link', { name: 'Nada' })).toBeNull()
    expect(text.textContent).toContain('y Nada')
    await userEvent.click(section)
    expect(scroll).toHaveBeenCalled()
  })

  it('se abre para leer; «⋯ › Editar» lo pone a escribir y «Dejar de editar» lo vuelve a dejar para leer', async () => {
    await renderBook(BOOK, { editing: false })
    expect(await screen.findByRole('heading', { level: 2, name: 'El combate' })).toBeDefined()
    expect(screen.queryByLabelText('Título del capítulo')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Más acciones del capítulo' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Editar' }))
    expect(await screen.findByLabelText('Título del capítulo')).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Más acciones del capítulo' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Dejar de editar' }))
    expect(screen.queryByLabelText('Título del capítulo')).toBeNull()
  })

  it('al leerlo, los enlaces al compendio ([[@…]]) se resuelven y, al pasar el ratón, enseñan la entrada entera', async () => {
    await renderBook(BOOK, { editing: false, markdown: 'Ver [[@Lobo]] y [[@Nadie]].' })
    const link = await screen.findByRole('link', { name: 'Lobo' })
    expect(link.getAttribute('href')).toContain('lobo')
    await userEvent.hover(link)
    const card = await screen.findByRole('tooltip')
    expect(within(card).getByText('Lobo')).toBeDefined()
  })

  it('un enlace a otro capítulo enseña, al pasar el ratón, ese apartado', async () => {
    await renderBook(BOOK, { editing: false, markdown: 'Lee [[La magia]].' })
    // El del texto (el índice y «Siguiente» también llevan a «La magia»)
    const text = await waitFor(() => {
      const found = screen.getAllByRole('link', { name: 'La magia' }).find((a) => a.closest('.ProseMirror'))
      if (!found) throw new Error('falta el enlace')
      return found
    })
    await userEvent.hover(text)
    const card = await screen.findByRole('tooltip')
    expect(await within(card).findByText('Espacios.')).toBeDefined()
  })

  it('pulsar una sección del índice va a su título y la marca como la que se lee', async () => {
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    await renderBook(BOOK)
    const index = within(await screen.findByRole('navigation', { name: 'Capítulos' }))
    const section = await index.findByRole('link', { name: 'La iniciativa' })
    await userEvent.click(section)
    expect(scroll).toHaveBeenCalledWith(expect.objectContaining({ block: 'start' }))
    expect(scroll.mock.contexts[0]).toHaveProperty('textContent', 'La iniciativa')
    expect(section.getAttribute('aria-current')).toBe('location')
  })

  it('un libro sin capítulos: su dueño crea el primero y lo abre', async () => {
    await renderBook(`${BOOK}?vista=capitulos`, { chapters: false })
    expect(await screen.findByText(/Escríbelos aquí o pídeselos a tu IA/)).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Capítulo nuevo' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Capítulo nuevo' }))
    await userEvent.type(dialog.getByRole('textbox', { name: 'Título del capítulo' }), 'Prólogo')
    await userEvent.click(dialog.getByRole('button', { name: 'Crear' }))
    await waitFor(() => expect(screen.getByLabelText('Título del capítulo')).toHaveProperty('value', 'Prólogo'))
    const index = within(screen.getByRole('navigation', { name: 'Capítulos' }))
    expect(index.getByRole('link', { name: 'Prólogo' }).getAttribute('aria-current')).toBe('page')
  })

  it('si no llegan los capítulos, lo dice y deja reintentarlo', async () => {
    await renderBook(BOOK, { fail: 'listBookChapters', failures: 1 })
    const retry = await screen.findByRole('button', { name: 'Reintentar' })
    expect(screen.queryByLabelText('Título del capítulo')).toBeNull()
    await userEvent.click(retry)
    // Se abre para leer
    expect(await screen.findByRole('heading', { level: 2, name: 'El combate' })).toBeDefined()
  })

  it('cambiar el título lo guarda con su versión y lo pone en el índice', async () => {
    const { api, first } = await renderBook(BOOK)
    const title = await screen.findByLabelText('Título del capítulo')
    await userEvent.clear(title)
    await userEvent.type(title, 'El asalto{Enter}')
    const index = within(screen.getByRole('navigation', { name: 'Capítulos' }))
    expect(await index.findByRole('link', { name: 'El asalto' })).toBeDefined()
    const saved = await api.client.call('getChapter', { chapterId: first.id })
    expect(saved).toMatchObject({ title: 'El asalto', version: 2 })
  })

  it('un título vacío no se guarda: vuelve el que tenía', async () => {
    const { api, first } = await renderBook(BOOK)
    const title = await screen.findByLabelText('Título del capítulo')
    await userEvent.clear(title)
    await userEvent.tab()
    expect(title).toHaveProperty('value', 'El combate')
    // Escape deshace lo escrito sin guardarlo
    await userEvent.type(title, ' largo{Escape}')
    expect(title).toHaveProperty('value', 'El combate')
    expect(await api.client.call('getChapter', { chapterId: first.id })).toMatchObject({ version: 1 })
  })

  it('lo escrito en el texto se guarda solo, un momento después', async () => {
    const { api, first } = await renderBook(BOOK)
    const text = await screen.findByRole('textbox', { name: 'Texto de «El combate»' })
    act(() => {
      // Al principio (al final está el secreto, que es un bloque entero)
      editorOf(text).chain().focus().setTextSelection(1).insertContent('Ojo: ').run()
    })
    expect(await screen.findByText('Guardando…')).toBeDefined()
    await waitFor(async () => expect(await savedText(api, first.id)).toContain('Ojo: Cada asalto'), { timeout: 4000 })
    expect(await screen.findByText('Guardado')).toBeDefined()
    // El secreto sigue dentro
    expect(await savedText(api, first.id)).toContain('> Los goblins huyen.')
  })

  it('lo que se escribe y se deshace antes de guardar no se manda', async () => {
    const { api, first } = await renderBook(BOOK)
    const text = await screen.findByRole('textbox', { name: 'Texto de «El combate»' })
    const editor = editorOf(text)
    act(() => {
      editor.chain().focus('end').insertContent('x').run()
    })
    expect(await screen.findByText('Guardando…')).toBeDefined()
    act(() => {
      editor.commands.undo()
    })
    await waitFor(() => expect(screen.queryByText('Guardando…')).toBeNull(), { timeout: 4000 })
    expect(await api.client.call('getChapter', { chapterId: first.id })).toMatchObject({ version: 1 })
  })

  it('lo escrito dentro de un secreto se guarda en él', async () => {
    const { api, first } = await renderBook(BOOK)
    const inner = await screen.findByRole('textbox', { name: 'Texto del secreto' })
    act(() => {
      editorOf(inner).chain().focus('end').insertContent(' Y no vuelven.').run()
    })
    await waitFor(async () => expect(await savedText(api, first.id)).toContain('> Los goblins huyen. Y no vuelven.'), {
      timeout: 4000
    })
  })

  it('«Convertir en texto normal» saca lo del secreto al cuerpo', async () => {
    const { api, first } = await renderBook(BOOK)
    const secret = await screen.findByRole('region', { name: 'Secreto' })
    await userEvent.click(within(secret).getByRole('button', { name: 'Convertir en texto normal' }))
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Secreto' })).toBeNull())
    await waitFor(
      async () => {
        const saved = await savedText(api, first.id)
        expect(saved).not.toContain('[!secreto]')
        expect(saved).toContain('Los goblins huyen.')
      },
      { timeout: 4000 }
    )
  })

  it('«/secreto» pone un secreto vacío donde está el cursor', async () => {
    const { api, first } = await renderBook(BOOK, { markdown: 'Uno.' })
    const text = await screen.findByRole('textbox', { name: 'Texto de «El combate»' })
    const editor = editorOf(text)
    act(() => {
      editor.chain().focus('end').insertContent(' /').run()
    })
    // Sin nada escrito, todos los bloques salvo los de las hojas (un capítulo no tiene panel)
    expect(await screen.findByRole('listbox')).toBeDefined()
    act(() => {
      editor.chain().focus('end').insertContent('secreto').run()
    })
    const option = await screen.findByRole('option', { name: 'Secreto' })
    act(() => {
      option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    })
    expect(await screen.findByRole('region', { name: 'Secreto' })).toBeDefined()
    await waitFor(async () => expect(await savedText(api, first.id)).toContain('[!secreto]'), { timeout: 4000 })
  })

  it('dentro de un secreto, «/» no ofrece otro secreto', async () => {
    await renderBook(BOOK)
    const inner = await screen.findByRole('textbox', { name: 'Texto del secreto' })
    act(() => {
      editorOf(inner).chain().focus('end').insertContent(' /').run()
    })
    const list = await screen.findByRole('listbox')
    expect(within(list).getAllByRole('option').length).toBeGreaterThan(0)
    expect(within(list).queryByRole('option', { name: 'Secreto' })).toBeNull()
    // Ni buscándolo por su nombre
    act(() => {
      editorOf(inner).chain().focus('end').insertContent('secreto').run()
    })
    expect(await screen.findByText('Ningún bloque se llama así.')).toBeDefined()
  })

  it('lo elegido pasa a un secreto con el botón de su menú', async () => {
    const { api, first } = await renderBook(BOOK, { markdown: 'Uno.\n\nDos.' })
    const text = await screen.findByRole('textbox', { name: 'Texto de «El combate»' })
    act(() => {
      editorOf(text).chain().focus().setTextSelection({ from: 1, to: 5 }).run()
    })
    const toolbar = await screen.findByRole('toolbar')
    await userEvent.click(within(toolbar).getByRole('button', { name: 'Secreto' }))
    const secret = await screen.findByRole('region', { name: 'Secreto' })
    expect(within(secret).getByText('Uno.')).toBeDefined()
    await waitFor(async () => expect(await savedText(api, first.id)).toContain('> [!secreto]\n> Uno.'), {
      timeout: 4000
    })
  })

  it('«[[@» busca en el compendio de su sistema y pone su ficha', async () => {
    await renderBook(BOOK, { markdown: 'Uno.' })
    const text = await screen.findByRole('textbox', { name: 'Texto de «El combate»' })
    act(() => {
      editorOf(text).chain().focus('end').insertContent(' ![[@Lo').run()
    })
    const option = await screen.findByRole('option', { name: /Lobo/ })
    act(() => {
      option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    })
    expect(await screen.findByRole('article', { name: 'Lobo' })).toBeDefined()
    expect(await screen.findByText('Enlace a «Lobo».')).toBeDefined()
  })

  it('una lista de tareas dice de cada casilla si está hecha', async () => {
    await renderBook(BOOK, { markdown: 'Comprar flechas' })
    const text = await screen.findByRole('textbox', { name: 'Texto de «El combate»' })
    act(() => {
      editorOf(text).chain().focus().toggleTaskList().run()
    })
    expect(await screen.findByRole('checkbox', { name: 'Por hacer: Comprar flechas' })).toBeDefined()
  })

  it('si otro lo cambió mientras tanto, avisa, deja de escribir y vuelve a cargarlo', async () => {
    const { api, first } = await renderBook(BOOK)
    const title = await screen.findByLabelText('Título del capítulo')
    // Otro lo cambia por su lado
    await api.client.call('saveChapter', {
      systemId: OWN.id,
      source: 'srd51',
      chapterId: first.id,
      version: 1,
      title: 'Las peleas'
    })
    await userEvent.clear(title)
    await userEvent.type(title, 'El asalto{Enter}')
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Alguien lo ha cambiado mientras tanto.')
    await userEvent.click(within(alert).getByRole('button', { name: 'Volver a cargar' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(screen.getByLabelText('Título del capítulo')).toHaveProperty('value', 'Las peleas')
  })

  it('si no se puede guardar, lo dice', async () => {
    await renderBook(BOOK, { fail: 'saveChapter' })
    const title = await screen.findByLabelText('Título del capítulo')
    await userEvent.type(title, '!{Enter}')
    expect((await screen.findByRole('alert')).textContent).toContain('No se ha podido guardar.')
  })

  it('«Bajar» y «Subir» cambian su sitio en el índice', async () => {
    const { api } = await renderBook(BOOK)
    const order = async () =>
      (await api.client.call('listBookChapters', { systemId: OWN.id, source: 'srd51' })).chapters.map((c) => c.title)
    const index = within(await screen.findByRole('navigation', { name: 'Capítulos' }))
    // Abierto por su dirección, para que siga abierto al moverlo
    await userEvent.click(index.getByRole('link', { name: 'El combate' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Más acciones del capítulo' }))
    expect(screen.getByRole('button', { name: 'Subir' })).toHaveProperty('disabled', true)
    await userEvent.click(screen.getByRole('button', { name: 'Bajar' }))
    await waitFor(async () => expect(await order()).toEqual(['La magia', 'El combate']))
    await waitFor(() =>
      expect(index.getAllByRole('link').map((link) => link.textContent)).toEqual([
        'La magia',
        'El combate',
        'La iniciativa'
      ])
    )
    await userEvent.click(screen.getByRole('button', { name: 'Más acciones del capítulo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Subir' }))
    await waitFor(async () => expect(await order()).toEqual(['El combate', 'La magia']))
  })

  it('borrar uno pregunta antes y abre el siguiente', async () => {
    await renderBook(BOOK)
    await userEvent.click(await screen.findByRole('button', { name: 'Más acciones del capítulo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Borrar capítulo' }))
    const dialog = within(screen.getByRole('dialog', { name: '¿Borrar «El combate»?' }))
    await userEvent.click(dialog.getByRole('button', { name: 'Borrar capítulo' }))
    await waitFor(() => expect(screen.getByLabelText('Título del capítulo')).toHaveProperty('value', 'La magia'))
    const index = within(screen.getByRole('navigation', { name: 'Capítulos' }))
    expect(index.queryByRole('link', { name: 'El combate' })).toBeNull()
  })

  it('«Cancelar» no lo borra', async () => {
    const { api } = await renderBook(BOOK)
    await userEvent.click(await screen.findByRole('button', { name: 'Más acciones del capítulo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Borrar capítulo' }))
    const dialog = screen.getByRole('dialog', { name: '¿Borrar «El combate»?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '¿Borrar «El combate»?' })).toBeNull())
    const { chapters } = await api.client.call('listBookChapters', { systemId: OWN.id, source: 'srd51' })
    expect(chapters).toHaveLength(2)
  })

  it('en el móvil, «Ir a…» lleva a un capítulo o a una sección del abierto', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) =>
        ({
          matches: query === '(max-width: 48rem)',
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined
        }) as unknown as MediaQueryList
    )
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    await renderBook(BOOK)
    const goTo = await screen.findByRole('combobox', { name: 'Ir a…' })
    const options = await within(goTo).findAllByRole('option')
    await waitFor(() =>
      expect(
        within(goTo)
          .getAllByRole('option')
          .map((o) => o.textContent?.trim())
      ).toEqual(['Un capítulo o una sección', 'El combate', 'La iniciativa', 'La magia'])
    )
    expect(options.length).toBeGreaterThan(0)
    await userEvent.selectOptions(goTo, within(goTo).getByRole('option', { name: /La iniciativa/ }))
    expect(scroll).toHaveBeenCalled()
    await userEvent.selectOptions(goTo, within(goTo).getByRole('option', { name: 'La magia' }))
    await waitFor(() => expect(screen.getByLabelText('Título del capítulo')).toHaveProperty('value', 'La magia'))
  })

  it('una entrada incrustada sale como su ficha, que se abre en el compendio; la que no está, avisa al dueño', async () => {
    await renderBook(BOOK, { markdown: 'Aparece:\n\n![[@Lobo]]\n\nY:\n\n![[@Nadie]]\n' })
    const card = await screen.findByRole('article', { name: 'Lobo' })
    expect(within(card).getByText('Personaje')).toBeDefined()
    expect(within(card).getByRole('link', { name: 'Abrir' }).getAttribute('href')).toBe(
      `/sistemas/${OWN.id}/compendio?ver=lobo`
    )
    expect(await screen.findByText('Nadie: no está en el compendio')).toBeDefined()
  })
})

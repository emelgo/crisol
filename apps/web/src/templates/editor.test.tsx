import { createMemoryHistory } from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'

const ORG = { id: crypto.randomUUID(), name: 'Fateforge', role: 'owner' as const }

async function renderTemplate(id?: string) {
  const api = fakeApi({ organizations: [ORG], worlds: [] })
  const own = await api.client.call('createTemplate', { name: 'Frente', icon: 'hourglass' })
  const router = createAppRouter(createMemoryHistory({ initialEntries: [`/plantillas/${id ?? own.id}`] }))
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
      api={api.client}
    />
  )
  const saved = () => api.client.call('getTemplate', { templateId: own.id })
  return { api, own, saved, router }
}

const panel = async () => within(await screen.findByRole('complementary', { name: 'Panel de la página' }))

/** «Añadir bloque › Propiedad» (o «› Etiquetas»), como en una página: un campo; devuelve los campos del panel */
async function addField(kind: 'Propiedad' | 'Etiquetas' = 'Propiedad') {
  const side = await panel()
  await userEvent.click(side.getByRole('button', { name: 'Añadir bloque' }))
  await userEvent.click(side.getByRole('button', { name: kind }))
  return within(await side.findByRole('region', { name: 'Propiedades' }))
}

describe('editar una plantilla', () => {
  beforeEach(() =>
    localStorage.setItem('crisol.recorridos.enrique@crisol.test', JSON.stringify({ seen: ['plantillas', 'plantilla'] }))
  )

  it('sus campos: uno de opciones con su lista y un reloj de 8; todo se guarda solo', async () => {
    const { saved } = await renderTemplate()
    const fields = await addField()
    await userEvent.clear(fields.getByLabelText('Nombre'))
    await userEvent.type(fields.getByLabelText('Nombre'), 'Nivel{Enter}')
    await userEvent.selectOptions(fields.getByLabelText('Tipo'), 'Opciones')
    await userEvent.type(fields.getByLabelText('Opción…'), 'Local{Enter}')
    await userEvent.type(fields.getByLabelText('Opción…'), 'Regional{Enter}')
    await waitFor(async () =>
      expect((await saved()).fields).toEqual([
        {
          name: 'Nivel',
          field: expect.stringMatching(/^[0-9a-f]{10}$/),
          type: 'choice',
          value: '',
          options: ['Local', 'Regional']
        }
      ])
    )
    // Otro: un reloj de 8
    await addField()
    await userEvent.selectOptions(fields.getAllByLabelText('Tipo').at(-1) as HTMLElement, 'Reloj')
    const segments = fields.getByLabelText('Segmentos')
    await userEvent.clear(segments)
    await userEvent.type(segments, '8{Enter}')
    await waitFor(async () => expect((await saved()).fields[1]).toMatchObject({ type: 'clock', segments: 8 }))
    expect(fields.getByRole('button', { name: /Reloj de 8/ })).toBeDefined()
  })

  it('sin campos ni bloques, «Panel vacío» como en una página (sin lista «Campos» ni «+ Campo»)', async () => {
    await renderTemplate()
    const side = await panel()
    expect(await side.findByText('Panel vacío')).toBeDefined()
    expect(side.queryByRole('region', { name: 'Campos' })).toBeNull()
    expect(side.queryByRole('button', { name: 'Campo' })).toBeNull()
  })

  it('su panel, como el de una página: los campos de antes, en su orden y arriba (tras el retrato)', async () => {
    const { api, own, saved } = await renderTemplate()
    await api.client.call('updateTemplate', {
      templateId: own.id,
      fields: [
        { name: 'Nivel', type: 'number', value: null },
        { name: 'Facción', type: 'text', value: '' }
      ],
      panel: [{ id: 'retrato', type: 'image', fileId: null, caption: '' }]
    })
    const side = await panel()
    const fields = within(await side.findByRole('region', { name: 'Propiedades' }))
    expect(
      fields
        .getAllByRole('button', { name: /Nivel|Facción/ })
        .map((b) => b.textContent)
        .filter(Boolean)
    ).toEqual(['NivelNúmero', 'FacciónTexto'])
    // Tras la imagen que abre el panel, como las propiedades de una página
    const image = side.getByRole('button', { name: /^Imagen/ })
    expect(image.compareDocumentPosition(fields.getByRole('button', { name: /^Nivel/ }))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
    expect(side.queryByText('Panel vacío')).toBeNull()
    // «Etiquetas»: su lista, una sola vez; «Oculto a los jugadores», en sus opciones
    await addField('Etiquetas')
    await addField('Etiquetas')
    await waitFor(async () =>
      expect((await saved()).fields.map((f) => f.name)).toEqual(['Nivel', 'Facción', 'etiquetas'])
    )
    await userEvent.click(fields.getByRole('checkbox', { name: 'Oculto a los jugadores' }))
    await waitFor(async () => expect((await saved()).fields[2]).toMatchObject({ type: 'list', hidden: true }))
    expect(fields.getByLabelText('Oculto')).toBeDefined()
  })

  it('un campo «Fecha», vacío, con «Con fin» y «Fuera de las líneas temporales»', async () => {
    const { saved } = await renderTemplate()
    const fields = await addField()
    await userEvent.clear(fields.getByLabelText('Nombre'))
    await userEvent.type(fields.getByLabelText('Nombre'), 'Reinado{Enter}')
    await userEvent.selectOptions(fields.getByLabelText('Tipo'), 'Fecha')
    await userEvent.click(fields.getByRole('checkbox', { name: 'Con fin' }))
    await waitFor(async () =>
      expect((await saved()).fields[0]).toEqual({
        name: 'Reinado',
        field: expect.any(String),
        type: 'date',
        value: null,
        range: true
      })
    )
    await userEvent.click(fields.getByRole('checkbox', { name: 'Fuera de las líneas temporales' }))
    await userEvent.click(fields.getByRole('checkbox', { name: 'Con fin' }))
    await waitFor(async () =>
      expect((await saved()).fields[0]).toEqual({
        name: 'Reinado',
        field: expect.any(String),
        type: 'date',
        value: null,
        offTimeline: true
      })
    )
    expect(fields.getByRole('button', { name: /Reinado.*Fecha/ })).toBeDefined()
  })

  it('un campo de enlace con su papel y su nombre al revés (módulo 10): «Se lee así» en los dos sentidos', async () => {
    const { saved } = await renderTemplate()
    const fields = await addField()
    await userEvent.clear(fields.getByLabelText('Nombre'))
    await userEvent.type(fields.getByLabelText('Nombre'), 'Padres{Enter}')
    await userEvent.selectOptions(fields.getByLabelText('Tipo'), 'Enlaces a páginas')
    // Sin nombre al revés, se lee «Padres de»
    expect(fields.getByText('Padres de')).toBeDefined()
    // Al elegir el papel, el nombre al revés se pone solo si estaba vacío
    await userEvent.selectOptions(fields.getByLabelText('Papel'), 'Padre o madre')
    expect(fields.getByLabelText('Nombre al revés')).toHaveProperty('value', 'Hijos')
    await waitFor(async () =>
      expect((await saved()).fields[0]).toMatchObject({
        name: 'Padres',
        type: 'pages',
        role: 'parent',
        inverseName: 'Hijos'
      })
    )
    expect(fields.getByText('Hijos')).toBeDefined()
    // Uno escrito a mano no se pisa al cambiar de papel; y se puede quitar
    await userEvent.clear(fields.getByLabelText('Nombre al revés'))
    await userEvent.type(fields.getByLabelText('Nombre al revés'), 'Descendencia{Enter}')
    await userEvent.selectOptions(fields.getByLabelText('Papel'), 'Pareja')
    await waitFor(async () =>
      expect((await saved()).fields[0]).toMatchObject({ role: 'partner', inverseName: 'Descendencia' })
    )
    await userEvent.clear(fields.getByLabelText('Nombre al revés'))
    fields.getByLabelText('Nombre al revés').blur()
    await waitFor(async () => expect((await saved()).fields[0]).not.toHaveProperty('inverseName'))
    expect(fields.getByText('Padres de')).toBeDefined()
    await userEvent.selectOptions(fields.getByLabelText('Papel'), 'Padre o madre')
    await waitFor(async () => expect((await saved()).fields[0]).toMatchObject({ inverseName: 'Hijos' }))
    // En la lista, junto a su nombre
    expect(fields.getByRole('button', { name: /Padres.*Padre o madre/ })).toBeDefined()
    // A una sola página, el papel se queda; «Ninguno» lo quita
    await userEvent.selectOptions(fields.getByLabelText('Tipo'), 'Enlace a una página')
    await waitFor(async () => expect((await saved()).fields[0]).toMatchObject({ single: true, role: 'parent' }))
    await userEvent.selectOptions(fields.getByLabelText('Papel'), 'Ninguno')
    await waitFor(async () => expect((await saved()).fields[0]).not.toHaveProperty('role'))
  })

  it('su panel: una tabla de páginas con sus desplegables, con título', async () => {
    const { saved } = await renderTemplate()
    const side = await panel()
    await userEvent.click(side.getByRole('button', { name: 'Añadir bloque' }))
    await userEvent.click(side.getByRole('button', { name: 'Tabla de páginas' }))
    const blocks = within(side.getByRole('region', { name: 'En el panel' }))
    await userEvent.type(blocks.getByLabelText('Título del bloque Tabla de páginas'), 'PNJ del frente{Enter}')
    await userEvent.selectOptions(blocks.getByLabelText('Páginas de'), 'PNJ')
    await waitFor(async () =>
      expect((await saved()).panel).toEqual([
        expect.objectContaining({ type: 'related', title: 'PNJ del frente', template: 'pnj', field: 'faccion' })
      ])
    )
  })

  it('es su página: «Plantilla» junto al título, «Plantillas» para volver y sin lo de las páginas de un mundo', async () => {
    const { own } = await renderTemplate()
    const title = await screen.findByRole('textbox', { name: 'Título de la página' })
    expect(title.textContent).toBe('Frente')
    expect(screen.getByRole('heading', { level: 1 }).parentElement?.parentElement?.textContent).toContain('Plantilla')
    // «Plantillas» para volver, fuera de la barra (que también la lleva)
    const back = screen.getAllByRole('link', { name: 'Plantillas' }).filter((link) => !link.closest('nav'))
    expect(back.map((link) => link.getAttribute('href'))).toEqual(['/plantillas'])
    // A la izquierda, las demás (con ella marcada)
    expect(screen.getByRole('link', { name: /Frente/, current: 'page' }).getAttribute('href')).toBe(
      `/plantillas/${own.id}`
    )
    expect(screen.queryByRole('button', { name: /Quién la conoce/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Marcar/ })).toBeNull()
    expect(screen.queryByText('Mencionado en')).toBeNull()
    // El mismo esqueleto que una página del mundo: la columna, la portada detrás del título y el panel que se pliega
    expect(document.querySelector('[data-world-page] [data-page-column] [data-band]')).not.toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Plegar el panel' }))
    expect(screen.getByRole('button', { name: 'Desplegar el panel' }).getAttribute('aria-expanded')).toBe('false')
    // Se recuerda, como en el mundo: abierto otra vez para lo que sigue
    await userEvent.click(screen.getByRole('button', { name: 'Desplegar el panel' }))
  })

  it('los bloques, plegados como los campos; con sus seis puntos y Alt + flechas se recolocan', async () => {
    const { api, own, saved } = await renderTemplate()
    await api.client.call('updateTemplate', {
      templateId: own.id,
      panel: [
        { id: 'notas', type: 'text', title: 'Notas', text: '' },
        { id: 'fama', type: 'rating', title: 'Fama', value: 0, max: 5 }
      ]
    })
    const blocks = within(await (await panel()).findByRole('region', { name: 'En el panel' }))
    // Plegados: su nombre y su tipo, sin sus botones a la vista
    expect((await blocks.findByRole('button', { name: /^Notas/ })).getAttribute('aria-expanded')).toBe('false')
    expect(blocks.queryByRole('button', { name: 'Quitar el bloque' })).toBeNull()
    blocks.getByRole('button', { name: 'Opciones de Fama' }).focus()
    await userEvent.keyboard('{Alt>}{ArrowUp}{/Alt}')
    await waitFor(async () => expect((await saved()).panel.map((b) => b.id)).toEqual(['fama', 'notas']))
    expect(document.activeElement).toBe(blocks.getByRole('button', { name: 'Opciones de Fama' }))
    // Al pulsarlo, sus opciones
    await userEvent.click(blocks.getByRole('button', { name: /^Notas/ }))
    expect(blocks.getByRole('button', { name: 'Quitar el bloque' })).toBeDefined()
  })

  it('los bloques se recolocan arrastrando sus seis puntos; soltarlo en su sitio no cambia nada', async () => {
    const { api, own, saved } = await renderTemplate()
    await api.client.call('updateTemplate', {
      templateId: own.id,
      panel: [
        { id: 'notas', type: 'text', title: 'Notas', text: '' },
        { id: 'fama', type: 'rating', title: 'Fama', value: 0, max: 5 },
        { id: 'oro', type: 'text', title: 'Oro', text: '' }
      ]
    })
    const blocks = within(await (await panel()).findByRole('region', { name: 'En el panel' }))
    const grip = await blocks.findByRole('button', { name: 'Opciones de Oro' })
    const rowOf = (name: string) =>
      blocks.getByRole('button', { name: `Opciones de ${name}` }).closest('li') as HTMLElement
    const transfer = { dataTransfer: { setData: () => undefined, effectAllowed: '', dropEffect: '' } }
    // Sin arrastrar nada, pasar por encima no marca dónde caería
    fireEvent.dragOver(rowOf('Notas'), transfer)
    expect(rowOf('Notas').getAttribute('data-over')).toBeNull()
    fireEvent.dragStart(grip, transfer)
    expect(rowOf('Oro').getAttribute('data-dragging')).toBe('true')
    fireEvent.dragOver(rowOf('Notas'), transfer)
    expect(rowOf('Notas').getAttribute('data-over')).toBe('true')
    fireEvent.drop(rowOf('Notas'), transfer)
    await waitFor(async () => expect((await saved()).panel.map((b) => b.id)).toEqual(['oro', 'notas', 'fama']))
    expect(rowOf('Notas').getAttribute('data-over')).toBeNull()
    // Soltarlo sobre sí mismo, o soltar sin arrastrar, lo deja igual
    fireEvent.dragStart(blocks.getByRole('button', { name: 'Opciones de Fama' }), transfer)
    fireEvent.drop(rowOf('Fama'), transfer)
    fireEvent.drop(rowOf('Notas'), transfer)
    fireEvent.dragEnd(blocks.getByRole('button', { name: 'Opciones de Fama' }), transfer)
    expect((await saved()).panel.map((b) => b.id)).toEqual(['oro', 'notas', 'fama'])
  })

  it('«Duplicar», con el botón derecho en el árbol: una copia con los mismos campos (y su linaje), que se abre sin su título en edición, como una página', async () => {
    const { api, own, router } = await renderTemplate()
    await api.client.call('updateTemplate', {
      templateId: own.id,
      fields: [{ name: 'Nivel', type: 'text', value: '' }]
    })
    await screen.findByRole('textbox', { name: 'Título de la página' })
    const side = within(await screen.findByRole('complementary', { name: 'Tus plantillas' }))
    await userEvent.pointer({ keys: '[MouseRight]', target: await side.findByRole('link', { name: 'Frente' }) })
    const menu = within(await screen.findByRole('menu', { name: 'Opciones de «Frente»' }))
    await userEvent.click(menu.getByRole('menuitem', { name: 'Duplicar' }))
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Título de la página' }).textContent).toBe('Frente (copia)')
    )
    expect(document.activeElement).not.toBe(screen.getByRole('textbox', { name: 'Título de la página' }))
    expect(router.state.location.search).not.toHaveProperty('nuevo')
    const { templates } = await api.client.call('listTemplates', {})
    const copy = templates.find((t) => t.name === 'Frente (copia)')
    const original = templates.find((t) => t.id === own.id)
    expect(copy).toMatchObject({ basedOn: own.id, line: [copy?.id, own.id] })
    expect(copy?.fields.map((f) => f.field)).toEqual(original?.fields.map((f) => f.field))
  })

  it('su nombre se cambia en su título, como el de una página; un emoji delante pasa a ser su icono', async () => {
    const { saved } = await renderTemplate()
    const title = await screen.findByRole('textbox', { name: 'Título de la página' })
    await userEvent.click(title)
    await userEvent.keyboard('{Control>}a{/Control}🗡️ Frentes{Enter}')
    await waitFor(async () => expect(await saved()).toMatchObject({ name: 'Frentes', icon: '🗡️' }))
  })

  it('su icono se elige en su título: «:» y su nombre proponen los de la app; Intro pone el elegido', async () => {
    const { saved } = await renderTemplate()
    const title = await screen.findByRole('textbox', { name: 'Título de la página' })
    await userEvent.click(title)
    await userEvent.keyboard('{Home}:castil')
    const options = within(await screen.findByRole('listbox', { name: 'Iconos' }))
    expect(options.getAllByRole('option')[0]?.textContent).toBe('Castillo')
    expect(title.getAttribute('aria-activedescendant')).toBe(options.getAllByRole('option')[0]?.id)
    await userEvent.keyboard('{Enter}')
    await waitFor(async () => expect(await saved()).toMatchObject({ name: 'Frente', icon: 'gi:castle' }))
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(title.textContent).toBe('Frente')
    // Pulsar el icono abre los de la app (sin emojis por defecto) y quitarlo
    await userEvent.click(await screen.findByRole('button', { name: 'Icono Castillo: cambiarlo' }))
    expect(screen.getByRole('searchbox', { name: 'Buscar un icono' })).toBeDefined()
    expect(screen.queryByText('Emoji')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Quitar el icono' }))
    await waitFor(async () => expect((await saved()).icon).toBeNull())
  })

  it('su cabecera, sin «⋯» ni candado: «Versiones» en un botón de icono, que abre su lista (y Ctrl+P no imprime)', async () => {
    await renderTemplate()
    await screen.findByRole('textbox', { name: 'Título de la página' })
    expect(screen.queryByRole('button', { name: 'Más acciones' })).toBeNull()
    // Una plantilla no se bloquea (Enrique, 2026-11-19: «el block en las plantillas no tiene sentido»)
    expect(screen.queryByRole('button', { name: 'Poner en lectura' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Exportar/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Ajustes/ })).toBeNull()
    const versions = screen.getByRole('button', { name: 'Versiones' })
    expect(versions.getAttribute('title')).toBe('Versiones')
    expect(versions.closest('[data-page-actions]')).not.toBeNull()
    await userEvent.click(versions)
    expect(await screen.findByRole('heading', { name: 'Versiones' })).toBeDefined()
    expect(await screen.findByText(/Aún no tiene versiones/)).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Duplicar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Imprimir o descargar…' })).toBeNull()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Versiones' })).toBeNull())
    await userEvent.keyboard('{Control>}p{/Control}')
    expect(screen.queryByRole('dialog', { name: 'Imprimir o descargar' })).toBeNull()
  })

  it('el árbol de la izquierda: carpetas que se pliegan, una carpeta nueva y, con el botón derecho, borrar una plantilla', async () => {
    const { api, own } = await renderTemplate()
    const gente = await api.client.call('createTemplateFolder', { name: 'Gente' })
    const pnj = await api.client.call('createTemplate', { name: 'Noble', folderId: gente.id })
    const side = within(await screen.findByRole('complementary', { name: 'Tus plantillas' }))
    const folder = await side.findByRole('button', { name: 'Gente' })
    expect(folder.getAttribute('aria-expanded')).toBe('true')
    expect(side.getByRole('link', { name: 'Noble' })).toBeDefined()
    await userEvent.click(folder)
    expect(side.queryByRole('link', { name: 'Noble' })).toBeNull()
    // Una carpeta nueva, desde la cabecera
    await userEvent.click(side.getByRole('button', { name: 'Nueva carpeta' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Nueva carpeta' }))
    await userEvent.type(dialog.getByLabelText('Nombre'), 'Lugares{Enter}')
    expect(await side.findByRole('button', { name: 'Lugares' })).toBeDefined()
    // Botón derecho en una carpeta: una plantilla nueva dentro
    await userEvent.pointer({ keys: '[MouseRight]', target: side.getByRole('button', { name: 'Lugares' }) })
    const folderMenu = within(await screen.findByRole('menu', { name: 'Opciones de «Lugares»' }))
    await userEvent.click(folderMenu.getByRole('menuitem', { name: 'Plantilla nueva aquí' }))
    const created = within(await screen.findByRole('dialog', { name: 'Plantilla nueva' }))
    await userEvent.click(created.getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Plantilla nueva' })).toBeNull())
    // Botón derecho en una plantilla: borrarla (con su aviso)
    await userEvent.pointer({ keys: '[MouseRight]', target: side.getByRole('link', { name: 'Frente' }) })
    const menu = within(await screen.findByRole('menu', { name: 'Opciones de «Frente»' }))
    await userEvent.click(menu.getByRole('menuitem', { name: 'Borrar' }))
    await userEvent.click(menu.getByRole('menuitem', { name: 'Borrar la plantilla' }))
    await waitFor(async () =>
      expect((await api.client.call('listTemplates', {})).templates.map((t) => t.id)).not.toContain(own.id)
    )
    expect((await api.client.call('listTemplates', {})).templates.map((t) => t.id)).toContain(pnj.id)
  })
})

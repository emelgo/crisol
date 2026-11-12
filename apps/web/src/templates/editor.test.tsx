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
  return { api, own, saved }
}

const panel = async () => within(await screen.findByRole('complementary', { name: 'Panel de la página' }))

describe('editar una plantilla', () => {
  beforeEach(() =>
    localStorage.setItem('crisol.recorridos.enrique@crisol.test', JSON.stringify({ seen: ['plantillas', 'plantilla'] }))
  )

  it('sus campos: uno de opciones con su lista y un reloj de 8; todo se guarda solo', async () => {
    const { saved } = await renderTemplate()
    const fields = within((await panel()).getByRole('region', { name: 'Campos' }))
    await userEvent.click(fields.getByRole('button', { name: 'Campo' }))
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
    await userEvent.click(fields.getByRole('button', { name: 'Campo' }))
    await userEvent.selectOptions(fields.getAllByLabelText('Tipo').at(-1) as HTMLElement, 'Reloj')
    const segments = fields.getByLabelText('Segmentos')
    await userEvent.clear(segments)
    await userEvent.type(segments, '8{Enter}')
    await waitFor(async () => expect((await saved()).fields[1]).toMatchObject({ type: 'clock', segments: 8 }))
    expect(fields.getByRole('button', { name: /Reloj de 8/ })).toBeDefined()
  })

  it('su panel: una tabla de páginas con sus desplegables, con título', async () => {
    const { saved } = await renderTemplate()
    const blocks = within((await panel()).getByRole('region', { name: 'En el panel' }))
    await userEvent.click(blocks.getByRole('button', { name: 'Añadir bloque' }))
    await userEvent.click(blocks.getByRole('button', { name: 'Tabla de páginas' }))
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
    const blocks = within((await panel()).getByRole('region', { name: 'En el panel' }))
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
    const blocks = within((await panel()).getByRole('region', { name: 'En el panel' }))
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

  it('«⋯» → «Duplicar»: una copia con los mismos campos (y su linaje), que se abre', async () => {
    const { api, own } = await renderTemplate()
    await api.client.call('updateTemplate', {
      templateId: own.id,
      fields: [{ name: 'Nivel', type: 'text', value: '' }]
    })
    await screen.findByRole('textbox', { name: 'Título de la página' })
    await userEvent.click(screen.getByRole('button', { name: 'Más acciones' }))
    await userEvent.click(screen.getByRole('button', { name: 'Duplicar' }))
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Título de la página' }).textContent).toBe('Frente (copia)')
    )
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

  it('«⋯» → «Ajustes de la plantilla»: el menú se cierra y queda el cuadro', async () => {
    await renderTemplate()
    await screen.findByRole('textbox', { name: 'Título de la página' })
    await userEvent.click(screen.getByRole('button', { name: 'Más acciones' }))
    await userEvent.click(screen.getByRole('button', { name: 'Ajustes de la plantilla' }))
    expect(await screen.findByRole('dialog', { name: 'Ajustes de Frente' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Duplicar' })).toBeNull()
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

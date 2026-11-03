import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
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

const panel = async () => within(await screen.findByRole('complementary', { name: 'Campos y panel de la plantilla' }))

describe('editar una plantilla', () => {
  beforeEach(() =>
    localStorage.setItem('crisol.recorridos.enrique@crisol.test', JSON.stringify({ seen: ['plantillas'] }))
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
    expect(screen.getByText('Guardado')).toBeDefined()
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

  it('su nombre se cambia en el sitio, como el título de una página', async () => {
    const { saved } = await renderTemplate()
    const title = await screen.findByLabelText('Nombre', { selector: 'input' })
    await userEvent.clear(title)
    await userEvent.type(title, 'Frentes{Enter}')
    await waitFor(async () => expect((await saved()).name).toBe('Frentes'))
  })

  it('una de serie se ve igual pero no se cambia, y se copia', async () => {
    await renderTemplate('pnj')
    expect(await screen.findByRole('heading', { level: 1, name: 'PNJ' })).toBeDefined()
    const fields = within((await panel()).getByRole('region', { name: 'Campos' }))
    expect(fields.queryByRole('button', { name: 'Campo' })).toBeNull()
    await userEvent.click(fields.getByRole('button', { name: /Facción/ }))
    // Todo su grupo va desactivado
    expect((fields.getByLabelText('Nombre').closest('fieldset') as HTMLFieldSetElement).disabled).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: 'Copiar' }))
    expect(screen.getByRole('dialog', { name: 'Plantilla nueva' })).toBeDefined()
  })
})

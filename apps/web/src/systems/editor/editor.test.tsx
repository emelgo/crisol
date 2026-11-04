import type { World } from '@crisol/contracts'
import { fronteras } from '@crisol/systems/fixtures'
import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../../account/fake.ts'
import { fakeApi } from '../../api/fake.ts'
import { App } from '../../app.tsx'
import { createAppRouter } from '../../router.tsx'

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

function renderEditor(systemId: string = OWN.id) {
  const api = fakeApi({ organizations: [ORG], worlds: [WORLD], systems: [OWN] })
  const router = createAppRouter(createMemoryHistory({ initialEntries: [`/sistemas/${systemId}`] }))
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
      api={api.client}
    />
  )
  return { api, router }
}

const parts = () => within(screen.getByRole('complementary', { name: 'Partes del sistema' }))
const openType = async (name: string) => {
  const aside = within(await screen.findByRole('complementary', { name: 'Partes del sistema' }))
  await userEvent.click(await aside.findByRole('button', { name: new RegExp(`^${name}`) }))
}
const openField = async (name: string) =>
  userEvent.click(screen.getByRole('button', { name: new RegExp(`^${name}`), expanded: false }))

describe('el editor de un sistema', () => {
  beforeEach(() =>
    localStorage.setItem('crisol.recorridos.enrique@crisol.test', JSON.stringify({ seen: ['sistemas', 'sistema'] }))
  )

  it('sus partes, con los campos de cada tipo; un campo se abre con su clase, su clave fija y su fórmula', async () => {
    renderEditor()
    expect(await screen.findByRole('heading', { level: 1, name: 'Fronteras' })).toBeDefined()
    expect(parts().getByRole('button', { name: /^General/ })).toBeDefined()
    expect(parts().getByRole('button', { name: /^Personaje 8/ })).toBeDefined()
    await openType('Personaje')
    expect(screen.getByText('@vigor')).toBeDefined()
    await openField('Defensa')
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Clave' }).readOnly).toBe(true)
    expect(screen.getByText('No cambia una vez guardada')).toBeDefined()
    expect(screen.getByRole<HTMLSelectElement>('combobox', { name: 'Clase' }).value).toBe('derived')
    expect(screen.getByRole<HTMLInputElement>('combobox', { name: 'Fórmula' }).value).toBe('7 + @vigor')
    expect(screen.getByText('Da un número')).toBeDefined()
  })

  it('una fórmula mal escrita se marca al escribirla, y con errores no se guarda', async () => {
    renderEditor()
    await openType('Personaje')
    await openField('Defensa')
    const formula = screen.getByRole('combobox', { name: 'Fórmula' })
    await userEvent.clear(formula)
    await userEvent.type(formula, '7 + @vigr ')
    expect(screen.getAllByText('No existe «@vigr» en Personaje. ¿Quizás «@vigor»?').length).toBeGreaterThan(0)
    expect(formula.getAttribute('aria-invalid')).toBe('true')
    expect(parts().getByRole('img', { name: 'Un problema' })).toBeDefined()
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Guardar' }).disabled).toBe(true)
    expect(screen.getByText('Con errores no se guarda: arréglalos antes')).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('button', { name: 'Guardar' })).toBeNull()
  })

  it('@ propone los nombres que existen: se eligen con las flechas e Intro', async () => {
    renderEditor()
    await openType('Personaje')
    await openField('Carga')
    const formula = screen.getByRole('combobox', { name: 'Fórmula' })
    await userEvent.clear(formula)
    await userEvent.type(formula, '3 + @')
    const list = within(screen.getByRole('listbox', { name: 'Nombres que existen' }))
    expect(list.getAllByRole('option').map((o) => o.textContent)).toContain('@vigorVigor')
    await userEvent.type(formula, 'ast')
    expect(list.getByRole('option', { name: /@astucia/ }).getAttribute('aria-selected')).toBe('true')
    await userEvent.keyboard('{Enter}')
    expect((formula as HTMLInputElement).value).toBe('3 + @astucia')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('un campo nuevo: su clave se elige hasta guardarlo; se cambia su clase y se guarda con la versión', async () => {
    const { api } = renderEditor()
    await openType('Personaje')
    await userEvent.click(screen.getByRole('button', { name: 'Campo nuevo' }))
    const key = screen.getByRole<HTMLInputElement>('textbox', { name: 'Clave' })
    expect(key.value).toBe('campo_nuevo')
    expect(key.readOnly).toBe(false)
    const name = screen.getByRole('textbox', { name: 'Nombre' })
    await userEvent.clear(name)
    await userEvent.type(name, 'Suerte')
    await userEvent.clear(key)
    await userEvent.type(key, 'suerte')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Clase' }), 'derived')
    const formula = screen.getByRole('combobox', { name: 'Fórmula' })
    await userEvent.clear(formula)
    await userEvent.type(formula, '@presencia + 1')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(async () => {
      const system = await api.client.call('getSystem', { systemId: OWN.id })
      expect(system.version).toBe(2)
      expect(
        (system.document.types as Record<string, { fields: Record<string, unknown> }>).personaje?.fields.suerte
      ).toEqual({
        kind: 'derived',
        label: 'Suerte',
        formula: '@presencia + 1'
      })
    })
    expect(await screen.findByText('Guardado')).toBeDefined()
  })

  it('quitar un campo avisa de dónde se usa', async () => {
    renderEditor()
    await openType('Personaje')
    await openField('Vigor')
    expect(screen.getByText('Lo usa: Defensa, Carga')).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Quitar el campo' }))
    // Sin Vigor, sus fórmulas fallan
    expect(parts().getByRole('img', { name: '2 problemas' })).toBeDefined()
  })

  it('General: su nombre, su versión y sus idiomas', async () => {
    renderEditor()
    await screen.findByRole('complementary', { name: 'Partes del sistema' })
    await userEvent.click(await parts().findByRole('button', { name: /^General/ }))
    const name = screen.getByRole('textbox', { name: 'Nombre' })
    await userEvent.clear(name)
    await userEvent.type(name, 'Fronteras del norte')
    expect(screen.getByRole('heading', { level: 1, name: 'Fronteras del norte' })).toBeDefined()
    await userEvent.click(screen.getByRole('checkbox', { name: 'English' }))
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDefined()
  })

  it('si otro lo cambió mientras tanto, no se pisa: lo dice', async () => {
    const { api } = renderEditor()
    await openType('Personaje')
    await api.client.call('updateSystem', { systemId: OWN.id, version: 1, name: 'Otro nombre' })
    await openField('Vigor')
    await userEvent.type(screen.getByRole('textbox', { name: 'Ayuda' }), '!')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('Lo ha cambiado alguien mientras tanto: vuelve a abrirlo')).toBeDefined()
  })

  it('uno de serie se abre para leer, con «Copiar para cambiarlo»', async () => {
    const { router } = renderEditor('blank')
    expect(await screen.findByText('De serie: no se cambia.')).toBeDefined()
    await userEvent.click(parts().getByRole('button', { name: /^General/ }))
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Nombre' }).closest('fieldset')?.disabled).toBe(true)
    expect(parts().queryByRole('button', { name: 'Tipo nuevo' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Copiar para cambiarlo' }))
    await waitFor(() => expect(router.state.location.pathname).not.toBe('/sistemas/blank'))
    expect(await screen.findByRole('heading', { level: 1, name: 'En blanco (copia)' })).toBeDefined()
  })

  it('«Probar» al lado: los valores cambian lo calculado, con su desglose; un objeto equipado suma', async () => {
    renderEditor()
    const panel = within(await screen.findByRole('complementary', { name: 'Probar' }))
    const vigor = panel.getByRole('spinbutton', { name: 'Vigor' })
    await userEvent.clear(vigor)
    await userEvent.type(vigor, '2')
    const defensa = within(panel.getByRole('list', { name: 'De dónde sale Defensa' }))
    expect(defensa.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['7Base', '+2Vigor'])
    await userEvent.click(panel.getByRole('button', { name: 'Añadir Objeto' }))
    await userEvent.click(panel.getByRole('checkbox', { name: 'Equipado' }))
    const bonus = panel.getAllByRole('spinbutton', { name: 'Defensa' })[0] as HTMLElement
    await userEvent.clear(bonus)
    await userEvent.type(bonus, '1')
    expect(
      within(panel.getByRole('list', { name: 'De dónde sale Defensa' })).getByText('Objeto de prueba')
    ).toBeDefined()
  })

  it('«Probar» tira las tiradas del tipo sin apuntarlas, con su franja', async () => {
    const { api } = renderEditor()
    const panel = within(await screen.findByRole('complementary', { name: 'Probar' }))
    await userEvent.selectOptions(panel.getByRole('combobox', { name: 'Por qué se tira Atributo' }), 'astucia')
    await userEvent.click(panel.getByRole('button', { name: 'Tirar Atributo' }))
    expect(await panel.findByText('De prueba: no se apunta en ninguna campaña')).toBeDefined()
    expect(panel.getByText(/^(Éxito total|Éxito con coste|Fallo)$/)).toBeDefined()
    expect(api.calls).toContain('tryDice')
    expect(api.calls).not.toContain('rollDice')
  })
})

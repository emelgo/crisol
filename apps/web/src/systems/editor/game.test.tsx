import type { World } from '@crisol/contracts'
import { type System, toFile } from '@crisol/systems'
import { fronteras } from '@crisol/systems/fixtures'
import { createMemoryHistory } from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

function renderEditor() {
  const own = { ...structuredClone(fronteras), id: crypto.randomUUID() }
  const api = fakeApi({ organizations: [ORG], worlds: [WORLD], systems: [own] })
  const router = createAppRouter(createMemoryHistory({ initialEntries: [`/sistemas/${own.id}`] }))
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
      api={api.client}
    />
  )
  const saved = async () =>
    (await api.client.call('getSystem', { systemId: own.id })) as { version: number; document: unknown }
  return {
    api,
    own,
    saved: async () => (await saved()).document as System,
    version: async () => (await saved()).version
  }
}

const openPart = async (name: string) => {
  const aside = within(await screen.findByRole('complementary', { name: 'Partes del sistema' }))
  await userEvent.click(await aside.findByRole('button', { name: new RegExp(`^${name}`) }))
}
const parts = () => within(screen.getByRole('complementary', { name: 'Partes del sistema' }))
const save = async () => userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

describe('el editor de un sistema: lo de juego', () => {
  beforeEach(() =>
    localStorage.setItem('crisol.recorridos.enrique@crisol.test', JSON.stringify({ seen: ['sistemas'] }))
  )

  it('Tiradas: la fórmula con @este, por cada campo, las franjas con @total y los modos; se guarda', async () => {
    const { saved } = renderEditor()
    await openPart('Tiradas')
    expect(screen.getByRole('button', { name: 'Atributo', pressed: true })).toBeDefined()
    expect(screen.getByRole<HTMLInputElement>('combobox', { name: 'Fórmula' }).value).toBe('2d6 + @este')
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Clave' }).readOnly).toBe(true)
    // Por cada uno: quitar Presencia
    const forEach = within(screen.getByRole('group', { name: 'Una por cada uno de' }))
    expect(forEach.getByRole<HTMLInputElement>('checkbox', { name: /^Vigor/ }).checked).toBe(true)
    await userEvent.click(forEach.getByRole('checkbox', { name: /^Presencia/ }))
    // Una franja mal escrita se marca, con @total como nombre que existe
    const first = screen.getByRole('combobox', { name: 'Si (franja 1)' })
    await userEvent.clear(first)
    await userEvent.type(first, '@totl >= 10 ')
    expect(screen.getAllByText('No existe «@totl» en Personaje. ¿Quizás «@total»?').length).toBeGreaterThan(0)
    expect(parts().getByRole('img', { name: 'Un problema' })).toBeDefined()
    await userEvent.clear(first)
    await userEvent.type(first, '@total >= 11')
    // Una franja más, y el modo dicho en español
    await userEvent.click(screen.getByRole('button', { name: 'Franja nueva' }))
    expect(screen.getByRole<HTMLSelectElement>('combobox', { name: 'Es (franja 4)' }).value).toBe('neutral')
    expect(screen.getByText('2d6 → 3d6, se quedan los 2 mayores')).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Quitar el modo Con desventaja' }))
    await save()
    await waitFor(async () => {
      const roll = (await saved()).rolls?.atributo
      expect(roll?.for).toEqual({ fields: ['vigor', 'astucia'] })
      expect(roll?.bands?.map((b) => b.if)).toEqual(['@total >= 11', '@total >= 7', 'true', 'true'])
      expect(roll?.modes?.map((m) => m.key)).toEqual(['ventaja'])
    })
  })

  it('una tirada nueva: su clave se elige hasta guardarla; se quita', async () => {
    const { saved } = renderEditor()
    await openPart('Tiradas')
    await userEvent.click(screen.getByRole('button', { name: 'Tirada nueva' }))
    expect(screen.getByRole('button', { name: 'Tirada nueva', pressed: true })).toBeDefined()
    const key = screen.getByRole<HTMLInputElement>('textbox', { name: 'Clave' })
    expect(key.readOnly).toBe(false)
    await userEvent.clear(key)
    await userEvent.type(key, 'dano')
    const name = screen.getByRole('textbox', { name: 'Nombre' })
    await userEvent.clear(name)
    await userEvent.type(name, 'Daño')
    expect(screen.getByRole<HTMLInputElement>('combobox', { name: 'Fórmula' }).value).toBe('2d6')
    await save()
    await waitFor(async () => expect((await saved()).rolls?.dano).toEqual({ label: 'Daño', formula: '2d6' }))
    await screen.findByText('Guardado')
    await userEvent.click(screen.getByRole('button', { name: 'Daño' }))
    await userEvent.click(screen.getByRole('button', { name: 'Quitar la tirada' }))
    expect(screen.queryByRole('button', { name: 'Daño' })).toBeNull()
  })

  it('Dados: la tirada por defecto va sin @, y los críticos', async () => {
    const { saved } = renderEditor()
    await openPart('Dados')
    const fallback = screen.getByRole('textbox', { name: 'Tirada por defecto' })
    await userEvent.clear(fallback)
    await userEvent.type(fallback, '2d6 + @vigor')
    expect(screen.getByText('La tirada por defecto va sin @: solo dados')).toBeDefined()
    expect(parts().getByRole('img', { name: 'Un problema' })).toBeDefined()
    await userEvent.clear(fallback)
    await userEvent.type(fallback, '2d10')
    expect(screen.getByRole<HTMLInputElement>('radio', { name: /^Ninguno/ }).checked).toBe(true)
    await userEvent.click(screen.getByRole('radio', { name: /^Dobles/ }))
    await save()
    await waitFor(async () => expect((await saved()).dice).toEqual({ critical: 'doubles', default: '2d10' }))
  })

  it('Fuentes: una nueva con su licencia y su atribución', async () => {
    const { saved } = renderEditor()
    await openPart('Fuentes')
    await userEvent.click(screen.getByRole('button', { name: 'Fuente nueva' }))
    const name = screen.getByRole('textbox', { name: 'Nombre' })
    await userEvent.clear(name)
    await userEvent.type(name, 'Reglas propias')
    // Sin atribución, no vale
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Guardar' }).disabled).toBe(true)
    await userEvent.type(screen.getByRole('textbox', { name: 'Atribución' }), 'Hecho por Enrique')
    await save()
    await waitFor(async () =>
      expect((await saved()).sources).toEqual([
        { key: 'fuente_nueva', name: 'Reglas propias', license: 'CC BY 4.0', attribution: 'Hecho por Enrique' }
      ])
    )
  })

  it('Ajustes de campaña: los guardados con su clave fija; uno nuevo de una opción, con su valor inicial', async () => {
    const { saved } = renderEditor()
    await openPart('Ajustes de campaña')
    const keys = screen.getAllByRole<HTMLInputElement>('textbox', { name: 'Clave' })
    expect(keys[0]?.value).toBe('avance')
    expect(keys[0]?.readOnly).toBe(true)
    expect(screen.getByRole<HTMLInputElement>('spinbutton', { name: 'Valor inicial' }).value).toBe('8')
    await userEvent.click(screen.getByRole('button', { name: 'Ajuste nuevo' }))
    const kinds = screen.getAllByRole('combobox', { name: 'Clase' })
    await userEvent.selectOptions(kinds[1] as HTMLElement, 'choice')
    const options = screen.getByRole('textbox', { name: 'Opciones' })
    await userEvent.clear(options)
    await userEvent.type(options, 'Dura{Enter}Blanda')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Valor inicial' }), 'blanda')
    await save()
    await waitFor(async () =>
      expect((await saved()).settings?.ajuste_nuevo).toEqual({
        label: 'Ajuste nuevo',
        kind: 'choice',
        options: [
          { value: 'dura', label: 'Dura' },
          { value: 'blanda', label: 'Blanda' }
        ],
        default: 'blanda'
      })
    )
  })

  it('Avanzado: lo que se escribe en el JSON se comprueba, se marca y la lista lleva a su línea', async () => {
    renderEditor()
    await openPart('Avanzado')
    const code = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'El sistema en JSON' })
    expect(code.value).toContain('"name": "Fronteras"')
    fireEvent.change(code, { target: { value: code.value.replace('7 + @vigor', '7 + @vigr') } })
    const list = within(screen.getByRole('complementary', { name: 'Problemas' }))
    const problem = list.getByRole('button', { name: /^Personaje › Defensa › Fórmula/ })
    // Pasa al resto del editor: el tipo dice que tiene un problema
    expect(parts().getByRole('img', { name: 'Un problema' })).toBeDefined()
    await userEvent.click(problem)
    const line = code.value.slice(0, code.selectionStart).split('\n').length
    expect(code.value.split('\n')[line - 1]).toContain('"formula": "7 + @vigr"')
    expect(document.activeElement).toBe(code)
  })

  it('Avanzado: un JSON roto no se guarda ni pasa al editor; Cancelar lo deja como estaba', async () => {
    renderEditor()
    await openPart('Avanzado')
    const code = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'El sistema en JSON' })
    const before = code.value
    fireEvent.change(code, { target: { value: before.replace('"name": "Fronteras",', '"name": "Fronteras"') } })
    expect(code.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText(/^No se entiende el JSON en la línea \d+/)).toBeDefined()
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Guardar' }).disabled).toBe(true)
    expect(screen.getByText('El JSON de Avanzado tiene errores: arréglalos antes')).toBeDefined()
    // Con la forma de otra cosa (una lista donde van los campos), tampoco
    fireEvent.change(code, {
      target: {
        value: JSON.stringify({
          ...structuredClone(fronteras),
          types: { personaje: { document: 'actor', label: 'P', fields: [] } }
        })
      }
    })
    expect(screen.getByText('No tiene la forma de un sistema: hasta arreglarlo, no se guarda')).toBeDefined()
    expect(within(screen.getByRole('complementary', { name: 'Problemas' })).getByText('P › Campos')).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(code.value).toBe(before)
    expect(screen.queryByRole('button', { name: 'Guardar' })).toBeNull()
  })

  it('Avanzado: subir un archivo con errores no cambia nada; uno bueno reemplaza el sistema', async () => {
    const { api, version, saved } = renderEditor()
    await openPart('Avanzado')
    const input = document.querySelector<HTMLInputElement>('input[type="file"]') as HTMLInputElement
    const broken = structuredClone(fronteras)
    ;(broken.types.personaje?.fields.defensa as { formula: string }).formula = '7 + @vigr'
    const file = (system: System, name: string) =>
      new File([JSON.stringify(toFile(system, []))], name, { type: 'application/json' })
    await userEvent.upload(input, file(broken, 'fronteras-v8.json'))
    const dialog = within(await screen.findByRole('alertdialog', { name: 'No se ha subido' }))
    expect(dialog.getByText('fronteras-v8.json')).toBeDefined()
    expect(
      dialog.getByText('El archivo tiene un problema. Fronteras sigue como estaba: arréglalo y vuelve a subirlo.')
    ).toBeDefined()
    expect(dialog.getByText('No existe «@vigr» en Personaje. ¿Quizás «@vigor»?')).toBeDefined()
    expect(api.calls).not.toContain('importSystem')
    await userEvent.click(dialog.getByRole('button', { name: 'Cerrar' }))
    expect(await version()).toBe(1)

    const better = { ...structuredClone(fronteras), name: 'Fronteras del norte' }
    await userEvent.upload(input, file(better, 'fronteras-v9.json'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Fronteras del norte' })).toBeDefined()
    expect(await version()).toBe(2)
    expect((await saved()).name).toBe('Fronteras del norte')
  })

  it('Avanzado: con cambios sin guardar, no se sube nada; uno de serie solo se baja', async () => {
    renderEditor()
    await openPart('General')
    await userEvent.type(screen.getByRole('textbox', { name: 'Nombre' }), '!')
    await openPart('Avanzado')
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Subir un archivo' }).disabled).toBe(true)
    expect(screen.getByText('Guarda o cancela los cambios antes de subir un archivo.')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Bajar' })).toBeDefined()
  })
})

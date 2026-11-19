import type { World } from '@crisol/contracts'
import type { System } from '@crisol/systems'
import { fronteras } from '@crisol/systems/fixtures'
import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'
import { isEmptyOutline, rulesOutline } from './rules-outline.ts'

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
const WORDS = { thisOne: 'su valor', yes: 'Sí', no: 'No' }

function renderRules({ system = fronteras, path = 'reglas', editable = true } = {}) {
  const own = { ...structuredClone(system), id: crypto.randomUUID() }
  const api = fakeApi({ organizations: [ORG], worlds: [WORLD], systems: [own] })
  // Quien no puede cambiarlo: sus libros lo dicen
  const client = editable
    ? api.client
    : {
        ...api.client,
        call: (async (name, input) => {
          const out = await api.client.call(name, input)
          return name === 'getSystemBooks' ? { ...out, editable: false } : out
        }) as typeof api.client.call
      }
  const router = createAppRouter(createMemoryHistory({ initialEntries: [`/sistemas/${own.id}/${path}`] }))
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
      api={client}
    />
  )
  return { api, router, id: own.id }
}

describe('las reglas de un sistema, para leerlas (como un calendario)', () => {
  beforeEach(() => {
    localStorage.setItem('crisol.recorridos.enrique@crisol.test', JSON.stringify({ seen: ['sistema', 'reglas'] }))
  })

  it('se leen por partes, con el índice a la izquierda y las fórmulas en palabras', async () => {
    renderRules()
    expect(await screen.findByRole('heading', { level: 1, name: 'Reglas' })).toBeDefined()
    const index = within(screen.getByRole('navigation', { name: 'Partes de las reglas' }))
    expect(index.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Personaje',
      'Tiradas1',
      'Lo que se lleva2',
      'Crear un personaje3',
      'Ajustes de campaña1'
    ])
    const character = within(screen.getByRole('region', { name: 'Personaje' }))
    expect(character.getByText('7 + Vigor')).toBeDefined()
    expect(character.getByText('Máximo: 6')).toBeDefined()
    const rolls = within(screen.getByRole('region', { name: 'Tiradas' }))
    expect(rolls.getByRole('heading', { level: 3, name: 'Atributo' })).toBeDefined()
    expect(rolls.getByText('2d6 + su valor')).toBeDefined()
    expect(rolls.getByText('Una por cada: Vigor, Astucia, Presencia')).toBeDefined()
    expect(within(rolls.getByRole('list', { name: 'Lo que sale' })).getByText('Éxito con coste')).toBeDefined()
    expect(within(screen.getByRole('region', { name: 'Crear un personaje' })).getByText('Movimientos')).toBeDefined()
    await userEvent.click(index.getByRole('button', { name: /Tiradas/ }))
    await waitFor(() => expect(document.activeElement?.textContent).toBe('Tiradas'))
  })

  it('«Editar reglas» lleva a su editor por pasos y «Ver reglas» vuelve', async () => {
    const { router, id } = renderRules()
    await userEvent.click(await screen.findByRole('link', { name: 'Editar reglas' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/sistemas/${id}/reglas/editar`))
    expect(await screen.findByRole('heading', { level: 2, name: '¿Qué tiene un personaje?' })).toBeDefined()
    await userEvent.click(screen.getByRole('link', { name: 'Ver reglas' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/sistemas/${id}/reglas`))
    expect(await screen.findByRole('region', { name: 'Tiradas' })).toBeDefined()
  })

  it('quien no puede cambiarlo lo lee sin el botón, y su editor le devuelve a la vista', async () => {
    const { router, id } = renderRules({ editable: false, path: 'reglas/editar' })
    await waitFor(() => expect(router.state.location.pathname).toBe(`/sistemas/${id}/reglas`))
    expect(await screen.findByRole('region', { name: 'Tiradas' })).toBeDefined()
    expect(screen.queryByRole('link', { name: 'Editar reglas' })).toBeNull()
  })

  it('sin nada aún, una línea que lleva a «Editar reglas»', async () => {
    const blank: System = { ...structuredClone(fronteras), types: {}, rolls: {}, creation: [], settings: {} }
    renderRules({ system: blank })
    expect(await screen.findByText('Aún no hay reglas: empieza con «Editar reglas».')).toBeDefined()
    expect(screen.queryByRole('navigation', { name: 'Partes de las reglas' })).toBeNull()
  })
})

describe('rulesOutline', () => {
  // Un juego pequeño con lo que tiene uno grande: un conjunto con lo que se calcula, habilidades de una característica,
  // un recurso que se recupera, una tirada por elemento con ventaja y un ajuste con el de entrada
  const game: System = {
    ...structuredClone(fronteras),
    types: {
      pj: {
        document: 'actor',
        label: 'Personaje',
        fields: {
          car: {
            kind: 'set',
            label: 'Características',
            elements: [
              { key: 'fue', label: 'Fuerza', abbr: 'FUE' },
              { key: 'des', label: 'Destreza', abbr: 'DES' }
            ],
            fields: {
              puntuacion: { kind: 'number', label: 'Puntuación', default: 10 },
              mod: { kind: 'derived', label: 'Modificador', formula: 'floor((@este.puntuacion - 10) / 2)' }
            }
          },
          hab: {
            kind: 'set',
            label: 'Habilidades',
            elements: [{ key: 'sigilo', label: 'Sigilo', values: { de: 'des' } }],
            fields: { de: { kind: 'choice', label: 'Característica', options: [{ value: 'des', label: 'Destreza' }] } }
          },
          pacto: { kind: 'resource', label: 'Magia de pacto', max: 2, recovery: 'short' }
        }
      },
      criatura: { document: 'actor', label: 'Criatura', fields: {} }
    },
    rolls: {
      prueba: {
        label: 'Prueba',
        formula: '1d20 + @este.mod',
        for: { set: 'car' },
        target: 'optional',
        bands: [{ if: '@objetivo != null && @total >= @objetivo', label: 'Éxito', tone: 'success' }],
        modes: [{ key: 'ventaja', label: 'Ventaja', from: '1d20', to: '2d20kh1' }]
      }
    },
    initiative: 'prueba',
    dice: { default: '1d20', critical: 'd20' },
    creation: [],
    settings: {
      reglas: {
        label: 'Reglas',
        kind: 'choice',
        options: [
          { value: 'nuevas', label: '2024' },
          { value: 'viejas', label: '2014' }
        ],
        default: 'nuevas'
      }
    }
  }

  it('sus conjuntos con lo que se calcula, sus tiradas por elemento y sus ajustes con el de entrada', () => {
    const outline = rulesOutline(game, 'es', WORDS)
    const abilities = outline.character?.sets.find((s) => s.key === 'car')
    expect(abilities?.elements[0]).toEqual({ key: 'fue', label: 'Fuerza', abbr: 'FUE', note: '' })
    expect(abilities?.derived).toEqual([
      { key: 'mod', label: 'Modificador', formula: '(Puntuación − 10) ÷ 2 (hacia abajo)' }
    ])
    expect(abilities?.noted).toEqual(['Puntuación'])
    // Una habilidad dice de qué característica es
    expect(outline.character?.sets.find((s) => s.key === 'hab')?.elements[0]?.note).toBe('Destreza')
    expect(outline.character?.resources).toEqual([
      { key: 'pacto', label: 'Magia de pacto', max: '2', recovery: 'short' }
    ])
    const check = outline.rolls[0]
    expect(check?.formula).toBe('1d20 + Modificador')
    expect(check?.each).toBe('Características')
    expect(check?.bands[0]?.when).toBe('con Objetivo y Total ≥ Objetivo')
    expect(check?.modes.map((m) => m.change)).toEqual(['1d20 → 2d20kh1'])
    expect(outline.dice).toEqual({ default: '1d20', critical: 'd20', initiative: 'Prueba' })
    expect(outline.settings[0]?.options).toEqual([
      { label: '2024', chosen: true },
      { label: '2014', chosen: false }
    ])
    expect(outline.actors.map((a) => a.label)).toEqual(['Criatura'])
    expect(isEmptyOutline(outline)).toBe(false)
  })
})

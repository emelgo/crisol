import type { World } from '@crisol/contracts'
import { fronteras } from '@crisol/systems/fixtures'
import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../../account/fake.ts'
import { fakeApi } from '../../api/fake.ts'
import { App } from '../../app.tsx'
import { createAppRouter } from '../../router.tsx'
import { summaryOf } from './kinds.ts'
import { anchorOf, stepOf } from './rules-editor.tsx'

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

function renderEditor() {
  const api = fakeApi({ organizations: [ORG], worlds: [WORLD], systems: [OWN] })
  const router = createAppRouter(createMemoryHistory({ initialEntries: [`/sistemas/${OWN.id}/reglas/editar`] }))
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
      api={api.client}
    />
  )
  return { api, router }
}

describe('el editor de un sistema, a mano (tanda 8)', () => {
  it('cada aviso va a su paso por su ruta', () => {
    const type = Object.entries(fronteras.types).find(([, t]) => t.document === 'actor')?.[0] ?? ''
    expect(stepOf(`types.${type}.fields.vigor.label`, fronteras)).toBe('personaje')
    expect(stepOf('rolls.ataque.formula', fronteras)).toBe('tiradas')
    expect(stepOf('dice.critical', fronteras)).toBe('tiradas')
    expect(stepOf('sheet.blocks.0', fronteras)).toBe('ficha')
    expect(stepOf('creation.1.type', fronteras)).toBe('creacion')
    expect(stepOf('sources.0.key', fronteras)).toBe('compendio')
    expect(stepOf('types.arma.fields.dano', fronteras)).toBe('objetos')
    expect(stepOf('version', fronteras)).toBe('avanzado')
  })

  it('un aviso de un campo de objeto lleva a su fila dentro de su tipo; lo que se calcula se resume en palabras', () => {
    expect(anchorOf('types.arma.fields.dano.formula')).toEqual({ row: 'campo-arma-dano', parent: 'tipo-arma' })
    expect(anchorOf('rolls.ataque.formula')).toEqual({ row: 'tirada-ataque' })
    expect(anchorOf('version')).toBeNull()
    const words = (key: string) => key
    const derived = { kind: 'derived' as const, label: 'Bono', formula: 'ceil(@nivel / 4) + 1' }
    expect(summaryOf(derived, 'es', words, () => 'Nivel ÷ 4 + 1')).toBe('Nivel ÷ 4 + 1')
    expect(summaryOf(derived, 'es', words)).toBe('rules.summary.calculated')
  })

  it('añadir una cifra la pone en la ficha de ejemplo y se guarda sola, con su versión', async () => {
    const { api } = renderEditor()
    expect(await screen.findByRole('heading', { level: 2, name: '¿Qué tiene un personaje?' })).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Una cifra' }))
    const example = within(screen.getByRole('region', { name: 'Ficha de ejemplo' }))
    expect(await example.findByText('Cifra nueva')).toBeDefined()
    await waitFor(() => expect(api.calls.filter((c) => c === 'updateSystem')).toHaveLength(1), { timeout: 3000 })
    expect(await screen.findByText('Guardado')).toBeDefined()
  })

  it('un error no se guarda: la revisión lo dice e «Ir a…» lleva a su paso; quitar algo deja «Deshacer»', async () => {
    const { api } = renderEditor()
    await screen.findByRole('heading', { level: 2, name: '¿Qué tiene un personaje?' })
    // Una tirada que nombra algo que no existe
    await userEvent.click(screen.getByRole('button', { name: /¿Cómo se tira\?/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Una tirada' }))
    const formula = await screen.findByLabelText(/Se tira/)
    await userEvent.clear(formula)
    await userEvent.type(formula, '1d20 + @nada')
    const review = within(screen.getByRole('region', { name: 'Revisión' }))
    expect(await review.findByText(/nada/)).toBeDefined()
    // A la vista y anunciado una vez (no en cada tecla)
    await waitFor(() => expect(screen.getAllByText(/Sin guardar/)).toHaveLength(2))
    expect(within(screen.getByRole('status')).getByText(/Sin guardar/)).toBeDefined()
    await new Promise((resolve) => setTimeout(resolve, 1200))
    expect(api.calls.includes('updateSystem')).toBe(false)
    // «Ir a…» desde el primer paso
    await userEvent.click(screen.getByRole('button', { name: /¿Qué tiene un personaje\?/ }))
    await userEvent.click(review.getAllByRole('button', { name: /Ir a Cómo se tira/ })[0] as HTMLElement)
    expect(await screen.findByRole('heading', { level: 2, name: '¿Cómo se tira?' })).toBeDefined()
    // Quitarla la arregla y deja «Deshacer», que la vuelve a poner
    await userEvent.click(screen.getByRole('button', { name: 'Quitar' }))
    expect(await screen.findByRole('button', { name: 'Deshacer' })).toBeDefined()
    expect(screen.queryByLabelText(/Se tira/)).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Deshacer' }))
    expect(await review.findByText(/nada/)).toBeDefined()
  })

  it('«Deshacer» se va con el siguiente cambio: volver atrás no se lleva lo escrito después', async () => {
    renderEditor()
    await screen.findByRole('heading', { level: 2, name: '¿Qué tiene un personaje?' })
    await userEvent.click(screen.getByRole('button', { name: 'Una cifra' }))
    const name = await screen.findByLabelText('Nombre')
    // El foco, ya en el nombre de lo nuevo
    expect(document.activeElement).toBe(name)
    await userEvent.click(screen.getByRole('button', { name: 'Quitar «Cifra nueva»' }))
    expect(await screen.findByRole('button', { name: 'Deshacer' })).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Una cifra' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Deshacer' })).toBeNull())
  })
})

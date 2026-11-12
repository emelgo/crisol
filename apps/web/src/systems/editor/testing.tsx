/** Para las pruebas del editor de sistemas: lo abre en un paso con el sistema que se quiera (Fronteras, si no) */
import type { World } from '@crisol/contracts'
import type { ContentItem, System } from '@crisol/systems'
import { fronteras } from '@crisol/systems/fixtures'
import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fakeAccountClient } from '../../account/fake.ts'
import { ApiError } from '../../api/client.ts'
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

export async function renderEditor({
  system = fronteras,
  step,
  fail,
  ready = true,
  content = [],
  before
}: {
  system?: System
  /** La pregunta del paso que se abre (sin ella, el primero) */
  step?: RegExp
  /** Las acciones que el servidor rechaza, con su código */
  fail?: Record<string, string>
  /** Sin esperar a que se abra el editor (si no llega a abrirse) */
  ready?: boolean
  /** Su contenido (lo que traen sus libros) */
  content?: ContentItem[]
  /** Lo que se hace con la API antes de abrirlo */
  before?: (api: ReturnType<typeof fakeApi>, id: string) => Promise<unknown>
} = {}) {
  const own = { ...structuredClone(system), id: crypto.randomUUID() }
  const api = fakeApi({ organizations: [ORG], worlds: [WORLD], systems: [own], systemContent: { [own.id]: content } })
  await before?.(api, own.id)
  const client = {
    ...api.client,
    call: ((name, input) => {
      const code = fail?.[name]
      if (!code) return api.client.call(name, input)
      api.calls.push(name)
      return Promise.reject(new ApiError(code, 400))
    }) as typeof api.client.call
  }
  const router = createAppRouter(createMemoryHistory({ initialEntries: [`/sistemas/${own.id}/reglas`] }))
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
      api={client}
    />
  )
  if (ready) {
    await screen.findByRole('heading', { level: 2, name: '¿Qué tiene un personaje?' })
    if (step) {
      await userEvent.click(screen.getByRole('button', { name: step }))
      await screen.findByRole('heading', { level: 2, name: step })
    }
  }
  return { api, router, id: own.id }
}

/** Lo que se envió en el último guardado */
export function lastSaved(api: ReturnType<typeof fakeApi>, id: string) {
  return api.client.call('getSystem', { systemId: id }).then((s) => s.document as unknown as System)
}

/** API en memoria para las pruebas de componentes: mundos de una organización */
import type { Organization, World } from '@crisol/contracts'
import { type ActionInput, type ActionName, type ActionOutput, type ApiClient, ApiError } from './client.ts'

export function fakeApi(options: { organizations?: Organization[]; worlds?: World[] } = {}) {
  const organizations = options.organizations ?? []
  const worlds = [...(options.worlds ?? [])]
  const calls: string[] = []

  const handlers: { [N in ActionName]: (input: ActionInput<N>) => ActionOutput<N> } = {
    listOrganizations: () => ({ organizations }),
    listWorlds: () => ({ worlds: [...worlds].sort((a, b) => a.name.localeCompare(b.name)) }),
    createWorld: ({ name }) => {
      const owned = organizations.find((o) => o.role === 'owner')
      if (!owned) throw new ApiError('ORGANIZATION_REQUIRED', 400)
      const world: World = {
        id: crypto.randomUUID(),
        organizationId: owned.id,
        name: name.trim(),
        role: 'master',
        version: 1
      }
      worlds.push(world)
      return world
    },
    renameWorld: ({ worldId, name }) => {
      const world = worlds.find((w) => w.id === worldId)
      if (!world) throw new ApiError('NOT_FOUND', 404)
      world.name = name.trim()
      world.version++
      return { ...world }
    }
  }

  const client: ApiClient = {
    async call(name, input) {
      calls.push(name)
      return handlers[name](input as never) as never
    }
  }
  return { client, calls, worlds }
}

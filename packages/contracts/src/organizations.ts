import { z } from 'zod'
import { defineAction } from './action.ts'

/** Una organización tal como la ve la cuenta que lo pide */
export const organization = z.object({
  id: z.uuid(),
  name: z.string(),
  role: z.enum(['owner', 'member'])
})

export type Organization = z.infer<typeof organization>

export const listOrganizations = defineAction({
  name: 'listOrganizations',
  kind: 'read',
  description: 'Organizaciones de la cuenta y su rol en cada una',
  input: z.object({}),
  output: z.object({ organizations: z.array(organization) })
})

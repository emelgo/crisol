import { listOrganizations } from '@crisol/contracts'
import { listMemberOrganizations } from '@crisol/db'
import { implement } from './registry.ts'

export const organizationActions = [
  implement(listOrganizations, async (ctx) => ({
    organizations: await listMemberOrganizations(ctx.db, ctx.actor.userId)
  }))
]

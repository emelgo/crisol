import { describe, expect, it } from 'vitest'
import { ACTIONS, type Actions } from './index.ts'

describe('Actions', () => {
  it('el tipo por nombre cubre todas las acciones', () => {
    // Si falta una acción en Actions, esto no compila
    const names: Record<keyof Actions, true> = {
      listOrganizations: true,
      listWorlds: true,
      createWorld: true,
      renameWorld: true,
      listCampaigns: true,
      createCampaign: true,
      renameCampaign: true
    }
    expect(Object.keys(names).sort()).toEqual(ACTIONS.map((a) => a.name).sort())
  })
})

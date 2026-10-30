/** Buscar en la wiki: lo mismo para la web y para Claude (buscar_paginas) */
import { searchWiki } from '@crisol/contracts'
import { searchWorld } from '../wiki/search.ts'
import { authorizedWiki } from './access.ts'
import { implement } from './registry.ts'

export const searchActions = [
  implement(searchWiki, async (ctx, input) => {
    const wiki = await authorizedWiki(ctx, 'page.read', input.worldId)
    return searchWorld(ctx, { ...input, worldId: wiki.worldId })
  })
]

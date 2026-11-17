/**
 * La pantalla del máster (docs/specs/modulo-8-10-campana.md, decisión 24): lo que enseña el cajón G en cada escena de
 * una campaña (sus cuatro columnas, la nota fijada y las tablas aleatorias elegidas) se guarda en el
 * servidor, en el estado de la campaña en la escena (con su historial). Las tablas se tiran con rollOnTable
 */
import { type GmScreen, listRandomTables, setGmScreen } from '@crisol/contracts'
import { pagesRepo, scenesRepo, tablesRepo } from '@crisol/db'
import { NotFoundError } from '@crisol/domain'
import { authorizedCampaign, authorizedWiki } from './access.ts'
import { historyContext, InvalidRequestError } from './context.ts'
import { implement } from './registry.ts'

/** La de siempre: las cuatro columnas, con la página de la escena fijada y ninguna tabla */
export const defaultGmScreen = (pageId: string | null): GmScreen => ({
  columns: { statblocks: true, characters: true, note: true, tables: true },
  note: pageId,
  tables: []
})

export const gmScreenActions = [
  implement(setGmScreen, async (ctx, { campaignId, sceneId, ...patch }) => {
    const campaign = await authorizedCampaign(ctx, 'table.manage', campaignId)
    const target = sceneId ?? (await scenesRepo.campaignTable(ctx.db, campaign.id)).openSceneId
    if (!target) throw new InvalidRequestError('NO_OPEN_SCENE', 'abre una escena antes o di cuál')
    const scene = await scenesRepo.findScene(ctx.db, target)
    if (!scene || scene.worldId !== campaign.worldId) throw new NotFoundError('scene')
    // Solo en una escena que la campaña ya ha abierto: abrirla es lo que pone lo preparado
    const state = await scenesRepo.findSceneState(ctx.db, campaign.id, target)
    if (!state) throw new InvalidRequestError('SCENE_NOT_OPEN', 'la campaña aún no ha abierto esa escena')
    if (patch.note) {
      const page = await pagesRepo.findPage(ctx.db, patch.note)
      if (!page || page.worldId !== campaign.worldId) throw new NotFoundError('page')
    }
    const tables = patch.tables ? [...new Set(patch.tables)] : undefined
    for (const tabId of tables ?? []) {
      const table = await tablesRepo.tableOfTab(ctx.db, tabId)
      if (!table || table.worldId !== campaign.worldId) throw new NotFoundError('table')
    }
    const current = state.gmScreen ?? defaultGmScreen(scene.pageId)
    const columns = Object.fromEntries(Object.entries(patch.columns ?? {}).filter(([, on]) => on !== undefined))
    const gmScreen: GmScreen = {
      columns: { ...current.columns, ...columns },
      note: patch.note !== undefined ? patch.note : current.note,
      tables: tables ?? current.tables
    }
    await scenesRepo.setGmScreen(
      ctx.db,
      historyContext(ctx, 'setGmScreen', { campaign: campaign.name, name: scene.name }, campaign),
      state.id,
      gmScreen
    )
    // Las otras pestañas y aparatos del máster la vuelven a pedir con la mesa
    ctx.table?.changed(campaign.id)
    return { sceneId: target, gmScreen }
  }),

  implement(listRandomTables, async (ctx, { worldId }) => {
    await authorizedWiki(ctx, 'page.read', worldId)
    return { tables: await tablesRepo.listWorldTables(ctx.db, worldId) }
  })
]

/**
 * Lo que recibe cada quien mira la mesa (ADR-0018): el máster, todo; la pantalla de la tele, lo que ve el grupo. Hasta
 * que llegue la niebla (`vision`) la pantalla ve la escena presentada entera, pero ya sin su página ni su nombre
 */
import type { CampaignTableView, SceneView, ScreenScene, ScreenToken, ScreenView, TokenView } from '@crisol/contracts'
import { campaignsRepo, scenesRepo, tokensRepo } from '@crisol/db'
import { actorFrom } from '@crisol/domain'
import { characterVitalsOf } from '../actions/characters.ts'
import type { ActionContext, ActionEnv } from '../actions/context.ts'
import { creatureCardsOf, lifeStateOf } from '../actions/creatures.ts'
import type { LoadTable } from './rooms.ts'

type Campaign = NonNullable<Awaited<ReturnType<typeof campaignsRepo.findCampaign>>>

/** Las fichas de una campaña en una escena, con lo vital de cada uno leído de su personaje o de su criatura */
export async function tokenViews(ctx: ActionContext, campaign: Campaign, sceneId: string): Promise<TokenView[]> {
  const rows = await tokensRepo.listTokens(ctx.db, campaign.id, sceneId)
  const creatures = await creatureCardsOf(
    ctx,
    campaign,
    rows.flatMap((r) => (r.creatureId ? [r.creatureId] : []))
  )
  const characters = await characterVitalsOf(
    ctx,
    campaign.id,
    rows.flatMap((r) => (r.characterId ? [r.characterId] : []))
  )
  return rows.flatMap((row): TokenView[] => {
    const base = {
      id: row.id,
      sceneId: row.sceneId,
      x: row.x,
      y: row.y,
      size: row.size,
      label: row.label,
      faction: row.faction,
      hidden: row.hidden,
      image: row.image ?? null
    }
    if (row.creatureId) {
      const card = creatures.get(row.creatureId)
      if (!card) return []
      const conditions = ((card.play as { conditions?: TokenView['actor']['conditions'] }).conditions ?? []).slice()
      return [
        {
          ...base,
          actor: {
            kind: 'creature',
            id: card.id,
            name: card.name,
            img: card.img,
            version: card.version,
            life: card.life ? { value: card.life.value, max: card.life.max, temp: card.life.temp } : null,
            stats: card.stats,
            conditions
          },
          // Una criatura oculta a los jugadores (módulo 5) también oculta su ficha
          hidden: row.hidden || card.hidden === true
        }
      ]
    }
    const vitals = row.characterId ? characters.get(row.characterId) : undefined
    if (!vitals || !row.characterId) return []
    return [
      {
        ...base,
        actor: {
          kind: 'character',
          id: row.characterId,
          name: vitals.name,
          img: null,
          version: vitals.version,
          life: vitals.life,
          stats: vitals.stats,
          conditions: vitals.conditions
        }
      }
    ]
  })
}

/** Lo que la pantalla ve de unas fichas: las que no están ocultas, sin números */
export function screenTokens(tokens: readonly TokenView[]): ScreenToken[] {
  return tokens
    .filter((token) => !token.hidden)
    .map((token) => ({
      id: token.id,
      x: token.x,
      y: token.y,
      size: token.size,
      label: token.label,
      name: token.actor.name,
      faction: token.faction,
      img: token.actor.img,
      image: token.image,
      state: token.actor.kind === 'creature' ? lifeStateOf(token.actor.life) : null,
      conditions: token.actor.conditions.map((c) => ({ name: c.name }))
    }))
}

/** Una escena tal como la ve quien prepara el mundo */
export function sceneView(row: scenesRepo.SceneWithPage): SceneView {
  return {
    id: row.id,
    tabId: row.tabId,
    pageId: row.pageId,
    pageTitle: row.pageTitle,
    name: row.name,
    image:
      row.width && row.height
        ? { width: row.width, height: row.height, tiles: row.tiles ?? null, fileId: row.fileId ?? null }
        : null,
    grid: row.grid,
    initialView: row.initialView ?? null,
    hasImported: row.imported !== null
  }
}

/** Lo que la pantalla necesita para pintar una escena: ni su página, ni su nombre, ni lo traído para `vision` */
export function screenScene(scene: SceneView): ScreenScene {
  return {
    id: scene.id,
    image: scene.image ? { width: scene.image.width, height: scene.image.height, tiles: scene.image.tiles } : null,
    grid: scene.grid,
    initialView: scene.initialView
  }
}

/** La mesa de una campaña para su máster y, aparte, las fichas de la escena presentada (para la pantalla) */
async function tableOf(ctx: ActionContext, campaign: Campaign) {
  const table = await scenesRepo.campaignTable(ctx.db, campaign.id)
  const open = table.openSceneId ? await scenesRepo.findScene(ctx.db, table.openSceneId) : null
  const presented =
    table.presentedSceneId === table.openSceneId
      ? open
      : table.presentedSceneId
        ? await scenesRepo.findScene(ctx.db, table.presentedSceneId)
        : null
  const tokens = open ? await tokenViews(ctx, campaign, open.id) : []
  const shownTokens =
    presented && presented.id === open?.id ? tokens : presented ? await tokenViews(ctx, campaign, presented.id) : []
  const master: CampaignTableView = {
    campaignId: campaign.id,
    open: open ? sceneView(open) : null,
    presented: presented ? sceneView(presented) : null,
    screenHidden: table.screenHidden,
    camera: table.camera,
    tokens
  }
  return { master, shownTokens }
}

/** La mesa de una campaña para su máster (la campaña ya autorizada) */
export async function campaignTableView(ctx: ActionContext, campaignId: string): Promise<CampaignTableView> {
  const campaign = await campaignsRepo.findCampaign(ctx.db, campaignId)
  if (!campaign) throw new Error(`campaña ${campaignId}: no existe`)
  return (await tableOf(ctx, campaign)).master
}

/** Lo que enseña la pantalla, sacado de la mesa del máster y de las fichas de la escena presentada */
export function screenViewOf(
  master: CampaignTableView,
  campaignName: string,
  shownTokens: readonly TokenView[]
): ScreenView {
  const showing = !master.screenHidden && master.presented !== null
  return {
    campaignId: master.campaignId,
    campaignName,
    scene: showing && master.presented ? screenScene(master.presented) : null,
    hidden: master.screenHidden,
    camera: master.camera,
    tokens: showing ? screenTokens(shownTokens) : []
  }
}

/**
 * Cómo carga la sala la mesa de una campaña. La sala ya comprobó quién mira: aquí se lee todo, con una cuenta sin
 * pertenencias que no se usa para autorizar
 */
export function loadTable(env: ActionEnv): LoadTable {
  const ctx: ActionContext = {
    ...env,
    actor: actorFrom('', { organizations: [], worlds: [], campaigns: [] }),
    via: 'ui'
  }
  return async (campaignId) => {
    const campaign = await campaignsRepo.findCampaign(env.db, campaignId)
    if (!campaign) return null
    const { master, shownTokens } = await tableOf(ctx, campaign)
    return { master, screen: screenViewOf(master, campaign.name, shownTokens) }
  }
}

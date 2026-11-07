/**
 * Lo que recibe cada quien mira la mesa (ADR-0018): el máster, todo; la pantalla de la tele, lo que ve el grupo
 * (docs/specs/vision.md): lo explorado y lo visible en máscaras, las fichas que ve y no están ocultas, las luces
 * recortadas a lo que ve y el combate sin las criaturas que no ve. Ni muros, ni puertas, ni luces apagadas
 */
import type {
  CampaignTableView,
  CombatantView,
  CombatView,
  SceneView,
  ScreenCamera,
  ScreenCombat,
  ScreenScene,
  ScreenToken,
  ScreenView,
  TableVision,
  TokenView
} from '@crisol/contracts'
import { campaignsRepo, combatsRepo, creaturesRepo, scenesRepo, systemsRepo, tokensRepo } from '@crisol/db'
import { actorFrom } from '@crisol/domain'
import {
  type Choices,
  initiativeRoll,
  normalizeChoices,
  type SenseRanges,
  type System,
  type Text,
  textOf
} from '@crisol/systems'
import { distanceToPixels, type FogGrid, type PartyToken, type Senses, slotIndexOf, turnSlots } from '@crisol/tabletop'
import { characterVitalsOf } from '../actions/characters.ts'
import type { ActionContext, ActionEnv } from '../actions/context.ts'
import { creatureCardsOf, lifeStateOf } from '../actions/creatures.ts'
import type { LoadTable } from './rooms.ts'
import type { VisionResult, VisionToken } from './vision.ts'

type Campaign = NonNullable<Awaited<ReturnType<typeof campaignsRepo.findCampaign>>>

/** Las fichas de una campaña en una escena, con lo vital de cada uno leído de su personaje o de su criatura */
export async function tokenViews(ctx: ActionContext, campaign: Campaign, sceneId: string): Promise<TokenView[]> {
  return (await tokensWithSenses(ctx, campaign, sceneId)).views
}

/** Las fichas y, las de los personajes, sus sentidos (en la unidad de la rejilla), por el id de la ficha */
export async function tokensWithSenses(ctx: ActionContext, campaign: Campaign, sceneId: string) {
  const senses = new Map<string, SenseRanges>()
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
  const views = rows.flatMap((row): TokenView[] => {
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
    senses.set(row.id, vitals.senses)
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
  return { views, senses }
}

/** Lo que la pantalla ve de unas fichas: las que el grupo ve y no están ocultas, sin números */
export function screenTokens(tokens: readonly TokenView[], seen: ReadonlySet<string>): ScreenToken[] {
  return tokens
    .filter((token) => !token.hidden && seen.has(token.id))
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

/** Fuera de combate: a 0 de su vida (sin vida que contar, como un personaje a medio crear, no) */
const isDown = (life: { value: number; max: number } | null) => life !== null && life.max > 0 && life.value <= 0

/** La tirada de iniciativa del sistema de la campaña: su clave y su nombre (null si no tiene) */
export async function initiativeOf(ctx: ActionContext, campaign: Campaign) {
  const row = campaign.system ? await systemsRepo.findSystem(ctx.db, campaign.system) : null
  if (!row || row.deletedAt) return null
  const system = row.document as unknown as System
  const key = initiativeRoll(system)
  if (!key) return null
  const { choices } = normalizeChoices(system, (campaign.systemChoices ?? {}) as Partial<Choices>)
  return { key, label: textOf(system.rolls?.[key]?.label as Text | undefined, choices.language) || key }
}

/**
 * El combate de una campaña tal como lo ve su máster: cada combatiente con lo suyo (leído de su personaje o su
 * criatura, y su ficha en la escena del combate), en el orden en que actúan y con el turno marcado
 */
export async function combatViewOf(
  ctx: ActionContext,
  campaign: Campaign,
  combat: combatsRepo.CombatRow
): Promise<CombatView> {
  const rows = await combatsRepo.listCombatants(ctx.db, combat.id)
  const creatureIds = rows.flatMap((r) => (r.creatureId ? [r.creatureId] : []))
  const characterIds = rows.flatMap((r) => (r.characterId ? [r.characterId] : []))
  const [tokens, cards, vitals, creatures, initiative] = await Promise.all([
    combat.sceneId ? tokensRepo.listTokens(ctx.db, campaign.id, combat.sceneId) : Promise.resolve([]),
    creatureCardsOf(ctx, campaign, creatureIds),
    characterVitalsOf(ctx, campaign.id, characterIds),
    creatureIds.length ? creaturesRepo.listCreatures(ctx.db, campaign.id) : Promise.resolve([]),
    initiativeOf(ctx, campaign)
  ])
  const creatureRows = new Map(creatures.map((c) => [c.id, c]))
  const list = rows.flatMap((row): Omit<CombatantView, 'active'>[] => {
    const token = tokens.find((t) =>
      row.characterId ? t.characterId === row.characterId : t.creatureId === row.creatureId
    )
    const base = {
      id: row.id,
      tokenId: token?.id ?? null,
      initiative: row.initiative,
      modifier: row.modifier,
      group: row.group,
      sort: row.sort
    }
    if (row.creatureId) {
      const card = cards.get(row.creatureId)
      const creature = creatureRows.get(row.creatureId)
      if (!creature) return []
      const life = card?.life ? { value: card.life.value, max: card.life.max, temp: card.life.temp } : null
      return [
        {
          ...base,
          kind: 'creature',
          actorId: row.creatureId,
          name: creature.name,
          img: card?.img ?? null,
          generic: !creature.unique,
          defeated: isDown(life),
          hidden: creature.hidden || token?.hidden === true,
          life,
          conditions: ((creature.play as { conditions?: CombatantView['conditions'] }).conditions ?? []).slice()
        }
      ]
    }
    const character = row.characterId ? vitals.get(row.characterId) : undefined
    if (!character || !row.characterId) return []
    return [
      {
        ...base,
        kind: 'character',
        actorId: row.characterId,
        name: character.name,
        img: null,
        generic: false,
        defeated: isDown(character.life),
        hidden: token?.hidden === true,
        life: character.life,
        conditions: character.conditions
      }
    ]
  })
  // A igualdad de todo, por su nombre («Goblin 2» antes que «Goblin 10»)
  list.sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }))
  const slots = turnSlots(list)
  const current = combat.round > 0 ? slotIndexOf(slots, combat.turnId) : -1
  return {
    id: combat.id,
    campaignId: combat.campaignId,
    sceneId: combat.sceneId,
    round: combat.round,
    turnId: combat.turnId,
    skipDefeated: combat.skipDefeated,
    initiativeRoll: initiative?.label ?? null,
    combatants: slots.flatMap((slot, i) => slot.members.map((member) => ({ ...member, active: i === current })))
  }
}

/**
 * La franja de turnos de la pantalla: sin los ocultos, ni la vida, ni la iniciativa de las criaturas, ni las criaturas
 * cuya ficha no ve el grupo en la escena presentada (las que no tienen ficha, sí)
 */
export function screenCombatOf(
  combat: CombatView,
  presentedId: string | null,
  seen: ReadonlySet<string>
): ScreenCombat {
  const shown = (c: CombatantView) =>
    c.kind !== 'creature' || c.tokenId === null || (combat.sceneId === presentedId && seen.has(c.tokenId))
  return {
    round: combat.round,
    combatants: combat.combatants
      .filter((c) => !c.hidden && shown(c))
      .map((c) => ({
        id: c.id,
        kind: c.kind,
        tokenId: c.tokenId,
        name: c.name,
        img: c.img,
        initiative: c.kind === 'character' ? c.initiative : null,
        active: c.active,
        defeated: c.defeated
      }))
  }
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

/** Los sentidos en píxeles, con la rejilla de la escena */
function sensesInPixels(ranges: SenseRanges | undefined, grid: SceneView['grid']): Senses | undefined {
  if (!ranges) return undefined
  const out: Senses = {}
  for (const [kind, units] of Object.entries(ranges) as [keyof Senses, number][])
    out[kind] = distanceToPixels(units, grid.distance, grid.size)
  return Object.keys(out).length > 0 ? out : undefined
}

/** Las fichas de una escena para la visión: miran las de los personajes que no están ocultas, con sus sentidos */
export function visionTokens(
  scene: Pick<scenesRepo.SceneRow, 'grid'>,
  tokens: readonly TokenView[],
  senses: ReadonlyMap<string, SenseRanges>
): VisionToken[] {
  return tokens.map((t) => {
    const party = t.actor.kind === 'character' && !t.hidden
    const own = party ? sensesInPixels(senses.get(t.id), scene.grid) : undefined
    return { id: t.id, x: t.x, y: t.y, radius: (t.size * scene.grid.size) / 2, party, ...(own ? { senses: own } : {}) }
  })
}

/**
 * La vista del grupo de una campaña en una escena: con las fichas ya leídas o, si no, leyéndolas. `paths`, los puntos
 * del camino de las fichas que se acaban de mover (se explora lo que se ve desde cada uno). Sin el servicio, null
 */
export async function visionOf(
  ctx: ActionContext,
  campaign: Campaign,
  scene: scenesRepo.SceneRow,
  loaded?: { views: TokenView[]; senses: ReadonlyMap<string, SenseRanges> },
  paths?: readonly PartyToken[]
): Promise<VisionResult | null> {
  if (!ctx.vision) return null
  const { views, senses } = loaded ?? (await tokensWithSenses(ctx, campaign, scene.id))
  return ctx.vision.view({
    campaignId: campaign.id,
    scene,
    tokens: visionTokens(scene, views, senses),
    ...(paths?.length ? { paths } : {})
  })
}

/** La visión de la escena abierta para el máster */
function tableVisionOf(
  scene: scenesRepo.SceneRow,
  vision: VisionResult,
  tokens: readonly TokenView[],
  tileFit: TableVision['tileFit']
): TableVision {
  return {
    sceneId: scene.id,
    version: scene.version,
    automaticVision: scene.automaticVision,
    darkness: scene.darkness,
    tileFit,
    doors: { ...vision.doors },
    explored: vision.exploredData,
    visible: vision.visibleData,
    notSeen: tokens.filter((t) => t.hidden || !vision.seen.has(t.id)).map((t) => t.id)
  }
}

/** La mesa de una campaña para su máster y, aparte, lo de la escena presentada (para la pantalla) */
async function tableOf(ctx: ActionContext, campaign: Campaign) {
  const table = await scenesRepo.campaignTable(ctx.db, campaign.id)
  const open = table.openSceneId ? await scenesRepo.findScene(ctx.db, table.openSceneId) : null
  const presented =
    table.presentedSceneId === table.openSceneId
      ? open
      : table.presentedSceneId
        ? await scenesRepo.findScene(ctx.db, table.presentedSceneId)
        : null
  const openLoaded = open ? await tokensWithSenses(ctx, campaign, open.id) : { views: [], senses: new Map() }
  const shownLoaded =
    presented && presented.id === open?.id
      ? openLoaded
      : presented
        ? await tokensWithSenses(ctx, campaign, presented.id)
        : { views: [], senses: new Map() }
  const openVision = open ? await visionOf(ctx, campaign, open, openLoaded) : null
  const shownVision =
    presented && presented.id === open?.id
      ? openVision
      : presented
        ? await visionOf(ctx, campaign, presented, shownLoaded)
        : null
  const combat = await combatsRepo.findCombat(ctx.db, campaign.id)
  const master: CampaignTableView = {
    campaignId: campaign.id,
    open: open ? sceneView(open) : null,
    presented: presented ? sceneView(presented) : null,
    screenHidden: table.screenHidden,
    camera: table.camera,
    tokens: openLoaded.views,
    combat: combat ? await combatViewOf(ctx, campaign, combat) : null,
    vision: open && openVision ? tableVisionOf(open, openVision, openLoaded.views, table.tileFit) : null
  }
  return { master, shownTokens: shownLoaded.views, shownVision }
}

/** La mesa de una campaña para su máster (la campaña ya autorizada) */
export async function campaignTableView(ctx: ActionContext, campaignId: string): Promise<CampaignTableView> {
  const campaign = await campaignsRepo.findCampaign(ctx.db, campaignId)
  if (!campaign) throw new Error(`campaña ${campaignId}: no existe`)
  return (await tableOf(ctx, campaign)).master
}

/** Lo que enseña la pantalla de una escena (o de ninguna), con la vista del grupo en ella */
export function screenViewOf(input: {
  campaignId: string
  campaignName: string
  scene: SceneView | null
  hidden: boolean
  camera: ScreenCamera
  tokens: readonly TokenView[]
  combat: CombatView | null | undefined
  vision: VisionResult | null
}): ScreenView {
  const { scene, vision } = input
  // Sin la vista del grupo no se enseña nada (no debería pasar: el servidor siempre la tiene)
  const showing = !input.hidden && scene !== null && vision !== null
  const seen = vision?.seen ?? new Set<string>()
  return {
    campaignId: input.campaignId,
    campaignName: input.campaignName,
    scene: showing && scene ? screenScene(scene) : null,
    hidden: input.hidden,
    camera: input.camera,
    tokens: showing ? screenTokens(input.tokens, seen) : [],
    combat: showing && input.combat ? screenCombatOf(input.combat, scene?.id ?? null, seen) : null,
    fog:
      showing && vision
        ? {
            width: vision.width,
            height: vision.height,
            cellSize: vision.cellSize,
            explored: vision.exploredData,
            visible: vision.visibleData,
            darkness: vision.darkness
          }
        : null,
    lights:
      showing && vision
        ? vision.lit.map(({ light, cells, originVisible }) => ({
            id: light.id,
            color: light.color,
            intensity: light.intensity,
            bright: light.bright,
            dim: light.dim,
            origin: originVisible ? { x: light.x, y: light.y } : null,
            cells
          }))
        : []
  }
}

/** La pantalla de la mesa del máster: la escena presentada, con lo que ve el grupo */
function screenOfTable(
  master: CampaignTableView,
  campaignName: string,
  shownTokens: readonly TokenView[],
  vision: VisionResult | null
) {
  return screenViewOf({
    campaignId: master.campaignId,
    campaignName,
    scene: master.presented,
    hidden: master.screenHidden,
    camera: master.camera,
    tokens: shownTokens,
    combat: master.combat,
    vision
  })
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
    const { master, shownTokens, shownVision } = await tableOf(ctx, campaign)
    const screen = screenOfTable(master, campaign.name, shownTokens, shownVision)
    const screenVisible: FogGrid | null = screen.scene && shownVision ? shownVision.visible : null
    return { master, screen, screenVisible }
  }
}

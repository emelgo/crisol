/**
 * Lo que recibe cada quien mira la mesa (ADR-0018): el máster, todo; la pantalla de la tele, lo que ve el grupo. Hasta
 * que llegue la niebla (`vision`) la pantalla ve la escena presentada entera, pero ya sin su página ni su nombre
 */
import type {
  CampaignTableView,
  CombatantView,
  CombatView,
  SceneView,
  ScreenCombat,
  ScreenScene,
  ScreenToken,
  ScreenView,
  TokenView
} from '@crisol/contracts'
import { campaignsRepo, combatsRepo, creaturesRepo, scenesRepo, systemsRepo, tokensRepo } from '@crisol/db'
import { actorFrom } from '@crisol/domain'
import { type Choices, initiativeRoll, normalizeChoices, type System, type Text, textOf } from '@crisol/systems'
import { slotIndexOf, turnSlots } from '@crisol/tabletop'
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

/** La franja de turnos de la pantalla: sin los ocultos, ni la vida, ni la iniciativa de las criaturas */
export function screenCombatOf(combat: CombatView): ScreenCombat {
  return {
    round: combat.round,
    combatants: combat.combatants
      .filter((c) => !c.hidden)
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
  const combat = await combatsRepo.findCombat(ctx.db, campaign.id)
  const master: CampaignTableView = {
    campaignId: campaign.id,
    open: open ? sceneView(open) : null,
    presented: presented ? sceneView(presented) : null,
    screenHidden: table.screenHidden,
    camera: table.camera,
    tokens,
    combat: combat ? await combatViewOf(ctx, campaign, combat) : null
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
    tokens: showing ? screenTokens(shownTokens) : [],
    combat: showing && master.combat ? screenCombatOf(master.combat) : null
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

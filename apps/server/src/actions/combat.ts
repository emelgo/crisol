/**
 * El combate de la mesa (docs/specs/combate.md, ADR-0018 punto 10): lo lleva el servidor, sin depender de ninguna
 * pestaña. Es de la mesa de la campaña: lo lleva su máster (`table.manage`). Al empezar el turno de alguien, en la
 * misma operación, caducan sus estados, se tiran sus recargas y se reponen sus legendarias
 */
import {
  addCombatants,
  type CombatantView,
  type CombatView,
  type DiceRoll,
  endCombat,
  getCombat,
  groupCombatants,
  nextTurn,
  orderCombatants,
  previousTurn,
  removeCombatants,
  rollInitiative,
  setInitiative,
  startCombat,
  type TurnStarted,
  updateCombat
} from '@crisol/contracts'
import { charactersRepo, combatsRepo, creaturesRepo, scenesRepo, tokensRepo } from '@crisol/db'
import { cryptoRoller } from '@crisol/dice'
import { NotFoundError } from '@crisol/domain'
import { type Play, startTurn } from '@crisol/systems'
import { passTurn, type TurnState, turnAfterRemoval } from '@crisol/tabletop'
import { creaturesChanged } from '../realtime/events.ts'
import { combatViewOf, initiativeOf } from '../table/projection.ts'
import { authorizedCampaign } from './access.ts'
import { type ActionContext, historyContext, InvalidRequestError } from './context.ts'
import { creaturesForTurn } from './creatures.ts'
import { implement } from './registry.ts'

type Campaign = Awaited<ReturnType<typeof authorizedCampaign>>
type Combat = combatsRepo.CombatRow

const changed = () =>
  new InvalidRequestError('COMBAT_CHANGED', 'el combate ha cambiado mientras tanto: vuelve a mirarlo')

/** La campaña (si quien pide lleva su mesa) y su combate; sin combate, NO_COMBAT */
async function combatOf(ctx: ActionContext, campaignId: string) {
  const campaign = await authorizedCampaign(ctx, 'table.manage', campaignId)
  const combat = await combatsRepo.findCombat(ctx.db, campaignId)
  if (!combat) throw new InvalidRequestError('NO_COMBAT', 'la campaña no tiene un combate empezado')
  return { campaign, combat }
}

/** Guarda un cambio del combate, avisa a la mesa y devuelve cómo queda */
async function save(
  ctx: ActionContext,
  campaign: Campaign,
  combat: Combat,
  action: string,
  details: Record<string, unknown>,
  change: Omit<combatsRepo.CombatChange, 'version'>
) {
  let saved: Combat
  try {
    saved = await combatsRepo.changeCombat(
      ctx.db,
      historyContext(ctx, action, { campaign: campaign.name, ...details }, campaign),
      combat.id,
      { version: combat.version, ...change }
    )
  } catch (error) {
    if (error instanceof combatsRepo.CombatChangedError) throw changed()
    throw error
  }
  ctx.table?.changed(campaign.id)
  return combatViewOf(ctx, campaign, saved)
}

/** Unos combatientes del combate por su id; si falta alguno, 404 */
function own(view: CombatView, ids: readonly string[]) {
  const found = view.combatants.filter((c) => ids.includes(c.id))
  if (found.length !== new Set(ids).size) throw new NotFoundError('combatant')
  return found
}

/** Con los de su grupo: un grupo tira y escribe su iniciativa junto */
function withGroups(view: CombatView, chosen: readonly CombatantView[]) {
  const groups = new Set(chosen.flatMap((c) => (c.group ? [c.group] : [])))
  const ids = new Set(chosen.map((c) => c.id))
  return view.combatants.filter((c) => ids.has(c.id) || (c.group !== null && groups.has(c.group)))
}

const stateOf = (combat: Combat): TurnState => ({
  round: combat.round,
  turn: combat.turnId,
  skipDefeated: combat.skipDefeated
})

/** Lo que suma una tirada a sus dados (para deshacer empates): su total menos los dados que cuentan */
const modifierOf = (roll: DiceRoll) =>
  roll.total - roll.dice.filter((d) => d.kept && typeof d.sides === 'number').reduce((n, d) => n + d.value, 0)

/** El grupo de una criatura en juego: sus copias van juntas (un turno, como en dnd5e); la única, sola */
const groupOf = (creature: { key: string; unique: boolean }) => (creature.unique ? null : creature.key)

/** Los combatientes nuevos de unas fichas y unos personajes y criaturas, sin los que ya están */
async function newMembers(
  ctx: ActionContext,
  campaign: Campaign,
  sceneId: string | null,
  given: { tokenIds?: string[] | undefined; characterIds?: string[] | undefined; creatureIds?: string[] | undefined },
  present: ReadonlySet<string> = new Set()
): Promise<combatsRepo.CombatantValues[]> {
  const tokens = given.tokenIds?.length ? await tokensRepo.findTokens(ctx.db, campaign.id, given.tokenIds) : []
  if (tokens.length !== new Set(given.tokenIds ?? []).size || tokens.some((t) => t.sceneId !== sceneId))
    throw new NotFoundError('token')
  const characterIds = [...tokens.flatMap((t) => (t.characterId ? [t.characterId] : [])), ...(given.characterIds ?? [])]
  const creatureIds = [...tokens.flatMap((t) => (t.creatureId ? [t.creatureId] : [])), ...(given.creatureIds ?? [])]
  const characters = new Set((await charactersRepo.listCharacters(ctx.db, campaign.id)).map((c) => c.id))
  if (characterIds.some((id) => !characters.has(id))) throw new NotFoundError('character')
  const creatures = new Map((await creaturesRepo.listCreatures(ctx.db, campaign.id)).map((c) => [c.id, c]))
  if (creatureIds.some((id) => !creatures.has(id))) throw new NotFoundError('creature')
  const members: combatsRepo.CombatantValues[] = []
  for (const id of new Set(characterIds))
    if (!present.has(id)) members.push({ characterId: id, creatureId: null, group: null })
  for (const id of new Set(creatureIds)) {
    const creature = creatures.get(id)
    if (creature && !present.has(id)) members.push({ characterId: null, creatureId: id, group: groupOf(creature) })
  }
  return members
}

/** Empieza el turno de unos combatientes: lo de su partida, con sus estados y sus recargas al día, y qué pasó */
async function turnStart(ctx: ActionContext, campaign: Campaign, members: readonly CombatantView[]) {
  const started: TurnStarted = { names: members.map((m) => m.name), expired: [], recharged: [], restored: [] }
  const creatures: combatsRepo.PlayUpdate[] = []
  const characters: combatsRepo.PlayUpdate[] = []
  const d6 = () => cryptoRoller(6)
  const forTurn = await creaturesForTurn(
    ctx,
    campaign,
    members.flatMap((m) => (m.kind === 'creature' ? [m.actorId] : []))
  )
  for (const member of members) {
    if (member.kind === 'creature') {
      const found = forTurn.get(member.actorId)
      if (!found) continue
      const result = startTurn(found.row.play as Play, found.actions, d6)
      started.expired.push(...result.expired.map((c) => ({ name: member.name, condition: c.name })))
      started.recharged.push(
        ...result.recharged.map((key) => ({
          name: member.name,
          action: found.actions.find((a) => a.key === key)?.label ?? key
        }))
      )
      started.restored.push(
        ...result.restored.map((key) => ({ name: member.name, resource: found.resources.get(key) ?? key }))
      )
      if (JSON.stringify(result.play) !== JSON.stringify(found.row.play))
        creatures.push({ id: found.row.id, version: found.row.version, play: result.play as Record<string, unknown> })
    } else {
      const row = await charactersRepo.findCharacter(ctx.db, member.actorId)
      if (!row) continue
      // Un personaje: solo sus estados (sus recursos los lleva su jugador)
      const result = startTurn(row.play as Play, [], d6)
      started.expired.push(...result.expired.map((c) => ({ name: member.name, condition: c.name })))
      if (result.expired.length > 0 || JSON.stringify(result.play) !== JSON.stringify(row.play))
        characters.push({ id: row.id, version: row.version, play: result.play as Record<string, unknown> })
    }
  }
  return { started, creatures, characters }
}

export const combatActions = [
  implement(getCombat, async (ctx, { campaignId }) => {
    const campaign = await authorizedCampaign(ctx, 'table.manage', campaignId)
    const combat = await combatsRepo.findCombat(ctx.db, campaignId)
    return { combat: combat ? await combatViewOf(ctx, campaign, combat) : null }
  }),

  implement(startCombat, async (ctx, { campaignId, tokenIds, skipDefeated }) => {
    const campaign = await authorizedCampaign(ctx, 'table.manage', campaignId)
    const table = await scenesRepo.campaignTable(ctx.db, campaignId)
    const sceneId = table.openSceneId
    if (!sceneId) throw new InvalidRequestError('NO_OPEN_SCENE', 'abre antes una escena en la mesa')
    const ids = tokenIds ?? (await tokensRepo.listTokens(ctx.db, campaignId, sceneId)).map((t) => t.id)
    const members = await newMembers(ctx, campaign, sceneId, { tokenIds: ids })
    if (members.length === 0) throw new InvalidRequestError('NO_COMBATANTS', 'no hay fichas en la escena abierta')
    let created: Awaited<ReturnType<typeof combatsRepo.startCombat>>
    try {
      created = await combatsRepo.startCombat(
        ctx.db,
        historyContext(ctx, 'startCombat', { campaign: campaign.name, count: members.length }, campaign),
        { worldId: campaign.worldId, campaignId, sceneId },
        members
      )
    } catch (error) {
      if (error instanceof combatsRepo.CombatRunningError)
        throw new InvalidRequestError('COMBAT_RUNNING', 'ya hay un combate en la campaña: acábalo antes')
      throw error
    }
    let combat = created.combat
    if (skipDefeated === false)
      combat = await combatsRepo.changeCombat(
        ctx.db,
        historyContext(ctx, 'updateCombat', { campaign: campaign.name, skipDefeated }, campaign),
        combat.id,
        { version: combat.version, patch: { skipDefeated } }
      )
    ctx.table?.changed(campaignId)
    return combatViewOf(ctx, campaign, combat)
  }),

  implement(addCombatants, async (ctx, { campaignId, ...given }) => {
    const { campaign, combat } = await combatOf(ctx, campaignId)
    const view = await combatViewOf(ctx, campaign, combat)
    const present = new Set(view.combatants.map((c) => c.actorId))
    const insert = await newMembers(ctx, campaign, combat.sceneId, given, present)
    if (insert.length === 0) return view
    return save(ctx, campaign, combat, 'addCombatants', { count: insert.length }, { insert })
  }),

  implement(removeCombatants, async (ctx, { campaignId, combatantIds }) => {
    const { campaign, combat } = await combatOf(ctx, campaignId)
    const view = await combatViewOf(ctx, campaign, combat)
    const gone = own(view, combatantIds)
    const turnId = combat.round > 0 ? turnAfterRemoval(view.combatants, stateOf(combat), combatantIds) : null
    return save(
      ctx,
      campaign,
      combat,
      'removeCombatants',
      { names: gone.map((c) => c.name) },
      { remove: [...new Set(combatantIds)], patch: { turnId } }
    )
  }),

  implement(rollInitiative, async (ctx, { campaignId, who, combatantIds }) => {
    const { campaign, combat } = await combatOf(ctx, campaignId)
    const initiative = await initiativeOf(ctx, campaign)
    if (!initiative)
      throw new InvalidRequestError(
        'NO_INITIATIVE_ROLL',
        'el sistema de la campaña no tiene tirada de iniciativa: escríbela con setInitiative'
      )
    const view = await combatViewOf(ctx, campaign, combat)
    const chosen = combatantIds
      ? own(view, combatantIds)
      : view.combatants.filter((c) =>
          who === 'creatures' ? c.kind === 'creature' : who === 'unrolled' ? c.initiative === null : true
        )
    // Cada grupo tira una vez (por el primero de los suyos) y todos se quedan con lo que salga
    const units = new Map<string, CombatantView[]>()
    for (const member of withGroups(view, chosen)) {
      const key = member.group ?? member.id
      units.set(key, [...(units.get(key) ?? []), member])
    }
    const rolls: Array<{ combatantIds: string[]; name: string; total: number; rollId: string }> = []
    const failed: Array<{ combatantId: string; name: string; reason: string }> = []
    const update: Array<{ id: string; patch: combatsRepo.CombatantPatch }> = []
    for (const members of units.values()) {
      const first = members[0]
      if (!first) continue
      const impl = ctx.actions.get(first.kind === 'creature' ? 'rollForCreature' : 'rollForCharacter')
      if (!impl) throw new Error('faltan las tiradas por criatura y por personaje')
      let roll: DiceRoll
      try {
        const result = (await impl.handler(ctx, {
          ...(first.kind === 'creature' ? { creatureId: first.actorId } : { characterId: first.actorId }),
          roll: { key: initiative.key },
          // Las de las criaturas, ocultas (como cualquier tirada suya); las de los personajes, a la vista
          visibility: first.kind === 'creature' ? 'hidden' : 'all'
        })) as { roll: DiceRoll }
        roll = result.roll
      } catch (error) {
        if (!(error instanceof InvalidRequestError) && !(error instanceof NotFoundError)) throw error
        const reason = error instanceof InvalidRequestError ? (error.detail ?? error.code) : 'NOT_FOUND'
        failed.push({ combatantId: first.id, name: first.name, reason })
        continue
      }
      const modifier = modifierOf(roll)
      for (const member of members) update.push({ id: member.id, patch: { initiative: roll.total, modifier } })
      rolls.push({ combatantIds: members.map((m) => m.id), name: first.name, total: roll.total, rollId: roll.id })
    }
    const after =
      update.length > 0
        ? await save(ctx, campaign, combat, 'rollInitiative', { count: rolls.length }, { update })
        : view
    return { combat: after, rolls, failed }
  }),

  implement(setInitiative, async (ctx, { campaignId, values }) => {
    const { campaign, combat } = await combatOf(ctx, campaignId)
    const view = await combatViewOf(ctx, campaign, combat)
    const update = new Map<string, combatsRepo.CombatantPatch>()
    for (const value of values) {
      const chosen = own(view, [value.combatantId])
      for (const member of withGroups(view, chosen))
        update.set(member.id, {
          initiative: value.initiative,
          ...(value.modifier !== undefined ? { modifier: value.modifier } : {})
        })
    }
    return save(
      ctx,
      campaign,
      combat,
      'setInitiative',
      { count: values.length },
      { update: [...update].map(([id, patch]) => ({ id, patch })) }
    )
  }),

  implement(orderCombatants, async (ctx, { campaignId, combatantIds }) => {
    const { campaign, combat } = await combatOf(ctx, campaignId)
    const view = await combatViewOf(ctx, campaign, combat)
    own(view, combatantIds)
    const order = [...new Set(combatantIds)]
    return save(
      ctx,
      campaign,
      combat,
      'orderCombatants',
      { count: order.length },
      { update: order.map((id, sort) => ({ id, patch: { sort } })) }
    )
  }),

  implement(groupCombatants, async (ctx, { campaignId, combatantIds, together }) => {
    const { campaign, combat } = await combatOf(ctx, campaignId)
    const view = await combatViewOf(ctx, campaign, combat)
    const chosen = own(view, combatantIds)
    const first = chosen[0]
    // Juntos, con el grupo del primero (o uno nuevo) y su iniciativa; separados, cada uno el suyo
    const group = together ? (first?.group ?? first?.id ?? null) : null
    const update = chosen.map((c) => ({
      id: c.id,
      patch: together ? { group, initiative: first?.initiative ?? null, modifier: first?.modifier ?? null } : { group }
    }))
    return save(ctx, campaign, combat, 'groupCombatants', { count: chosen.length, together }, { update })
  }),

  implement(updateCombat, async (ctx, { campaignId, skipDefeated }) => {
    const { campaign, combat } = await combatOf(ctx, campaignId)
    return save(ctx, campaign, combat, 'updateCombat', { skipDefeated }, { patch: { skipDefeated } })
  }),

  implement(nextTurn, async (ctx, { campaignId }) => {
    const { campaign, combat } = await combatOf(ctx, campaignId)
    const view = await combatViewOf(ctx, campaign, combat)
    if (view.combatants.length === 0) throw new InvalidRequestError('NO_COMBATANTS', 'el combate no tiene a nadie')
    const change = passTurn(view.combatants, stateOf(combat), 1)
    const { started, creatures, characters } = change.started
      ? await turnStart(ctx, campaign, change.started.members)
      : { started: null, creatures: [], characters: [] }
    const after = await save(
      ctx,
      campaign,
      combat,
      'nextTurn',
      { round: change.round, names: started?.names ?? [] },
      { patch: { round: change.round, turnId: change.turn }, creatures, characters }
    )
    if (creatures.length > 0) ctx.realtime.publish(creaturesChanged({ campaignId, worldId: campaign.worldId }))
    return { combat: after, started }
  }),

  implement(previousTurn, async (ctx, { campaignId }) => {
    const { campaign, combat } = await combatOf(ctx, campaignId)
    const view = await combatViewOf(ctx, campaign, combat)
    const change = passTurn(view.combatants, stateOf(combat), -1)
    if (change.round === combat.round && change.turn === combat.turnId) return view
    return save(
      ctx,
      campaign,
      combat,
      'previousTurn',
      { round: change.round },
      { patch: { round: change.round, turnId: change.turn } }
    )
  }),

  implement(endCombat, async (ctx, { campaignId, remove }) => {
    const { campaign, combat } = await combatOf(ctx, campaignId)
    const view = await combatViewOf(ctx, campaign, combat)
    const mode = remove ?? 'defeated'
    const leaving = view.combatants
      .filter((c) => c.kind === 'creature' && c.generic && (mode === 'generic' || (mode === 'defeated' && c.defeated)))
      .map((c) => c.actorId)
    let removed: string[]
    try {
      removed = await combatsRepo.endCombat(
        ctx.db,
        historyContext(ctx, 'endCombat', { campaign: campaign.name, count: leaving.length }, campaign),
        combat.id,
        combat.version,
        leaving
      )
    } catch (error) {
      if (error instanceof combatsRepo.CombatChangedError) throw changed()
      throw error
    }
    if (removed.length > 0) ctx.realtime.publish(creaturesChanged({ campaignId, worldId: campaign.worldId }))
    ctx.table?.changed(campaignId)
    return { removed }
  })
]

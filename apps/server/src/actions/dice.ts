/**
 * Las tiradas de una campaña (ADR-0010): el servidor pone el azar, guarda la tirada ya resuelta y la deja leer a quien
 * la puede ver. Las privadas, solo a quien tira y al máster
 */
import { type DiceRoll, listRolls, rollDice, tryDice, visibilitiesFor } from '@crisol/contracts'
import { diceRepo } from '@crisol/db'
import { type CriticalRule, cryptoRoller, DiceSyntaxError, rollDice as roll } from '@crisol/dice'
import { can } from '@crisol/domain'
import { authorizedCampaign } from './access.ts'
import { type ActionContext, InvalidRequestError, TooManyRequestsError } from './context.ts'
import { implement } from './registry.ts'
import { criticalRuleOf } from './systems.ts'

/** Como mucho, tantas por minuto y persona: se cuentan en la tabla, así vale con varias instancias */
export const ROLLS_PER_MINUTE = 60

/** Las de tryDice (sin apuntar), en la memoria del proceso: no guardan nada que contar */
const tried = new Map<string, number[]>()
/** Las de probar (tryDice y las tiradas de un sistema), que no se apuntan */
export function tooManyTries(userId: string) {
  const now = Date.now()
  const recent = (tried.get(userId) ?? []).filter((at) => now - at < 60_000)
  if (recent.length >= ROLLS_PER_MINUTE) {
    tried.set(userId, recent)
    return true
  }
  recent.push(now)
  tried.set(userId, recent)
  return false
}

/** Los dados de un resultado, para guardarlos y para los dados 3D */
const diceOf = (result: ReturnType<typeof roll>) =>
  result.terms.flatMap((term) => term.dice.map((d) => ({ sides: term.sides, value: d.value, kept: d.kept })))

/** Tirar, o decir por qué no se entiende */
function rolled(formula: string, critical: CriticalRule = 'd20') {
  try {
    return roll(formula, cryptoRoller, { critical })
  } catch (error) {
    if (error instanceof DiceSyntaxError) throw new InvalidRequestError('BAD_FORMULA', error.message)
    throw error
  }
}

const isMaster = (ctx: ActionContext, campaign: { id: string; worldId: string }) =>
  can(ctx.actor, 'dice.private', { campaignId: campaign.id, worldId: campaign.worldId })

type Row = NonNullable<Awaited<ReturnType<typeof diceRepo.insertRoll>>>

export const present = (row: Row): DiceRoll => ({
  id: row.id,
  campaignId: row.campaignId,
  // Solo un color de verdad: lo guarda la cuenta, y va a un estilo en la web
  by: { userId: row.userId, name: row.name, color: row.color && /^#[0-9a-f]{6}$/i.test(row.color) ? row.color : null },
  ai: row.ai,
  formula: row.formula,
  label: row.label,
  total: row.result.total,
  detail: row.result.detail,
  critical: row.result.critical,
  dice: row.result.dice,
  visibility: row.visibility,
  createdAt: row.createdAt.toISOString()
})

export const diceActions = [
  implement(rollDice, async (ctx, input) => {
    const campaign = await authorizedCampaign(ctx, 'dice.roll', input.campaignId)
    const master = isMaster(ctx, campaign)
    // El máster puede cualquiera (la web le ofrece todos u oculta); los jugadores, las suyas
    if (!master && !visibilitiesFor('player').includes(input.visibility)) {
      throw new InvalidRequestError('VISIBILITY_NOT_ALLOWED')
    }
    // Los críticos, los del juego de la campaña (sin sistema, los del d20)
    const result = rolled(input.formula, await criticalRuleOf(ctx, campaign.system))
    const row = await diceRepo.insertRoll(ctx.db, ROLLS_PER_MINUTE, {
      campaignId: campaign.id,
      worldId: campaign.worldId,
      userId: ctx.actor.userId,
      ai: ctx.via === 'ai',
      formula: result.formula,
      label: result.comment ?? null,
      visibility: input.visibility,
      result: {
        total: result.total,
        detail: result.detail,
        critical: result.critical,
        dice: diceOf(result)
      }
    })
    if (!row) throw new TooManyRequestsError('TOO_MANY_ROLLS')
    const view = present(row)
    // En vivo, a quien la puede ver: una pública, a la campaña; una privada, a quien tira y al máster (una vez)
    const target = { campaignId: campaign.id, worldId: campaign.worldId }
    const message = { type: 'rolled' as const, campaignId: campaign.id, roll: view }
    if (view.visibility === 'all') ctx.realtime.publish({ to: { capability: 'dice.read', target }, message })
    else if (master) ctx.realtime.publish({ to: { capability: 'dice.private', target }, message })
    else {
      ctx.realtime.publish(
        { to: { userId: ctx.actor.userId }, message },
        { to: { capability: 'dice.private', target }, message }
      )
    }
    return { roll: view }
  }),

  implement(listRolls, async (ctx, input) => {
    const campaign = await authorizedCampaign(ctx, 'dice.read', input.campaignId)
    const page = await diceRepo.listRolls(ctx.db, {
      campaignId: campaign.id,
      viewerId: ctx.actor.userId,
      master: isMaster(ctx, campaign),
      before: input.before
    })
    return { rolls: page.rolls.map(present), next: page.next }
  }),

  // Sin apuntarla: para probar una fórmula (la IA) o tirar en un mundo sin campañas. No guarda nada
  implement(tryDice, async (ctx, input) => {
    if (tooManyTries(ctx.actor.userId)) throw new TooManyRequestsError('TOO_MANY_ROLLS')
    const result = rolled(input.formula, input.critical)
    return {
      formula: result.formula,
      label: result.comment ?? null,
      total: result.total,
      detail: result.detail,
      critical: result.critical,
      dice: diceOf(result)
    }
  })
]

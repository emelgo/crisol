/**
 * Las tiradas de una campaña (ADR-0010): el servidor pone el azar, guarda la tirada ya resuelta y la deja leer a quien
 * la puede ver. Las privadas, solo a quien tira y al máster
 */
import { type DiceRoll, listRolls, type RollVisibility, rollDice } from '@crisol/contracts'
import { diceRepo } from '@crisol/db'
import { cryptoRoller, DiceSyntaxError, rollDice as roll } from '@crisol/dice'
import { can } from '@crisol/domain'
import { authorizedCampaign } from './access.ts'
import { type ActionContext, InvalidRequestError, TooManyRequestsError } from './context.ts'
import { implement } from './registry.ts'

/** Lo que puede usar cada uno: los jugadores, todos, para mí y al máster; el máster, todos y oculta */
const ALLOWED: Record<'master' | 'player', readonly RollVisibility[]> = {
  master: ['all', 'hidden'],
  player: ['all', 'self', 'master']
}

/** Como mucho, tantas por minuto y persona: se cuentan en la tabla, así vale con varias instancias */
export const ROLLS_PER_MINUTE = 60

const isMaster = (ctx: ActionContext, campaign: { id: string; worldId: string }) =>
  can(ctx.actor, 'dice.private', { campaignId: campaign.id, worldId: campaign.worldId })

type Row = Awaited<ReturnType<typeof diceRepo.insertRoll>>

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
    if (!ALLOWED[master ? 'master' : 'player'].includes(input.visibility)) {
      throw new InvalidRequestError('VISIBILITY_NOT_ALLOWED')
    }
    if ((await diceRepo.countSince(ctx.db, ctx.actor.userId, new Date(Date.now() - 60_000))) >= ROLLS_PER_MINUTE) {
      throw new TooManyRequestsError('TOO_MANY_ROLLS')
    }
    let result: ReturnType<typeof roll>
    try {
      result = roll(input.formula, cryptoRoller)
    } catch (error) {
      if (error instanceof DiceSyntaxError) throw new InvalidRequestError('BAD_FORMULA', error.message)
      throw error
    }
    const row = await diceRepo.insertRoll(ctx.db, {
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
        dice: result.terms.flatMap((term) =>
          term.dice.map((d) => ({ sides: term.sides, value: d.value, kept: d.kept }))
        )
      }
    })
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
  })
]

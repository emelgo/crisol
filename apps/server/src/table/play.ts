/**
 * Lo que puede hacer un jugador en la Mesa (docs/specs/mover-jugadores.md, ADR-0022 § 5): mover sus fichas y las que
 * le asignan, abrir puertas y pasar su turno, según la pausa, el modo de movimiento y el combate. El máster, todo
 */
import { combatsRepo, type Database, scenesRepo, tokensRepo } from '@crisol/db'
import { can, ForbiddenError, tableActionAllowed } from '@crisol/domain'
import { type ActionContext, InvalidRequestError } from '../actions/context.ts'

export interface TablePlayContext {
  master: boolean
  userId: string
  table: scenesRepo.CampaignTableRow
  /** Quiénes llevan a cada personaje y criatura en juego, por su id */
  controllers: Map<string, string[]>
  /** Con combate, quiénes llevan al combatiente activo (vacío antes del primer turno); null sin combate */
  activeControllers: string[] | null
}

/** Quiénes llevan al combatiente activo: el del turno y, si va en grupo, los de su grupo */
export async function activeControllersOf(
  db: Database,
  combat: Pick<combatsRepo.CombatRow, 'id' | 'round' | 'turnId'>,
  controllers: ReadonlyMap<string, readonly string[]>
): Promise<string[]> {
  if (combat.round <= 0 || !combat.turnId) return []
  const rows = await combatsRepo.listCombatants(db, combat.id)
  const turn = rows.find((r) => r.id === combat.turnId)
  if (!turn) return []
  const members = turn.group === null ? [turn] : rows.filter((r) => r.group === turn.group)
  return [...new Set(members.flatMap((m) => controllers.get(m.characterId ?? m.creatureId ?? '') ?? []))]
}

/** Lo que decide qué puede hacer quien pide en la Mesa de la campaña (ya autorizada para leerla) */
export async function tablePlayOf(
  ctx: ActionContext,
  campaign: { id: string; worldId: string }
): Promise<TablePlayContext> {
  const master = can(ctx.actor, 'table.manage', { campaignId: campaign.id, worldId: campaign.worldId })
  const [table, controllers, combat] = await Promise.all([
    scenesRepo.campaignTable(ctx.db, campaign.id),
    tokensRepo.controllersOf(ctx.db, campaign.id),
    combatsRepo.findCombat(ctx.db, campaign.id)
  ])
  const activeControllers = combat ? await activeControllersOf(ctx.db, combat, controllers) : null
  return { master, userId: ctx.actor.userId, table, controllers, activeControllers }
}

const REJECTED = {
  paused: ['PAUSED', 'la partida está en pausa'],
  locked: ['LOCKED', 'el máster ha bloqueado el movimiento'],
  notYourTurn: ['NOT_YOUR_TURN', 'no es su turno']
} as const

/**
 * Si quien pide puede hacer eso en la Mesa: con una ficha, quiénes la llevan; sin ella (una puerta), null. Lo ajeno,
 * Forbidden; la pausa, el bloqueo y el turno de otro, su código
 */
export function assertTablePlay(play: TablePlayContext, controllers: readonly string[] | null) {
  const verdict = tableActionAllowed({
    master: play.master,
    userId: play.userId,
    paused: play.table.paused,
    movement: play.table.movement,
    combat: play.activeControllers === null ? null : { activeControllers: play.activeControllers },
    controllers
  })
  if (verdict === 'ok') return
  if (verdict === 'notYours') throw new ForbiddenError('table.play')
  const [code, detail] = REJECTED[verdict]
  throw new InvalidRequestError(code, detail)
}

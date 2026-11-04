/**
 * Los sistemas de reglas (ADR-0011): los de serie, que viven en el código y no se cambian, y los de la cuenta, que se
 * hacen copiando otro (o «En blanco»), se cambian (validados enteros, con la versión que se tenía) y se borran. Todo lo
 * que escribe pasa por el historial
 */
import { randomUUID } from 'node:crypto'
import {
  createSystem,
  deleteSystem,
  getSystem,
  listSystems,
  type SystemFull,
  type SystemSummary,
  updateSystem
} from '@crisol/contracts'
import { systemsRepo } from '@crisol/db'
import { authorize, NotFoundError } from '@crisol/domain'
import { CATALOG, catalogSystem, type Problem, type System, textOf, validateSystem } from '@crisol/systems'
import { systemsChanged } from '../realtime/events.ts'
import { targetOrganization } from './access.ts'
import { type ActionContext, historyContext, InvalidRequestError } from './context.ts'
import { implement } from './registry.ts'

/** Hasta tantos por cuenta */
export const MAX_SYSTEMS = 50

const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

/** Lo que se ve de un sistema en la lista, sacado de su documento */
function summarize(
  document: System,
  extra: { id: string; builtIn: boolean; version: number; basedOn: SystemSummary['basedOn']; content: number }
): SystemSummary {
  return {
    ...extra,
    name: textOf(document.name),
    summary: textOf(document.summary),
    release: document.version,
    license: document.license ? `${textOf(document.license.name)} · ${document.license.license}` : null,
    types: Object.entries(document.types).map(([key, type]) => ({
      key,
      label: textOf(type.label) || key,
      document: type.document,
      fields: Object.keys(type.fields).length
    })),
    rolls: Object.entries(document.rolls ?? {}).map(([key, roll]) => ({ key, label: textOf(roll.label) || key })),
    campaigns: []
  }
}

const builtIn = (document: System): SystemFull => ({
  ...summarize(document, { id: document.id, builtIn: true, version: 1, basedOn: null, content: 0 }),
  document: structuredClone(document) as Record<string, unknown>
})

function own(row: systemsRepo.SystemRow, content: number, basedOnName: (id: string) => string): SystemFull {
  const document = row.document as unknown as System
  const basedOn = row.basedOn ? { ...row.basedOn, name: basedOnName(row.basedOn.id) } : null
  return {
    ...summarize(document, { id: row.id, builtIn: false, version: row.version, basedOn, content }),
    document: structuredClone(row.document)
  }
}

/** La organización de la que se ven los sistemas, si la cuenta puede verlos */
function readableOrganization(ctx: ActionContext, organizationId: string | undefined) {
  const target = targetOrganization(ctx, organizationId)
  authorize(ctx.actor, 'systems.read', { organizationId: target })
  return target
}

/** Uno propio que se puede cambiar: de una organización que la cuenta administra, y no borrado */
async function ownWritable(ctx: ActionContext, systemId: string) {
  const row = await systemsRepo.findSystem(ctx.db, systemId)
  if (!row || row.deletedAt) throw new NotFoundError('system')
  authorize(ctx.actor, 'systems.write', { organizationId: row.organizationId })
  return row
}

/** Uno de serie o de la cuenta, por su id; de la cuenta, solo si es de esa organización */
async function findReadable(ctx: ActionContext, organizationId: string, systemId: string) {
  const catalog = catalogSystem(systemId)
  if (catalog) return { document: catalog, row: null }
  if (!isUuid(systemId)) throw new NotFoundError('system')
  const row = await systemsRepo.findSystem(ctx.db, systemId)
  if (!row || row.deletedAt || row.organizationId !== organizationId) throw new NotFoundError('system')
  return { document: row.document as unknown as System, row }
}

/** El nombre de aquel del que salió uno (si aún existe) */
async function namer(ctx: ActionContext, rows: readonly systemsRepo.SystemRow[]) {
  const names = new Map<string, string>(CATALOG.map((s) => [s.id, textOf(s.name)]))
  for (const row of rows) names.set(row.id, textOf((row.document as unknown as System).name))
  const missing = rows.map((r) => r.basedOn?.id).filter((id): id is string => !!id && !names.has(id) && isUuid(id))
  for (const id of new Set(missing)) {
    const found = await systemsRepo.findSystem(ctx.db, id)
    if (found) names.set(id, textOf((found.document as unknown as System).name))
  }
  return (id: string) => names.get(id) ?? id
}

/** Validar entero; con errores no se guarda: la IA lee cada problema (dónde y por qué) en el detalle */
function validated(document: unknown): { system: System; warnings: Problem[] } {
  const { system, problems } = validateSystem(document)
  if (!system) {
    const errors = problems.filter((p) => p.severity === 'error')
    const detail = errors
      .slice(0, 20)
      .map((p) => `${p.path} (${p.where}): ${p.message}`)
      .join('; ')
    throw new InvalidRequestError(
      'SYSTEM_INVALID',
      errors.length > 20 ? `${detail}; y ${errors.length - 20} más` : detail
    )
  }
  return { system, warnings: problems.filter((p) => p.severity === 'warning') }
}

export const systemActions = [
  implement(listSystems, async (ctx, { organizationId }) => {
    const target = readableOrganization(ctx, organizationId)
    const rows = await systemsRepo.listSystems(ctx.db, target)
    const counts = await systemsRepo.contentCounts(
      ctx.db,
      rows.map((r) => r.id)
    )
    const name = await namer(ctx, rows)
    const mine = rows.map((row) => {
      const { document: _, ...summary } = own(row, counts.get(row.id) ?? 0, name)
      return summary
    })
    const serie = CATALOG.map((s) => {
      const { document: _, ...summary } = builtIn(s)
      return summary
    })
    return { systems: [...serie, ...mine] }
  }),

  implement(getSystem, async (ctx, { systemId, organizationId }) => {
    const target = readableOrganization(ctx, organizationId)
    const { document, row } = await findReadable(ctx, target, systemId)
    if (!row) return builtIn(document)
    const counts = await systemsRepo.contentCounts(ctx.db, [row.id])
    return own(row, counts.get(row.id) ?? 0, await namer(ctx, [row]))
  }),

  implement(createSystem, async (ctx, { organizationId, name, from }) => {
    const target = targetOrganization(ctx, organizationId)
    authorize(ctx.actor, 'systems.write', { organizationId: target })
    if ((await systemsRepo.countSystems(ctx.db, target)) >= MAX_SYSTEMS)
      throw new InvalidRequestError('TOO_MANY_SYSTEMS', `como mucho, ${MAX_SYSTEMS} por cuenta`)
    const source = await findReadable(ctx, target, from)
    const id = randomUUID()
    // La copia es de la cuenta: su id es el suyo y su nombre, el que se le da
    const { system } = validated({ ...structuredClone(source.document), id, name })
    const content = source.row
      ? (await systemsRepo.listContent(ctx.db, source.row.id)).map(({ type, key, source: s, data }) => ({
          type,
          key,
          source: s,
          data
        }))
      : []
    const row = await systemsRepo.createSystem(
      ctx.db,
      historyContext(ctx, 'createSystem', { name, from: textOf(source.document.name) }, { organizationId: target }),
      {
        id,
        organizationId: target,
        basedOn: { id: source.row ? source.row.id : source.document.id, version: source.row ? source.row.version : 1 },
        document: system as unknown as Record<string, unknown>
      },
      content
    )
    ctx.realtime.publish(systemsChanged(target))
    return own(row, content.length, await namer(ctx, [row]))
  }),

  implement(updateSystem, async (ctx, { systemId, version, document, name }) => {
    if (!document && name === undefined)
      throw new InvalidRequestError('NOTHING_TO_CHANGE', 'da el documento o el nombre')
    const row = await ownWritable(ctx, systemId)
    // Su id es siempre el suyo, lo diga o no el documento
    const next = { ...structuredClone(document ?? row.document), id: row.id, ...(name !== undefined ? { name } : {}) }
    const { system, warnings } = validated(next)
    let updated: systemsRepo.SystemRow
    try {
      updated = await systemsRepo.updateSystem(
        ctx.db,
        historyContext(ctx, 'updateSystem', { name: textOf(system.name) }, { organizationId: row.organizationId }),
        row.id,
        version,
        system as unknown as Record<string, unknown>
      )
    } catch (error) {
      if (error instanceof systemsRepo.SystemChangedError)
        throw new InvalidRequestError('SYSTEM_CHANGED', 'lo ha cambiado otro mientras tanto: vuelve a leerlo')
      throw error
    }
    ctx.realtime.publish(systemsChanged(row.organizationId))
    const counts = await systemsRepo.contentCounts(ctx.db, [row.id])
    return { system: own(updated, counts.get(row.id) ?? 0, await namer(ctx, [updated])), warnings }
  }),

  implement(deleteSystem, async (ctx, { systemId }) => {
    const row = await ownWritable(ctx, systemId)
    const name = textOf((row.document as unknown as System).name)
    await systemsRepo.deleteSystem(
      ctx.db,
      historyContext(ctx, 'deleteSystem', { name }, { organizationId: row.organizationId }),
      row.id
    )
    ctx.realtime.publish(systemsChanged(row.organizationId))
    return { id: row.id, name }
  })
]

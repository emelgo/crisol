/**
 * Los sistemas de reglas (ADR-0011): los de serie, que viven en el código y no se cambian, y los de la cuenta, que se
 * hacen copiando otro (o «En blanco»), se cambian (validados enteros, con la versión que se tenía) y se borran. Todo lo
 * que escribe pasa por el historial
 */
import { randomUUID } from 'node:crypto'
import {
  checkSystem,
  createSystem,
  deleteSystem,
  deleteSystemContent,
  exportSystem,
  getSystem,
  getSystemContent,
  getSystemFormat,
  getSystemParts,
  importSystem,
  listSystems,
  putSystemContent,
  type SystemFull,
  type SystemSummary,
  searchSystemContent,
  tryFormula,
  trySystemAction,
  trySystemRoll,
  updateSystem
} from '@crisol/contracts'
import { campaignsRepo, systemsRepo } from '@crisol/db'
import { type CriticalRule, cryptoRoller, DiceSyntaxError } from '@crisol/dice'
import { authorize, can, NotFoundError } from '@crisol/domain'
import {
  applyChanges,
  CATALOG,
  ChangeError,
  type ContentItem,
  catalogSystem,
  type DocumentItem,
  FORMAT,
  fileName,
  fitsFormat,
  type Language,
  LIMITS,
  type Mechanics,
  normalizeChoices,
  type Problem,
  pickPaths,
  prepareAction,
  RollError,
  SYSTEM_FILE,
  type System,
  type SystemDocument,
  type SystemFile,
  searchContent,
  systemDocs,
  systemOverview,
  textOf,
  toFile,
  tryAction,
  tryFormula as tryFormulaIn,
  tryRoll,
  validateContent,
  validateFile,
  validateSystem
} from '@crisol/systems'
import { catalogContent } from '@crisol/systems/catalog/content'
import { systemsChanged } from '../realtime/events.ts'
import { authorizedCampaign, targetOrganization } from './access.ts'
import { type ActionContext, historyContext, InvalidRequestError, TooManyRequestsError } from './context.ts'
import { implement } from './registry.ts'
import { tooManyTries } from './tries.ts'

/** Hasta tantos por cuenta */
export const MAX_SYSTEMS = 50

const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

/** Lo que se ve de un sistema en la lista, sacado de su documento */
function summarize(
  document: System,
  extra: { id: string; builtIn: boolean; version: number; basedOn: SystemSummary['basedOn']; content: number }
): SystemSummary {
  const { defaultRoll: _, critical: __, ...overview } = systemOverview(document)
  // En la lista, el resumen corto: el entero está en el sistema (y la lista la lee la IA de cualquier sistema subido)
  const summary = overview.summary.length > 300 ? `${overview.summary.slice(0, 299)}…` : overview.summary
  return { ...extra, ...overview, summary, campaigns: [] }
}

const builtIn = (document: System): SystemFull => ({
  ...summarize(document, {
    id: document.id,
    builtIn: true,
    version: 1,
    basedOn: null,
    content: catalogContent(document.id).length
  }),
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
export async function ownWritable(ctx: ActionContext, systemId: string) {
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

/** Un documento del contenido guardado, con lo que tenga (su concepto, su mecánica y su página, si los hay) */
export const contentOf = (row: {
  type: string
  key: string
  source: string | null
  data: Record<string, unknown>
  concept: string | null
  mechanics: Record<string, unknown> | null
  ref: Record<string, unknown> | null
}): ContentItem =>
  ({
    type: row.type,
    key: row.key,
    source: row.source,
    data: row.data,
    ...(row.concept !== null ? { concept: row.concept } : {}),
    ...(row.mechanics !== null ? { mechanics: row.mechanics } : {}),
    ...(row.ref !== null ? { ref: row.ref } : {})
  }) as ContentItem

/** Todo el contenido de un sistema: el de serie, del código; el de la cuenta, de la base de datos */
async function allContent(ctx: ActionContext, found: { document: System; row: systemsRepo.SystemRow | null }) {
  return found.row
    ? (await systemsRepo.listContent(ctx.db, found.row.id)).map(contentOf)
    : [...catalogContent(found.document.id)]
}

/** Lo que se guarda de un documento del contenido */
const toValues = (item: ContentItem): systemsRepo.ContentValues => ({
  type: item.type,
  key: item.key,
  source: item.source,
  data: item.data,
  concept: item.concept ?? null,
  mechanics: (item.mechanics as Record<string, unknown> | undefined) ?? null,
  ref: (item.ref as Record<string, unknown> | undefined) ?? null
})

/**
 * El nombre de un sistema que la cuenta ve, para el resumen de lo que la IA pide aprobar: si no lo ve, para ella no
 * existe y no se pide nada
 */
export async function visibleSystemName(ctx: ActionContext, systemId: string) {
  const catalog = catalogSystem(systemId)
  if (catalog) return textOf(catalog.name)
  const row = isUuid(systemId) ? await systemsRepo.findSystem(ctx.db, systemId) : null
  if (!row || row.deletedAt || !can(ctx.actor, 'systems.read', { organizationId: row.organizationId }))
    throw new NotFoundError('system')
  return textOf((row.document as unknown as System).name)
}

/**
 * Lo que la IA pide hacer con un sistema, comprobado antes de pedir la aprobación: que la cuenta lo pueda hacer y que lo
 * que se guardaría valga (si no, se dice ya, con cada problema). Da los nombres para la cola: el que tendrá y el del
 * sistema que toca
 */
export async function systemRequest(ctx: ActionContext, action: string, input: Record<string, unknown>) {
  switch (action) {
    case 'createSystem': {
      if (input.document && typeof input.document === 'object') {
        const named = { ...(input.document as Record<string, unknown>), id: 'nuevo' }
        const { system } = validated(typeof input.name === 'string' ? { ...named, name: input.name } : named)
        return { name: textOf(system.name) }
      }
      return { name: input.name, system: await visibleSystemName(ctx, String(input.from ?? 'blank')) }
    }
    case 'importSystem': {
      const { file, problems } = validateFile(input.file)
      if (!file) return invalid(problems)
      const into = input.into as { systemId?: unknown } | undefined
      if (typeof into?.systemId !== 'string') return { name: textOf(file.system.name) }
      const row = await ownWritable(ctx, into.systemId)
      return { name: textOf(file.system.name), system: textOf((row.document as unknown as System).name) }
    }
    case 'updateSystem': {
      const row = await ownWritable(ctx, String(input.systemId))
      const changes = input.changes as { path: string; value?: unknown; remove?: boolean }[] | undefined
      const base = changes
        ? byPath('BAD_SYSTEM_CHANGE', () => applyChanges(row.document, changes))
        : ((input.document as Record<string, unknown> | undefined) ?? row.document)
      validated({ ...base, id: row.id, ...(typeof input.name === 'string' ? { name: input.name } : {}) })
      return { system: textOf((row.document as unknown as System).name) }
    }
    case 'deleteSystem': {
      const row = await ownWritable(ctx, String(input.systemId))
      return { system: textOf((row.document as unknown as System).name) }
    }
    // El contenido: comprobado ya (con un error, no se pide), y cuántos documentos
    case 'putSystemContent': {
      const row = await ownWritable(ctx, String(input.systemId))
      const items = (Array.isArray(input.items) ? input.items : []) as ContentItem[]
      const problems = validateContent(row.document as unknown as System, items)
      if (problems.some((p) => p.severity === 'error')) invalid(problems)
      return { system: textOf((row.document as unknown as System).name), count: items.length }
    }
    case 'deleteSystemContent': {
      const row = await ownWritable(ctx, String(input.systemId))
      return {
        system: textOf((row.document as unknown as System).name),
        count: Array.isArray(input.keys) ? input.keys.length : 0
      }
    }
    default:
      return {}
  }
}

/**
 * Las campañas que usan cada sistema. Para enseñarlas (visible), solo las que la cuenta ve: un máster no sabe de las
 * campañas de los mundos que no son suyos. Para no borrar uno en uso, todas
 */
async function usedBy(ctx: ActionContext, ids: readonly string[], visibleIn: string | null = null) {
  const using = new Map<string, { id: string; name: string }[]>()
  // El propietario de la organización las ve todas
  const all = visibleIn === null || can(ctx.actor, 'systems.write', { organizationId: visibleIn })
  for (const c of await campaignsRepo.campaignsUsingSystems(ctx.db, ids)) {
    if (!all && !can(ctx.actor, 'campaign.read', { campaignId: c.id, worldId: c.worldId })) continue
    const list = using.get(c.system as string) ?? []
    list.push({ id: c.id, name: c.name })
    using.set(c.system as string, list)
  }
  return using
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

/** Lo que una campaña dice de su sistema: su nombre, su tirada por defecto y su regla de críticos */
export interface CampaignSystem {
  id: string
  name: string
  defaultRoll: string | null
  critical: CriticalRule
}

const campaignSystem = (id: string, document: System): CampaignSystem => ({
  id,
  name: textOf(document.name),
  defaultRoll: document.dice?.default ?? null,
  critical: document.dice?.critical ?? 'd20'
})

/**
 * Lo que las campañas dicen de su sistema, por id y versión: se lee el documento (hasta 2 MB) solo la primera vez, y no
 * con cada tirada. Una versión nueva es otra entrada; las viejas salen cuando hay demasiadas
 */
const known = new Map<string, CampaignSystem>()
const KNOWN_MAX = 500

/** Los sistemas de unas campañas, por su id (los de serie, del código; los propios, de la base de datos) */
export async function campaignSystems(ctx: ActionContext, ids: readonly (string | null)[]) {
  const found = new Map<string, CampaignSystem>()
  const own: string[] = []
  for (const id of new Set(ids)) {
    if (!id) continue
    const catalog = catalogSystem(id)
    if (catalog) found.set(id, campaignSystem(id, catalog))
    else if (isUuid(id)) own.push(id)
  }
  const missing: string[] = []
  for (const row of await systemsRepo.systemVersions(ctx.db, own)) {
    if (row.deletedAt) continue
    const cached = known.get(`${row.id}:${row.version}`)
    if (cached) found.set(row.id, cached)
    else missing.push(row.id)
  }
  for (const row of await systemsRepo.findSystems(ctx.db, missing)) {
    if (row.deletedAt) continue
    const seen = campaignSystem(row.id, row.document as unknown as System)
    found.set(row.id, seen)
    if (known.size >= KNOWN_MAX) known.delete(known.keys().next().value as string)
    known.set(`${row.id}:${row.version}`, seen)
  }
  return found
}

/** La regla de críticos con la que se tira en una campaña (sin sistema, la del d20, como siempre) */
export async function criticalRuleOf(ctx: ActionContext, systemId: string | null): Promise<CriticalRule> {
  if (!systemId) return 'd20'
  return (await campaignSystems(ctx, [systemId])).get(systemId)?.critical ?? 'd20'
}

/**
 * El sistema que elige una campaña y lo que elige de él, comprobados: el sistema, de serie o de la cuenta del mundo; lo
 * elegido, completo (lo que falta, con su valor inicial). Sin cambio, null
 */
export async function chosenSystem(
  ctx: ActionContext,
  organizationId: string,
  given: { system?: string | null | undefined; systemChoices?: Record<string, unknown> | undefined },
  current: { system: string | null; systemChoices: unknown } = { system: null, systemChoices: null }
) {
  if (given.system === undefined && given.systemChoices === undefined) return null
  const target = given.system !== undefined ? given.system : current.system
  if (target === null) {
    if (given.systemChoices) throw new InvalidRequestError('NO_SYSTEM', 'la campaña no tiene sistema del que elegir')
    return { system: null, systemChoices: null }
  }
  let document: System
  try {
    document = (await findReadable(ctx, organizationId, target)).document
  } catch (error) {
    if (error instanceof NotFoundError) throw new InvalidRequestError('BAD_SYSTEM', `no existe el sistema «${target}»`)
    throw error
  }
  // Al cambiar de sistema se empieza de cero; si no, sobre lo que ya tenía
  const base = target === current.system ? ((current.systemChoices ?? {}) as Record<string, unknown>) : {}
  const { choices, problems } = normalizeChoices(document, { ...base, ...(given.systemChoices ?? {}) })
  if (problems.length > 0) throw new InvalidRequestError('BAD_SYSTEM_CHOICES', problems.join('; '))
  return { system: target, systemChoices: choices, name: textOf(document.name) }
}

/** Con errores no se guarda: la IA lee cada problema (dónde y por qué) en el detalle */
export function invalid(problems: readonly Problem[]): never {
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

/** Validar entero */
function validated(document: unknown): { system: System; warnings: Problem[] } {
  const { system, problems } = validateSystem(document)
  if (!system) return invalid(problems)
  return { system, warnings: problems.filter((p) => p.severity === 'warning') }
}

const changed = () => new InvalidRequestError('SYSTEM_CHANGED', 'lo ha cambiado otro mientras tanto: vuelve a leerlo')

const tooMany = () => new InvalidRequestError('TOO_MANY_SYSTEMS', `como mucho, ${MAX_SYSTEMS} por cuenta`)

/** Crear, con el tope contado dentro de la transacción */
async function atMost<T>(create: () => Promise<T>): Promise<T> {
  try {
    return await create()
  } catch (error) {
    if (error instanceof systemsRepo.TooManySystemsError) throw tooMany()
    throw error
  }
}

/** Lo que no se puede hacer en una ruta (que no exista, que no sea un objeto…), dicho para la IA */
function byPath<T>(code: string, run: () => T): T {
  try {
    return run()
  } catch (error) {
    if (error instanceof ChangeError) throw new InvalidRequestError(code, error.message)
    throw error
  }
}

/** El documento de prueba que llega, con lo que falte vacío */
type TestGiven = {
  content?: string | undefined
  data?: Record<string, unknown> | undefined
  mechanics?: Record<string, unknown> | undefined
  items?:
    | {
        id: string
        content?: string | undefined
        type?: string | undefined
        name?: string | undefined
        data?: Record<string, unknown> | undefined
        mechanics?: Record<string, unknown> | undefined
        from?: string | undefined
        choices?: Record<string, string[]> | undefined
        uses?: Record<string, number> | undefined
      }[]
    | undefined
}

/** Un texto en sus idiomas ({ es, en }): en un documento del contenido, se queda el del idioma que se pide */
const isText = (v: unknown): v is Record<string, string> =>
  typeof v === 'object' &&
  v !== null &&
  !Array.isArray(v) &&
  Object.keys(v).length > 0 &&
  Object.entries(v).every(([k, x]) => (k === 'es' || k === 'en') && typeof x === 'string')
const localized = (data: Record<string, unknown>, language: Language) =>
  Object.fromEntries(Object.entries(data).map(([k, v]) => [k, isText(v) ? textOf(v, language) : v]))

/**
 * El documento de prueba: lo escrito, y lo que viene del contenido del sistema por su clave (su tipo, su nombre, sus
 * valores en el idioma que se pide y su mecánica), con lo escrito encima
 */
async function testDocument(
  ctx: ActionContext,
  found: { document: System; row: systemsRepo.SystemRow | null } | null,
  given: TestGiven | undefined,
  language: Language = 'es'
): Promise<SystemDocument> {
  const keys = [given?.content, ...(given?.items ?? []).map((i) => i.content)].filter((k): k is string => Boolean(k))
  const content = new Map<string, ContentItem>()
  if (keys.length > 0) {
    if (!found)
      throw new InvalidRequestError('BAD_TEST_DOCUMENT', 'con un borrador no hay contenido del que sacar documentos')
    const items = found.row
      ? (await systemsRepo.contentByKeys(ctx.db, found.row.id, keys)).map(contentOf)
      : catalogContent(found.document.id).filter((c) => keys.includes(c.key))
    for (const c of items) content.set(c.key, c)
    const missing = keys.filter((k) => !content.has(k))
    if (missing.length > 0)
      throw new InvalidRequestError('BAD_TEST_DOCUMENT', `no está en el contenido: ${missing.join(', ')}`)
  }
  const own = given?.content ? content.get(given.content) : undefined
  const mechanics = given?.mechanics ?? own?.mechanics
  return {
    data: { ...(own ? localized(own.data, language) : {}), ...(given?.data ?? {}) },
    ...(mechanics ? { mechanics: mechanics as Mechanics } : {}),
    items: (given?.items ?? []).map((item): DocumentItem => {
      const from = item.content ? content.get(item.content) : undefined
      const data = { ...(from ? localized(from.data, language) : {}), ...(item.data ?? {}) }
      const itemMechanics = item.mechanics ?? from?.mechanics
      return {
        id: item.id,
        type: item.type ?? from?.type ?? '',
        name: item.name ?? (from ? textOf(from.data.name as never, language) : item.id),
        data,
        ...(itemMechanics ? { mechanics: itemMechanics as Mechanics } : {}),
        ...(item.from ? { from: item.from } : {}),
        ...(item.choices ? { choices: item.choices } : {}),
        ...(item.uses ? { uses: item.uses } : {})
      }
    })
  }
}

/** La documentación del formato: sale del esquema, que no cambia mientras corre el servidor */
let docs: string | null = null
export const formatDocs = () => {
  docs ??= systemDocs()
  return docs
}

/** Un nombre nuevo, sin perder los demás idiomas: en un texto por idiomas cambia el español */
const withName = (current: unknown, name: string) =>
  current && typeof current === 'object' ? { ...(current as Record<string, string>), es: name } : name

/** Los problemas, como los da el contrato */
const asProblems = (problems: readonly Problem[]) =>
  problems.map(({ path, where, message, severity }) => ({ path, where, message, severity }))

/**
 * Guarda un archivo de sistema ya validado (subido o traído de Foundry): uno nuevo en la cuenta o, con into, encima de
 * uno propio (su documento y todo su contenido, con la versión que se tenía)
 */
export async function saveFile(
  ctx: ActionContext,
  valid: SystemFile,
  warnings: Problem[],
  {
    organizationId,
    into
  }: { organizationId?: string | undefined; into?: { systemId: string; version: number } | undefined }
) {
  const name = textOf(valid.system.name)
  if (into) {
    const row = await ownWritable(ctx, into.systemId)
    let updated: systemsRepo.SystemRow
    try {
      updated = await systemsRepo.updateSystem(
        ctx.db,
        historyContext(ctx, 'importSystem', { name }, { organizationId: row.organizationId }),
        row.id,
        into.version,
        { ...valid.system, id: row.id } as unknown as Record<string, unknown>,
        valid.content.map(toValues)
      )
    } catch (error) {
      if (error instanceof systemsRepo.SystemChangedError) throw changed()
      throw error
    }
    ctx.realtime.publish(systemsChanged(row.organizationId))
    return { system: own(updated, valid.content.length, await namer(ctx, [updated])), warnings }
  }
  const target = targetOrganization(ctx, organizationId)
  authorize(ctx.actor, 'systems.write', { organizationId: target })
  if ((await systemsRepo.countSystems(ctx.db, target)) >= MAX_SYSTEMS)
    throw new InvalidRequestError('TOO_MANY_SYSTEMS', `como mucho, ${MAX_SYSTEMS} por cuenta`)
  const id = randomUUID()
  const row = await atMost(() =>
    systemsRepo.createSystem(
      ctx.db,
      historyContext(ctx, 'importSystem', { name }, { organizationId: target }),
      {
        id,
        organizationId: target,
        basedOn: null,
        document: { ...valid.system, id } as unknown as Record<string, unknown>
      },
      valid.content.map(toValues),
      MAX_SYSTEMS
    )
  )
  ctx.realtime.publish(systemsChanged(target))
  return { system: own(row, valid.content.length, await namer(ctx, [row])), warnings }
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
    const using = await usedBy(
      ctx,
      rows.map((r) => r.id),
      target
    )
    const mine = rows.map((row) => {
      const { document: _, ...summary } = own(row, counts.get(row.id) ?? 0, name)
      return { ...summary, campaigns: using.get(row.id) ?? [] }
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
    const using = await usedBy(ctx, [row.id], target)
    return { ...own(row, counts.get(row.id) ?? 0, await namer(ctx, [row])), campaigns: using.get(row.id) ?? [] }
  }),

  implement(createSystem, async (ctx, { organizationId, name, from, document }) => {
    const target = targetOrganization(ctx, organizationId)
    authorize(ctx.actor, 'systems.write', { organizationId: target })
    if ((await systemsRepo.countSystems(ctx.db, target)) >= MAX_SYSTEMS)
      throw new InvalidRequestError('TOO_MANY_SYSTEMS', `como mucho, ${MAX_SYSTEMS} por cuenta`)
    // Con su documento, desde cero; si no, copiando otro
    const source = document
      ? { document: document as unknown as System, row: null, fresh: true }
      : { ...(await findReadable(ctx, target, from)), fresh: false }
    const id = randomUUID()
    // La copia es de la cuenta: su id es el suyo y su nombre, el que se le da
    const { system } = validated({ ...structuredClone(source.document), id, ...(name !== undefined ? { name } : {}) })
    // Copiando otro, con todo su contenido (también el de uno de serie)
    const content = source.fresh ? [] : (await allContent(ctx, source)).map(toValues)
    const row = await atMost(() =>
      systemsRepo.createSystem(
        ctx.db,
        historyContext(
          ctx,
          'createSystem',
          { name: textOf(system.name), ...(source.fresh ? {} : { from: textOf(source.document.name) }) },
          { organizationId: target }
        ),
        {
          id,
          organizationId: target,
          basedOn: source.fresh
            ? null
            : { id: source.row ? source.row.id : source.document.id, version: source.row ? source.row.version : 1 },
          document: system as unknown as Record<string, unknown>
        },
        content,
        MAX_SYSTEMS
      )
    )
    ctx.realtime.publish(systemsChanged(target))
    return own(row, content.length, await namer(ctx, [row]))
  }),

  implement(updateSystem, async (ctx, { systemId, version, changes, document, name }) => {
    if (!document && !changes && name === undefined)
      throw new InvalidRequestError('NOTHING_TO_CHANGE', 'da los cambios, el documento o el nombre')
    if (document && changes) throw new InvalidRequestError('BAD_SYSTEM_CHANGE', 'o el documento entero o los cambios')
    const row = await ownWritable(ctx, systemId)
    // Los cambios, sobre lo guardado (con la versión que se tenía: si otro lo cambió, no se guarda)
    const base = changes
      ? byPath('BAD_SYSTEM_CHANGE', () =>
          applyChanges(row.document, changes as { path: string; value?: unknown; remove?: boolean }[])
        )
      : (document ?? row.document)
    // Su id es siempre el suyo, lo diga o no el documento
    const next = {
      ...structuredClone(base),
      id: row.id,
      ...(name !== undefined ? { name: withName((base as { name?: unknown }).name, name) } : {})
    }
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
      if (error instanceof systemsRepo.SystemChangedError) throw changed()
      throw error
    }
    ctx.realtime.publish(systemsChanged(row.organizationId))
    const counts = await systemsRepo.contentCounts(ctx.db, [row.id])
    return { system: own(updated, counts.get(row.id) ?? 0, await namer(ctx, [updated])), warnings }
  }),

  implement(deleteSystem, async (ctx, { systemId }) => {
    const row = await ownWritable(ctx, systemId)
    const using = (await usedBy(ctx, [row.id])).get(row.id) ?? []
    if (using.length > 0)
      throw new InvalidRequestError(
        'SYSTEM_IN_USE',
        `lo usa${using.length > 1 ? 'n' : ''} ${using.map((c) => `«${c.name}»`).join(', ')}`
      )
    const name = textOf((row.document as unknown as System).name)
    await systemsRepo.deleteSystem(
      ctx.db,
      historyContext(ctx, 'deleteSystem', { name }, { organizationId: row.organizationId }),
      row.id
    )
    ctx.realtime.publish(systemsChanged(row.organizationId))
    return { id: row.id, name }
  }),

  implement(exportSystem, async (ctx, { systemId, organizationId }) => {
    const target = readableOrganization(ctx, organizationId)
    const found = await findReadable(ctx, target, systemId)
    const content = await allContent(ctx, found)
    return {
      name: fileName(found.document),
      file: toFile(found.document, content) as unknown as Record<string, unknown>
    }
  }),

  implement(searchSystemContent, async (ctx, { systemId, organizationId, campaignId, ...given }) => {
    const target = readableOrganization(ctx, organizationId)
    const found = await findReadable(ctx, target, systemId)
    // Con una campaña de ese sistema: sus fuentes, lo repetido y su idioma, salvo lo que se diga
    let options: Parameters<typeof searchContent>[2] = given
    if (campaignId) {
      const campaign = await authorizedCampaign(ctx, 'campaign.read', campaignId)
      if (campaign.system !== systemId) throw new InvalidRequestError('BAD_CAMPAIGN', 'esa campaña no usa este sistema')
      const { choices } = normalizeChoices(found.document, (campaign.systemChoices ?? {}) as Record<string, unknown>)
      options = { sources: choices.sources, duplicates: choices.duplicates, language: choices.language, ...given }
    }
    // Para buscar basta lo de cada documento que se ve en la lista: el de la cuenta, sin leerlo entero
    const entries = found.row
      ? await systemsRepo.contentIndex(ctx.db, found.row.id)
      : catalogContent(found.document.id).map((item) => ({
          key: item.key,
          type: item.type,
          source: item.source,
          concept: item.concept ?? null,
          name: item.data.name,
          automation: item.mechanics?.automation ?? null
        }))
    return searchContent(found.document, entries, options)
  }),

  implement(getSystemContent, async (ctx, { systemId, organizationId, keys }) => {
    const target = readableOrganization(ctx, organizationId)
    const found = await findReadable(ctx, target, systemId)
    const wanted = [...new Set(keys)]
    const items = found.row
      ? (await systemsRepo.contentByKeys(ctx.db, found.row.id, wanted)).map(contentOf)
      : catalogContent(found.document.id).filter((item) => wanted.includes(item.key))
    const byKey = new Map(items.map((item) => [item.key, item]))
    return {
      items: wanted.flatMap((k) => {
        const item = byKey.get(k)
        return item ? [structuredClone(item)] : []
      }),
      missing: wanted.filter((k) => !byKey.has(k))
    }
  }),

  implement(trySystemAction, async (ctx, input) => {
    if (tooManyTries(ctx.actor.userId)) throw new TooManyRequestsError('TOO_MANY_ROLLS')
    const target = readableOrganization(ctx, input.organizationId)
    const found = await findReadable(ctx, target, input.systemId)
    const system = found.document
    const typeKey = input.type ?? Object.entries(system.types).find(([, t]) => t.document === 'actor')?.[0]
    if (!typeKey || !Object.hasOwn(system.types, typeKey))
      throw new InvalidRequestError(
        'BAD_SYSTEM_TYPE',
        input.type ? `no existe el tipo «${input.type}»` : 'no tiene personajes'
      )
    const language = input.language ?? 'es'
    const document = await testDocument(ctx, found, input.document, language)
    try {
      const options = {
        ...(input.level !== undefined ? { level: input.level } : {}),
        ...(input.mode ? { mode: input.mode } : {}),
        ...(input.critical ? { critical: true } : {}),
        language,
        roller: cryptoRoller
      }
      const prepared = prepareAction(system, typeKey, document, input.item, input.action, options)
      const rolled = tryAction(system, typeKey, document, input.item, input.action, options)
      return {
        label: rolled.label,
        ...(rolled.level !== undefined ? { level: rolled.level } : {}),
        ...(rolled.activation ? { activation: rolled.activation } : {}),
        attack: rolled.attack
          ? {
              formula: prepared.attack ?? rolled.attack.formula,
              total: rolled.attack.total,
              detail: rolled.attack.detail,
              critical: rolled.attack.critical
            }
          : null,
        save: rolled.save,
        damage: rolled.damage.map((d) => ({
          formula: d.formula,
          ...(d.type ? { type: d.type } : {}),
          average: d.average,
          total: d.result.total,
          detail: d.result.detail
        })),
        heal: rolled.heal
          ? {
              formula: rolled.heal.formula,
              average: rolled.heal.average,
              total: rolled.heal.result.total,
              detail: rolled.heal.result.detail
            }
          : null,
        ...(rolled.uses ? { uses: rolled.uses } : {}),
        ...(rolled.recharge ? { recharge: rolled.recharge } : {})
      }
    } catch (error) {
      if (error instanceof RollError || error instanceof DiceSyntaxError)
        throw new InvalidRequestError('BAD_ROLL', error.message)
      throw error
    }
  }),

  implement(putSystemContent, async (ctx, { systemId, version, items }) => {
    const row = await ownWritable(ctx, systemId)
    const system = row.document as unknown as System
    const given = items as unknown as ContentItem[]
    // Cada documento, validado con el sistema (su tipo, su clave, su fuente, su concepto y su mecánica)
    const problems = validateContent(system, given)
    if (problems.some((p) => p.severity === 'error')) invalid(problems)
    const counts = await systemsRepo.contentCounts(ctx.db, [row.id])
    if ((counts.get(row.id) ?? 0) + given.length > LIMITS.contentDocuments)
      throw new InvalidRequestError('TOO_MUCH_CONTENT', `como mucho, ${LIMITS.contentDocuments} documentos`)
    let saved: Awaited<ReturnType<typeof systemsRepo.putContent>>
    try {
      saved = await systemsRepo.putContent(
        ctx.db,
        historyContext(
          ctx,
          'putSystemContent',
          { name: textOf(system.name), keys: given.map((i) => i.key).slice(0, 20), count: given.length },
          { organizationId: row.organizationId }
        ),
        row.id,
        version,
        given.map(toValues)
      )
    } catch (error) {
      if (error instanceof systemsRepo.SystemChangedError) throw changed()
      throw error
    }
    ctx.realtime.publish(systemsChanged(row.organizationId))
    return {
      version: saved.system.version,
      saved: given.map((i) => i.key),
      created: saved.created,
      warnings: problems.filter((p) => p.severity === 'warning')
    }
  }),

  implement(deleteSystemContent, async (ctx, { systemId, version, keys }) => {
    const row = await ownWritable(ctx, systemId)
    const system = row.document as unknown as System
    const wanted = [...new Set(keys)]
    let done: Awaited<ReturnType<typeof systemsRepo.deleteContent>>
    try {
      done = await systemsRepo.deleteContent(
        ctx.db,
        historyContext(
          ctx,
          'deleteSystemContent',
          { name: textOf(system.name), keys: wanted.slice(0, 20), count: wanted.length },
          { organizationId: row.organizationId }
        ),
        row.id,
        version,
        wanted
      )
    } catch (error) {
      if (error instanceof systemsRepo.SystemChangedError) throw changed()
      throw error
    }
    ctx.realtime.publish(systemsChanged(row.organizationId))
    return {
      version: done.system.version,
      deleted: done.deleted,
      missing: wanted.filter((k) => !done.deleted.includes(k))
    }
  }),

  implement(getSystemParts, async (ctx, { systemId, parts, organizationId }) => {
    const target = readableOrganization(ctx, organizationId)
    const { document, row } = await findReadable(ctx, target, systemId)
    const picked = byPath('BAD_SYSTEM_PATH', () => pickPaths(document as unknown as Record<string, unknown>, parts))
    return {
      id: row ? row.id : document.id,
      name: textOf(document.name),
      version: row ? row.version : 1,
      builtIn: !row,
      parts: picked
    }
  }),

  implement(getSystemFormat, async () => ({ format: FORMAT, docs: formatDocs() })),

  // Validar no lee ni guarda nada, pero cuesta: solo quien puede ver los sistemas, y con el límite de las de probar
  implement(checkSystem, async (ctx, { document, organizationId }) => {
    readableOrganization(ctx, organizationId)
    if (tooManyTries(ctx.actor.userId)) throw new TooManyRequestsError('TOO_MANY_ROLLS')
    const { problems } = document.kind === SYSTEM_FILE ? validateFile(document) : validateSystem(document)
    return { valid: !problems.some((p) => p.severity === 'error'), problems: asProblems(problems) }
  }),

  implement(tryFormula, async (ctx, { systemId, type, formula, document, organizationId }) => {
    const target = readableOrganization(ctx, organizationId)
    if (tooManyTries(ctx.actor.userId)) throw new TooManyRequestsError('TOO_MANY_ROLLS')
    const found = await findReadable(ctx, target, systemId)
    const tried = tryFormulaIn(found.document, type, formula, await testDocument(ctx, found, document))
    return { type: tried.type, value: tried.value, terms: tried.terms, problems: tried.problems }
  }),

  implement(trySystemRoll, async (ctx, input) => {
    if (tooManyTries(ctx.actor.userId)) throw new TooManyRequestsError('TOO_MANY_ROLLS')
    const target = readableOrganization(ctx, input.organizationId)
    // Uno guardado o el borrador del editor (sin guardar: con la forma de un sistema basta, lo demás lo dice al tirar)
    let system: System
    let found: Awaited<ReturnType<typeof findReadable>> | null = null
    if (input.draft) {
      if (!fitsFormat(input.draft))
        throw new InvalidRequestError('BAD_SYSTEM', 'el borrador no tiene la forma de un sistema')
      system = input.draft
    } else {
      found = await findReadable(ctx, target, input.systemId ?? '')
      system = found.document
    }
    const document = await testDocument(ctx, found, input.document)
    const typeKey = input.type ?? Object.entries(system.types).find(([, t]) => t.document === 'actor')?.[0]
    if (!typeKey || !Object.hasOwn(system.types, typeKey))
      throw new InvalidRequestError(
        'BAD_SYSTEM_TYPE',
        input.type ? `no existe el tipo «${input.type}»` : 'no tiene personajes'
      )
    try {
      const rolled = tryRoll(system, typeKey, document, input.roll, {
        ...(input.element ? { element: input.element } : {}),
        ...(input.mode ? { mode: input.mode } : {}),
        target: input.target ?? null,
        roller: cryptoRoller
      })
      return {
        label: rolled.label,
        formula: rolled.formula,
        total: rolled.total,
        detail: rolled.detail,
        critical: rolled.critical,
        band: rolled.band,
        modeApplied: rolled.modeApplied
      }
    } catch (error) {
      if (error instanceof RollError || error instanceof DiceSyntaxError)
        throw new InvalidRequestError('BAD_ROLL', error.message)
      throw error
    }
  }),

  implement(importSystem, async (ctx, { organizationId, file, into }) => {
    const { file: valid, problems } = validateFile(file)
    if (!valid) return invalid(problems)
    return saveFile(
      ctx,
      valid,
      problems.filter((p) => p.severity === 'warning'),
      { organizationId, into }
    )
  })
]

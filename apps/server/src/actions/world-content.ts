/**
 * El compendio de un mundo (docs/specs/compendio-mundo.md): guardar y quitar sus entradas, copiar entre capas (del
 * sistema al mundo y del mundo al sistema) y traer los cambios del original a una copia. Lo cambia quien lleva el mundo
 * (`worldContent.write`); llevar algo al sistema pide además poder cambiar los sistemas de la cuenta
 */
import {
  copyContent,
  deleteWorldContent,
  getContentOrigin,
  getLinkedContent,
  pullContentOrigin,
  putWorldContent,
  searchLinkableContent
} from '@crisol/contracts'
import { campaignsRepo, type schema, systemsRepo, tablesRepo, worldContentRepo } from '@crisol/db'
import { foldName, NotFoundError } from '@crisol/domain'
import {
  type ContentItem,
  contentDiff,
  contentFingerprint,
  type Language,
  LIMITS,
  newContentKey,
  pullFields,
  type System,
  type Text,
  textOf,
  validateContent,
  withTables
} from '@crisol/systems'
import { systemsChanged, worldContentChanged } from '../realtime/events.ts'
import { authorizedWiki, type WikiTarget } from './access.ts'
import { type ActionContext, historyContext, InvalidRequestError } from './context.ts'
import * as layers from './layers.ts'
import { implement } from './registry.ts'
import { contentOf, invalid, ownWritable } from './systems.ts'

type Origin = typeof schema.worldContent.$inferSelect.origin

/** El mundo (si se puede hacer eso en su compendio) y el sistema, que tiene que ser de la misma cuenta */
async function worldAndSystem(
  ctx: ActionContext,
  capability: 'worldContent.read' | 'worldContent.write',
  worldId: string,
  systemId: string
): Promise<{ wiki: WikiTarget; system: System; row: systemsRepo.SystemRow }> {
  const wiki = await authorizedWiki(ctx, capability, worldId)
  const row = await systemsRepo.findSystem(ctx.db, systemId)
  if (!row || row.deletedAt || row.organizationId !== wiki.organizationId) throw new NotFoundError('system')
  return { wiki, system: withTables(row.document as unknown as System), row }
}

const changedEntry = (key: string) =>
  new InvalidRequestError('CONTENT_CHANGED', `«${key}» la ha cambiado otro mientras tanto: vuelve a leerla`)

/** El nombre de una entrada, en un idioma (o su clave) */
const nameOf = (data: Record<string, unknown>, language: Language, key: string) =>
  textOf(data.name as Text | undefined, language) || key

/** El nombre de la copia: el que se da (en todos sus idiomas) o el suyo con «(copia)» */
function copyName(name: unknown, given: string | undefined): unknown {
  if (name && typeof name === 'object') {
    const languages = Object.entries(name as Record<string, string>)
    return Object.fromEntries(
      languages.map(([language, value]) => [language, given ?? `${value} (${language === 'en' ? 'copy' : 'copia'})`])
    )
  }
  return given ?? `${typeof name === 'string' ? name : ''} (copia)`.trim()
}

/** Lo que se dice de un campo que cambió: su nombre en el tipo del sistema */
function fieldLabel(system: System, type: string, key: string, language: Language): string {
  if (key === 'name') return language === 'en' ? 'Name' : 'Nombre'
  if (key === 'mechanics') return language === 'en' ? 'Mechanics' : 'Mecánica'
  if (key === 'table') return language === 'en' ? 'Rows' : 'Filas'
  const label = system.types[type]?.fields[key]?.label
  return label ? textOf(label as Text, language) || key : key
}

/** El original de una copia, como esté ahora (o null si ya no está) */
async function originalOf(ctx: ActionContext, origin: NonNullable<Origin>, worldId: string) {
  const [found] =
    origin.layer === 'world'
      ? await worldContentRepo.contentByKeys(ctx.db, origin.worldId ?? worldId, origin.systemId, [origin.key])
      : await systemsRepo.contentByKeys(ctx.db, origin.systemId, [origin.key])
  return found ?? null
}

/** Una entrada del mundo, por su clave; si no está, 404 */
async function worldEntry(ctx: ActionContext, worldId: string, systemId: string, key: string) {
  const [row] = await worldContentRepo.contentByKeys(ctx.db, worldId, systemId, [key])
  if (!row) throw new NotFoundError('content')
  return row
}

/** Una clave que ya está (dos a la vez): KEY_TAKEN, no un error del servidor */
async function takenAs<T>(key: string, where: string, write: () => Promise<T>): Promise<T> {
  try {
    return await write()
  } catch (error) {
    if (
      (error as { code?: string; cause?: { code?: string } }).code === '23505' ||
      (error as { cause?: { code?: string } }).cause?.code === '23505'
    )
      throw new InvalidRequestError('KEY_TAKEN', `ya hay una entrada «${key}» en el ${where}`)
    throw error
  }
}

/** Que quepan: como mucho, las mismas que en un sistema */
async function checkRoom(ctx: ActionContext, worldId: string, systemId: string, adding: number) {
  if ((await worldContentRepo.countContent(ctx.db, worldId, systemId)) + adding > LIMITS.contentDocuments)
    throw new InvalidRequestError('TOO_MUCH_CONTENT', `como mucho, ${LIMITS.contentDocuments} entradas`)
}

export const worldContentActions = [
  implement(putWorldContent, async (ctx, { worldId, systemId, items }) => {
    const { wiki, system } = await worldAndSystem(ctx, 'worldContent.write', worldId, systemId)
    // Validadas con el sistema, como el contenido de un sistema (sin fuente: lo del mundo no tiene)
    const given = items.map(({ version: _, ...item }) => ({ ...item, source: null })) as unknown as ContentItem[]
    const problems = validateContent(system, given)
    if (problems.some((p) => p.severity === 'error')) invalid(problems)
    const existing = new Set(
      (
        await worldContentRepo.contentByKeys(
          ctx.db,
          worldId,
          systemId,
          items.map((i) => i.key)
        )
      ).map((r) => r.key)
    )
    await checkRoom(ctx, worldId, systemId, items.filter((i) => !existing.has(i.key)).length)
    let saved: Awaited<ReturnType<typeof worldContentRepo.putContent>>
    try {
      saved = await worldContentRepo.putContent(
        ctx.db,
        historyContext(
          ctx,
          'putWorldContent',
          { names: given.slice(0, 20).map((i) => nameOf(i.data, 'es', i.key)), count: given.length },
          wiki
        ),
        worldId,
        systemId,
        items.map((item) => ({
          type: item.type,
          key: item.key,
          data: item.data,
          concept: item.concept ?? null,
          mechanics: item.mechanics ?? null,
          ref: item.ref ?? null,
          img: item.img ?? null,
          table: item.table ?? null,
          ...(item.version !== undefined ? { version: item.version } : {})
        }))
      )
    } catch (error) {
      if (error instanceof worldContentRepo.WorldContentChangedError) throw changedEntry(error.key)
      throw error
    }
    ctx.realtime.publish(worldContentChanged(wiki))
    return {
      saved: saved.saved.map((row) => ({ key: row.key, version: row.version })),
      created: saved.created,
      warnings: problems.filter((p) => p.severity === 'warning')
    }
  }),

  implement(deleteWorldContent, async (ctx, { worldId, systemId, keys }) => {
    const { wiki } = await worldAndSystem(ctx, 'worldContent.write', worldId, systemId)
    const wanted = [...new Set(keys)]
    const done = await worldContentRepo.deleteContent(
      ctx.db,
      historyContext(ctx, 'deleteWorldContent', { keys: wanted.slice(0, 20), count: wanted.length }, wiki),
      worldId,
      systemId,
      wanted
    )
    // Lo sacado de las que eran tablas: otra con su clave empieza de cero
    await tablesRepo.forgetContentDraws(ctx.db, worldId, systemId, done.deleted)
    if (done.deleted.length > 0) ctx.realtime.publish(worldContentChanged(wiki))
    return { deleted: done.deleted, missing: wanted.filter((k) => !done.deleted.includes(k)) }
  }),

  implement(copyContent, async (ctx, { worldId, systemId, key, to, name, newKey, version }) => {
    const { wiki, system, row } = await worldAndSystem(ctx, 'worldContent.write', worldId, systemId)
    if (to === 'world') {
      const [original] = await systemsRepo.contentByKeys(ctx.db, row.id, [key])
      if (!original) throw new NotFoundError('content')
      const data = { ...structuredClone(original.data), name: copyName(original.data.name, name) }
      const copyKey = newKey ?? newContentKey(name ?? nameOf(original.data, 'es', original.key))
      if ((await worldContentRepo.contentByKeys(ctx.db, worldId, systemId, [copyKey])).length > 0)
        throw new InvalidRequestError('KEY_TAKEN', `ya hay una entrada «${copyKey}» en el mundo`)
      const { concept: _, ...candidate } = contentOf({ ...original, source: null })
      const problems = validateContent(system, [{ ...candidate, key: copyKey, data }])
      if (problems.some((p) => p.severity === 'error')) invalid(problems)
      await checkRoom(ctx, worldId, systemId, 1)
      const saved = await takenAs(copyKey, 'mundo', () =>
        worldContentRepo.putContent(
          ctx.db,
          historyContext(ctx, 'copyContent', { name: nameOf(data, 'es', copyKey), to }, wiki),
          worldId,
          systemId,
          [
            {
              type: original.type,
              key: copyKey,
              data,
              // Una copia no es otra edición de lo mismo: sin concepto, no se junta con su original
              concept: null,
              mechanics: original.mechanics ? structuredClone(original.mechanics) : null,
              ref: original.ref,
              img: original.img,
              table: original.table,
              origin: {
                layer: 'system',
                systemId: row.id,
                key: original.key,
                fingerprint: contentFingerprint(original),
                data: original.data,
                mechanics: original.mechanics,
                table: original.table
              }
            }
          ]
        )
      )
      ctx.realtime.publish(worldContentChanged(wiki))
      return { key: copyKey, to, version: saved.saved[0]?.version ?? 1 }
    }

    // Al sistema: quien puede cambiar los sistemas de la cuenta, con la versión que leyó
    await ownWritable(ctx, row.id)
    if (version === undefined) throw new InvalidRequestError('VERSION_REQUIRED', 'falta la versión del sistema')
    const entry = await worldEntry(ctx, worldId, systemId, key)
    const systemKey = newKey ?? entry.key
    if ((await systemsRepo.contentByKeys(ctx.db, row.id, [systemKey])).length > 0)
      throw new InvalidRequestError('KEY_TAKEN', `ya hay una entrada «${systemKey}» en el sistema`)
    const data = name ? { ...entry.data, name: copyName(entry.data.name, name) } : entry.data
    const values = {
      type: entry.type,
      key: systemKey,
      source: null,
      data,
      concept: entry.concept,
      mechanics: entry.mechanics,
      ref: entry.ref,
      img: entry.img,
      table: entry.table
    }
    // Como putSystemContent: validada con el sistema de ahora (la clave también) y con su límite
    const problems = validateContent(system, [contentOf(values)])
    if (problems.some((p) => p.severity === 'error')) invalid(problems)
    const counts = await systemsRepo.contentCounts(ctx.db, [row.id])
    if ((counts.get(row.id) ?? 0) + 1 > LIMITS.contentDocuments)
      throw new InvalidRequestError('TOO_MUCH_CONTENT', `como mucho, ${LIMITS.contentDocuments} documentos`)
    let saved: Awaited<ReturnType<typeof systemsRepo.putContent>>
    try {
      saved = await systemsRepo.putContent(
        ctx.db,
        historyContext(
          ctx,
          'copyContent',
          { name: nameOf(data, 'es', systemKey), to },
          { organizationId: row.organizationId }
        ),
        row.id,
        version,
        [values]
      )
    } catch (error) {
      if (error instanceof systemsRepo.SystemChangedError)
        throw new InvalidRequestError('SYSTEM_CHANGED', 'lo ha cambiado otro mientras tanto: vuelve a leerlo')
      throw error
    }
    // Cambia el sistema: lo ven las campañas de todos los mundos con él
    ctx.realtime.publish(systemsChanged(row.organizationId))
    ctx.realtime.publish(worldContentChanged(wiki))
    return { key: systemKey, to, version: saved.system.version }
  }),

  implement(getContentOrigin, async (ctx, { worldId, systemId, key, language = 'es' }) => {
    const { system } = await worldAndSystem(ctx, 'worldContent.read', worldId, systemId)
    const entry = await worldEntry(ctx, worldId, systemId, key)
    if (!entry.origin) return { origin: null, changes: [] }
    const original = await originalOf(ctx, entry.origin, worldId)
    const fingerprint = original ? contentFingerprint(original) : null
    const origin = {
      layer: entry.origin.layer,
      systemId: entry.origin.systemId,
      key: entry.origin.key,
      name: original ? nameOf(original.data, language, original.key) : null,
      missing: !original,
      changed: fingerprint !== null && fingerprint !== entry.origin.fingerprint,
      fingerprint
    }
    if (!original) return { origin, changes: [] }
    const then = {
      data: entry.origin.data,
      mechanics: entry.origin.mechanics ?? null,
      table: entry.origin.table ?? null
    }
    const changes = contentDiff(then, original).map((change) => ({
      key: change.key,
      label: fieldLabel(system, entry.type, change.key, language),
      before: change.before ?? null,
      after: change.after ?? null,
      copy:
        (change.key === 'mechanics'
          ? entry.mechanics
          : change.key === 'table'
            ? entry.table
            : entry.data[change.key]) ?? null
    }))
    return { origin, changes }
  }),

  implement(pullContentOrigin, async (ctx, { worldId, systemId, key, version, fingerprint, fields }) => {
    const { wiki, system } = await worldAndSystem(ctx, 'worldContent.write', worldId, systemId)
    const entry = await worldEntry(ctx, worldId, systemId, key)
    if (!entry.origin) throw new InvalidRequestError('NO_ORIGIN', 'no es una copia')
    const original = await originalOf(ctx, entry.origin, worldId)
    if (!original) throw new InvalidRequestError('ORIGIN_MISSING', 'su original ya no está')
    // Se trae lo que se vio: si el original volvió a cambiar, no se da por visto lo nuevo
    if (contentFingerprint(original) !== fingerprint)
      throw new InvalidRequestError('ORIGIN_CHANGED', 'el original ha vuelto a cambiar: míralo otra vez')
    // Solo los campos que de verdad cambiaron
    const changed = new Set(
      contentDiff(
        { data: entry.origin.data, mechanics: entry.origin.mechanics ?? null, table: entry.origin.table ?? null },
        original
      ).map((c) => c.key)
    )
    const pulled = pullFields(
      { data: entry.data, mechanics: entry.mechanics, table: entry.table },
      original,
      fields.filter((field) => changed.has(field))
    )
    const problems = validateContent(system, [
      {
        type: entry.type,
        key: entry.key,
        source: null,
        data: pulled.data,
        mechanics: pulled.mechanics ?? undefined,
        table: pulled.table ?? undefined
      }
    ] as ContentItem[])
    if (problems.some((p) => p.severity === 'error')) invalid(problems)
    let saved: Awaited<ReturnType<typeof worldContentRepo.putContent>>
    try {
      saved = await worldContentRepo.putContent(
        ctx.db,
        historyContext(ctx, 'pullContentOrigin', { name: nameOf(entry.data, 'es', entry.key), fields }, wiki),
        worldId,
        systemId,
        [
          {
            type: entry.type,
            key: entry.key,
            data: pulled.data,
            mechanics: (pulled.mechanics as Record<string, unknown> | null | undefined) ?? null,
            table: (pulled.table as Record<string, unknown> | null | undefined) ?? null,
            // El original de ahora pasa a ser el de referencia: el aviso se va
            origin: {
              ...entry.origin,
              fingerprint: contentFingerprint(original),
              data: original.data,
              mechanics: original.mechanics,
              table: original.table
            },
            version
          }
        ]
      )
    } catch (error) {
      if (error instanceof worldContentRepo.WorldContentChangedError) throw changedEntry(error.key)
      throw error
    }
    ctx.realtime.publish(worldContentChanged(wiki))
    return { version: saved.saved[0]?.version ?? version }
  }),

  implement(searchLinkableContent, async (ctx, { worldId, query, limit = 20 }) => {
    const wanted = foldName(query)
    const found = (await linkables(ctx, worldId)).filter((each) => !wanted || foldName(each.name).includes(wanted))
    // Lo que empieza por lo buscado, primero; y lo del mundo antes que lo del sistema
    const rank = (each: Linkable) => (foldName(each.name).startsWith(wanted) ? 0 : 1) + (each.world ? 0 : 2)
    found.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'es'))
    return { items: found.slice(0, limit).map(({ campaignId: _, ...each }) => each) }
  }),

  implement(getLinkedContent, async (ctx, { worldId, name }) => {
    const wanted = foldName(name)
    const all = await linkables(ctx, worldId)
    const match =
      all.find((each) => each.world && foldName(each.name) === wanted) ??
      all.find((each) => foldName(each.name) === wanted)
    if (!match) return { entry: null }
    const row = await systemsRepo.findSystem(ctx.db, match.systemId)
    const system = row?.document as unknown as System | undefined
    const [item] = await layers.contentByKeys(ctx, match.systemId, { worldId, systemId: match.systemId }, [match.key])
    // Unas cifras suyas: sus primeros campos de número con valor (la CA, los PG, el VD)
    const fields = system?.types[match.type]?.fields ?? {}
    const lines = Object.entries(fields)
      .filter(([key, f]) => f.kind === 'number' && typeof item?.data[key] === 'number')
      .slice(0, 4)
      .map(([key, f]) => ({ label: textOf(f.label as Text, 'es') || key, value: String(item?.data[key]) }))
    const { campaignId, ...entry } = match
    return { entry: { ...entry, lines, campaignId } }
  })
]

interface Linkable {
  key: string
  name: string
  type: string
  typeLabel: string
  world: boolean
  systemId: string
  campaignId: string
}

/**
 * Lo que se puede enlazar desde las páginas de un mundo: lo de los sistemas de sus campañas (de la cuenta) y lo de su
 * compendio, con una campaña de cada sistema para abrirlo. Solo quien lleva el mundo (hasta el módulo 5)
 */
async function linkables(ctx: ActionContext, worldId: string): Promise<Linkable[]> {
  const wiki = await authorizedWiki(ctx, 'page.read', worldId)
  const campaigns = await campaignsRepo.listCampaigns(ctx.db, { worldId, userId: ctx.actor.userId, onlyMember: false })
  const bySystem = new Map<string, string>()
  for (const campaign of campaigns)
    if (campaign.system && !bySystem.has(campaign.system)) bySystem.set(campaign.system, campaign.id)
  const out: Linkable[] = []
  for (const [systemId, campaignId] of bySystem) {
    const row = await systemsRepo.findSystem(ctx.db, systemId)
    if (!row || row.deletedAt || row.organizationId !== wiki.organizationId) continue
    const system = withTables(row.document as unknown as System)
    for (const entry of await layers.contentIndex(ctx, row.id, { worldId, systemId: row.id })) {
      const label = system.types[entry.type]?.label
      out.push({
        key: entry.key,
        name: textOf(entry.name as Text | undefined, 'es') || entry.key,
        type: entry.type,
        typeLabel: label ? textOf(label as Text, 'es') : entry.type,
        world: Boolean(entry.world),
        systemId: row.id,
        campaignId
      })
    }
  }
  return out
}

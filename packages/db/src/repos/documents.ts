import { and, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { documents } from '../schema/documents.ts'
import { pages } from '../schema/pages.ts'

/** El estado guardado del cuerpo de una página, si ya tiene */
export async function findBody(db: Database, pageId: string) {
  const [found] = await db
    .select({ id: documents.id, state: documents.state, updatedAt: documents.updatedAt })
    .from(documents)
    .where(and(eq(documents.pageId, pageId), eq(documents.kind, 'body')))
  return found ?? null
}

/**
 * Guarda el cuerpo fusionando con lo que ya hay: merge recibe el estado guardado (o null) y devuelve el nuevo. Los
 * guardados del cuerpo de una página van de uno en uno (un cerrojo por página, también cuando aún no tiene fila: dos
 * altas a la vez se bloqueaban entre sí), así que no se pisan. Nunca se vuelve atrás: solo se fusiona
 */
export function mergeBody(
  db: Database,
  page: { pageId: string; worldId: string; userId: string | null },
  merge: (stored: Uint8Array | null) => Uint8Array
) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`cuerpo:${page.pageId}`}, 0))`)
    const [stored] = await tx
      .select({ id: documents.id, state: documents.state })
      .from(documents)
      .where(and(eq(documents.pageId, page.pageId), eq(documents.kind, 'body')))
      .for('update')
    const state = merge(stored?.state ?? null)
    if (stored) {
      await tx
        .update(documents)
        .set({ state, updatedBy: page.userId, updatedAt: new Date() })
        .where(eq(documents.id, stored.id))
    } else {
      await tx
        .insert(documents)
        .values({ worldId: page.worldId, pageId: page.pageId, kind: 'body', state, updatedBy: page.userId })
        .onConflictDoUpdate({
          target: documents.pageId,
          targetWhere: sql`${documents.kind} = 'body'`,
          set: { state, updatedBy: page.userId, updatedAt: new Date() }
        })
    }
    return state.byteLength
  })
}

/** Un secreto o una nota oculta, con su página y su mundo */
export async function findSeparate(db: Database, documentId: string) {
  const [found] = await db
    .select({
      id: documents.id,
      pageId: documents.pageId,
      worldId: documents.worldId,
      kind: documents.kind,
      state: documents.state
    })
    .from(documents)
    .where(and(eq(documents.id, documentId), inArray(documents.kind, ['secret', 'note', 'tab'])))
  return found ?? null
}

/** Crea el documento de un secreto o una nota oculta de una página, vacío o con el estado de otro */
export async function createSeparate(
  db: Database,
  input: { pageId: string; worldId: string; kind: 'secret' | 'note' | 'tab'; state: Uint8Array; userId: string }
) {
  const [created] = await db
    .insert(documents)
    .values({ ...input, updatedBy: input.userId })
    .returning({ id: documents.id })
  if (!created) throw new Error('No se pudo crear el documento')
  return created.id
}

/** Guarda un secreto o una nota oculta fusionando, como el cuerpo (la fila bloqueada mientras tanto) */
export function mergeSeparate(
  db: Database,
  documentId: string,
  userId: string | null,
  merge: (stored: Uint8Array) => Uint8Array
) {
  return db.transaction(async (tx) => {
    const [stored] = await tx
      .select({ state: documents.state })
      .from(documents)
      .where(eq(documents.id, documentId))
      .for('update')
    if (!stored) return 0
    const state = merge(stored.state)
    await tx
      .update(documents)
      .set({ state, updatedBy: userId, updatedAt: new Date() })
      .where(eq(documents.id, documentId))
    return state.byteLength
  })
}

/** Los documentos de estas páginas (para cerrar los que estén abiertos) */
export async function documentsOfPages(db: Database, pageIds: readonly string[]) {
  if (pageIds.length === 0) return []
  return db
    .select({ id: documents.id, kind: documents.kind })
    .from(documents)
    .where(inArray(documents.pageId, [...pageIds]))
}

/** Los documentos de estas páginas con su estado (para exportarlas de una vez) */
export async function documentsWithState(db: Database, pageIds: readonly string[]) {
  if (pageIds.length === 0) return []
  return db
    .select({ id: documents.id, pageId: documents.pageId, kind: documents.kind, state: documents.state })
    .from(documents)
    .where(inArray(documents.pageId, [...pageIds]))
}

/** Guarda el texto plano de un documento (para buscar y encontrar menciones) */
export async function setText(db: Database, documentId: string, value: string) {
  await db.update(documents).set({ text: value }).where(eq(documents.id, documentId))
}

/** Los documentos del mundo aún sin texto plano (de antes de tenerlo), con su estado para sacarlo */
export function withoutText(db: Database, worldId: string) {
  return db
    .select({ id: documents.id, pageId: documents.pageId, kind: documents.kind, state: documents.state })
    .from(documents)
    .where(and(eq(documents.worldId, worldId), isNull(documents.text)))
}

/**
 * Los documentos del mundo cuyo texto contiene alguno de estos nombres (sin mayúsculas), de páginas fuera de la
 * papelera: los candidatos a mencionar una página
 */
export function mentioning(db: Database, worldId: string, names: readonly string[]) {
  const patterns = names.filter(Boolean).map((name) => `%${name.replace(/[\\%_]/g, (c) => `\\${c}`)}%`)
  if (patterns.length === 0) return Promise.resolve([])
  return db
    .select({ id: documents.id, pageId: documents.pageId, kind: documents.kind, text: documents.text })
    .from(documents)
    .innerJoin(pages, eq(pages.id, documents.pageId))
    .where(
      and(
        eq(documents.worldId, worldId),
        isNull(pages.deletedAt),
        or(...patterns.map((pattern) => ilike(documents.text, pattern)))
      )
    )
}

/** Quien escribió lo último en algún documento de la página */
export function lastWriter(db: Database, pageId: string) {
  return db
    .select({ updatedBy: documents.updatedBy })
    .from(documents)
    .where(eq(documents.pageId, pageId))
    .orderBy(desc(documents.updatedAt))
    .limit(1)
}

/** El texto plano de muchos documentos de una vez */
export async function setTexts(db: Database, items: readonly { id: string; text: string }[]) {
  if (items.length === 0) return
  await db.execute(sql`
    update documents d set text = v.text
    from (values ${sql.join(
      items.map((item) => sql`(${item.id}::uuid, ${item.text}::text)`),
      sql`, `
    )}) as v(id, text)
    where d.id = v.id`)
}

/** El estado de estos documentos (por su id), para cambiar muchos de una vez */
export async function statesOf(db: Database, ids: readonly string[]) {
  if (ids.length === 0) return []
  return db
    .select({ id: documents.id, kind: documents.kind, pageId: documents.pageId, state: documents.state })
    .from(documents)
    .where(inArray(documents.id, [...ids]))
}

/** Guarda el estado nuevo de muchos documentos (ya fusionado con el de antes) */
export async function saveStates(db: Database, userId: string, items: readonly { id: string; state: Uint8Array }[]) {
  for (let i = 0; i < items.length; i += 200) {
    const part = items.slice(i, i + 200)
    await db.execute(sql`
      update documents d set state = v.state, updated_by = ${userId}, updated_at = now()
      from (values ${sql.join(
        part.map((item) => sql`(${item.id}::uuid, ${Buffer.from(item.state)}::bytea)`),
        sql`, `
      )}) as v(id, state)
      where d.id = v.id`)
  }
}

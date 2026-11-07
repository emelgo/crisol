import { historyCutoff, trashCutoff } from '@crisol/domain'
import { and, eq, isNotNull, isNull, lt, or, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation } from '../operation.ts'
import { approvals } from '../schema/ai.ts'
import { campaignMembers, campaigns } from '../schema/campaigns.ts'
import { files } from '../schema/files.ts'
import { operations } from '../schema/history.ts'
import { pages } from '../schema/pages.ts'
import { worldMembers, worlds } from '../schema/worlds.ts'

/** Borrar manda a la papelera: la misma fila, marcada. Deshacerlo o restaurarla la deja como estaba */
export function deleteWorld(db: Database, context: OperationContext, worldId: string) {
  return operation(db, context, (w) => w.update(worlds, worldId, { deletedAt: new Date() }))
}

export function deleteCampaign(db: Database, context: OperationContext, campaignId: string) {
  return operation(db, context, (w) => w.update(campaigns, campaignId, { deletedAt: new Date() }))
}

export function restoreWorld(db: Database, context: OperationContext, worldId: string) {
  return operation(db, context, (w) => w.update(worlds, worldId, { deletedAt: null }))
}

export function restoreCampaign(db: Database, context: OperationContext, campaignId: string) {
  return operation(db, context, (w) => w.update(campaigns, campaignId, { deletedAt: null }))
}

/** Un mundo de la papelera (para restaurarlo) */
export async function findTrashedWorld(db: Database, worldId: string) {
  const [found] = await db
    .select({ id: worlds.id, organizationId: worlds.organizationId, name: worlds.name, deletedAt: worlds.deletedAt })
    .from(worlds)
    .where(and(eq(worlds.id, worldId), isNotNull(worlds.deletedAt)))
  return found ?? null
}

/** Una campaña de la papelera, con su mundo, y si ese mundo también está en ella (entonces se restaura él) */
export async function findTrashedCampaign(db: Database, campaignId: string) {
  const [found] = await db
    .select({
      id: campaigns.id,
      worldId: campaigns.worldId,
      organizationId: worlds.organizationId,
      name: campaigns.name,
      deletedAt: campaigns.deletedAt,
      worldInTrash: sql<boolean>`${worlds.deletedAt} is not null`
    })
    .from(campaigns)
    .innerJoin(worlds, eq(worlds.id, campaigns.worldId))
    .where(and(eq(campaigns.id, campaignId), isNotNull(campaigns.deletedAt)))
  return found ?? null
}

export type TrashScope = { worldId: string } | { organizationId: string }

/**
 * Lo que hay en la papelera, de lo último borrado a lo primero: las campañas borradas de un mundo o, en la de la
 * organización, también los mundos. Las campañas de un mundo borrado no salen sueltas: vuelven con él.
 */
export async function listTrash(db: Database, scope: TrashScope) {
  const trashedCampaigns = await db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      worldId: campaigns.worldId,
      worldName: worlds.name,
      deletedAt: campaigns.deletedAt
    })
    .from(campaigns)
    .innerJoin(worlds, eq(worlds.id, campaigns.worldId))
    .where(
      and(
        isNotNull(campaigns.deletedAt),
        isNull(worlds.deletedAt),
        'worldId' in scope ? eq(campaigns.worldId, scope.worldId) : eq(worlds.organizationId, scope.organizationId)
      )
    )
  const trashedWorlds =
    'organizationId' in scope
      ? await db
          .select({
            id: worlds.id,
            name: worlds.name,
            worldId: worlds.id,
            worldName: worlds.name,
            deletedAt: worlds.deletedAt
          })
          .from(worlds)
          .where(and(eq(worlds.organizationId, scope.organizationId), isNotNull(worlds.deletedAt)))
      : []
  // De las páginas, solo la de arriba de cada borrado: sus subpáginas vuelven con ella
  const trashedPages = await db.execute<{
    id: string
    name: string
    world_id: string
    world_name: string
    deleted_at: string
    subpages: number
  }>(sql`
    select p.id, p.title as name, p.world_id, w.name as world_name, p.deleted_at,
      (select count(*)::int from pages c
        where c.world_id = p.world_id and c.deleted_at = p.deleted_at and c.id <> p.id) as subpages
    from pages p
    join worlds w on w.id = p.world_id
    left join pages parent on parent.id = p.parent_id
    where p.deleted_at is not null and w.deleted_at is null
      and (parent.id is null or parent.deleted_at is null or parent.deleted_at <> p.deleted_at)
      and ${'worldId' in scope ? sql`p.world_id = ${scope.worldId}` : sql`w.organization_id = ${scope.organizationId}`}`)
  const trashedFiles = await db
    .select({
      id: files.id,
      name: files.name,
      worldId: files.worldId,
      worldName: worlds.name,
      deletedAt: files.deletedAt
    })
    .from(files)
    // Los comunes (sin mundo) van en la papelera de la organización y, como se usan desde cada mundo, también en la de
    // sus mundos (se borran desde la carpeta «Comunes» de sus archivos)
    .leftJoin(worlds, eq(worlds.id, files.worldId))
    .where(
      and(
        isNotNull(files.deletedAt),
        or(isNull(files.worldId), isNull(worlds.deletedAt)),
        'worldId' in scope
          ? or(
              eq(files.worldId, scope.worldId),
              and(
                isNull(files.worldId),
                sql`${files.organizationId} = (select organization_id from worlds where id = ${scope.worldId})`
              )
            )
          : eq(files.organizationId, scope.organizationId)
      )
    )
  return [
    ...trashedFiles.map((item) => ({ kind: 'file' as const, ...item, deletedAt: item.deletedAt as Date })),
    ...trashedWorlds.map((item) => ({ kind: 'world' as const, ...item, deletedAt: item.deletedAt as Date })),
    ...trashedCampaigns.map((item) => ({ kind: 'campaign' as const, ...item, deletedAt: item.deletedAt as Date })),
    ...[...trashedPages].map((item) => ({
      kind: 'page' as const,
      id: item.id,
      name: item.name,
      worldId: item.world_id,
      worldName: item.world_name,
      deletedAt: new Date(item.deleted_at),
      subpages: item.subpages
    }))
  ].sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime())
}

/** Quiénes están: en una campaña, o en un mundo (sus másteres, sin campaña, y los de todas sus campañas) */
export async function peopleOf(db: Database, scope: { worldId: string } | { campaignId: string }) {
  if ('campaignId' in scope) {
    return db
      .select({ userId: campaignMembers.userId, campaignId: sql<string | null>`${campaignMembers.campaignId}` })
      .from(campaignMembers)
      .where(eq(campaignMembers.campaignId, scope.campaignId))
  }
  const [masters, players] = await Promise.all([
    db
      .select({ userId: worldMembers.userId, campaignId: sql<string | null>`null` })
      .from(worldMembers)
      .where(eq(worldMembers.worldId, scope.worldId)),
    db
      .select({ userId: campaignMembers.userId, campaignId: sql<string | null>`${campaignMembers.campaignId}` })
      .from(campaignMembers)
      .innerJoin(campaigns, eq(campaigns.id, campaignMembers.campaignId))
      .where(eq(campaigns.worldId, scope.worldId))
  ])
  return [...masters, ...players]
}

/**
 * La purga diaria: quita del todo lo que lleva más de 30 días en la papelera (con lo que cuelga de ello), y las
 * operaciones y las peticiones de la IA de más de 90. No es una operación: purgar no se puede deshacer. Quien se queda
 * sin nada en una organización deja de ser miembro de ella, como al expulsarlo.
 */
/** Las versiones de cada página que se guardan siempre, por viejas que sean */
export const VERSIONS_KEPT = 40

export function purge(db: Database, now: Date) {
  return db.transaction(async (tx) => {
    const cutoff = trashCutoff(now)
    const purgedWorlds = await tx.delete(worlds).where(lt(worlds.deletedAt, cutoff)).returning({ id: worlds.id })
    const purgedCampaigns = await tx
      .delete(campaigns)
      .where(lt(campaigns.deletedAt, cutoff))
      .returning({ id: campaigns.id })
    // Una página purgada se lleva sus subpáginas (clave ajena en cascada)
    const purgedPages = await tx.delete(pages).where(lt(pages.deletedAt, cutoff)).returning({ id: pages.id })
    // Las que se van, fuera de los campos de enlace que las apuntaban (ADR-0009): sin quedarse colgando
    if (purgedPages.length > 0)
      await unlinkPages(
        tx,
        purgedPages.map((page) => page.id)
      )
    // Los archivos: su fila (sus bytes se van cuando ya no los nombra nadie; lo hace la limpieza del almacenamiento)
    const purgedFiles = await tx.delete(files).where(lt(files.deletedAt, cutoff)).returning({ id: files.id })
    const memberships = await tx.execute<{ id: string }>(sql`
      delete from organization_members om
      where om.role = 'member'
        and not exists (
          select 1 from campaign_members cm
          join campaigns c on c.id = cm.campaign_id
          join worlds w on w.id = c.world_id
          where cm.user_id = om.user_id and w.organization_id = om.organization_id)
        and not exists (
          select 1 from world_members wm
          join worlds w on w.id = wm.world_id
          where wm.user_id = om.user_id and w.organization_id = om.organization_id)
      returning om.id`)
    const purgedOperations = await tx
      .delete(operations)
      .where(lt(operations.createdAt, historyCutoff(now)))
      .returning({ id: operations.id })
    // Las versiones del texto: a los 90 días, salvo las 40 últimas de cada página, la de ahora y las que nombra una
    // operación que sigue en el historial (deshacerla las necesita). Sus estados se van si ya no los usa ninguna
    const purgedVersions = await tx.execute<{ id: string }>(sql`
      delete from page_versions v
      where v.created_at < ${historyCutoff(now).toISOString()}::timestamptz
        and not exists (select 1 from page_bodies b where b.version_id = v.id)
        and v.id not in (
          select r.id from (
            select id, row_number() over (partition by page_id order by created_at desc) as n from page_versions
          ) r where r.n <= ${VERSIONS_KEPT})
        and not exists (
          select 1 from changes c where c.table_name = 'page_bodies'
            and (c.before->>'version_id' = v.id::text or c.after->>'version_id' = v.id::text))
      returning v.id`)
    await tx.execute(
      sql`delete from snapshots s where not exists (select 1 from version_documents d where d.snapshot_id = s.id)`
    )
    const purgedApprovals = await tx
      .delete(approvals)
      .where(lt(approvals.createdAt, historyCutoff(now)))
      .returning({ id: approvals.id })
    // Lo aprobado que lleva más de una hora haciéndose ya no se va a acabar
    const interrupted = await tx
      .update(approvals)
      .set({ status: 'failed', error: 'INTERRUPTED' })
      .where(and(eq(approvals.status, 'approved'), lt(approvals.decidedAt, new Date(now.getTime() - 60 * 60 * 1000))))
      .returning({ id: approvals.id })
    return {
      worlds: purgedWorlds.length,
      campaigns: purgedCampaigns.length,
      pages: purgedPages.length,
      files: purgedFiles.length,
      memberships: memberships.length,
      operations: purgedOperations.length,
      versions: purgedVersions.length,
      approvals: purgedApprovals.length,
      interrupted: interrupted.length
    }
  })
}

/** Las claves del almacenamiento que aún nombra alguien: una fila de archivos o el historial (deshacer las necesita) */
export async function liveStorageKeys(db: Database) {
  const rows = await db.execute<{ key: string }>(sql`
    select storage_key as key from files
    union select storage_key from system_images
    union select storage_key from scene_tiles
    union select c.before->>'storage_key' from changes c where c.table_name = 'files' and c.before is not null
    union select c.after->>'storage_key' from changes c where c.table_name = 'files' and c.after is not null`)
  return new Set([...rows].map((row) => row.key).filter(Boolean))
}

/** Quita estas páginas de los enlaces de las propiedades que las apuntan (las demás propiedades, tal cual) */
async function unlinkPages(tx: Pick<Database, 'execute'>, pageIds: readonly string[]) {
  const gone = sql`array[${sql.join(
    pageIds.map((id) => sql`${id}`),
    sql`, `
  )}]::text[]`
  await tx.execute(sql`
    update pages set properties = (
      select jsonb_agg(
        case when e->>'type' = 'pages' then jsonb_set(e, '{value}', coalesce((
          select jsonb_agg(v) from jsonb_array_elements_text(e->'value') v where v <> all(${gone})
        ), '[]'::jsonb))
        else e end order by n)
      from jsonb_array_elements(properties) with ordinality as x(e, n))
    where exists (
      select 1 from jsonb_array_elements(properties) e, jsonb_array_elements_text(e->'value') v
      where e->>'type' = 'pages' and v = any(${gone}))`)
}

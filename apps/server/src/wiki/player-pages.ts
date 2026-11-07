/**
 * Las páginas que escriben los jugadores (docs/specs/pagina-de-jugadores.md). Su cuerpo va entero, en vivo, a quien lo
 * edita: por eso no lleva secretos, y lo que se escribe en él se resuelve solo contra lo que ven todos los que lo editan
 */
import type { Database } from '@crisol/db'
import { knowledgeRepo, pagesRepo } from '@crisol/db'
import { type Knowledge, knowledgeFor, type NamedPage } from '@crisol/domain'

/** Si el cuerpo tiene secretos o notas ocultas (una página de jugadores no puede: los verían) */
export function hasSeparates(body: { type?: string; content?: unknown[] }): boolean {
  if (body.type === 'secret' || body.type === 'note') return true
  return (body.content ?? []).some((child) => hasSeparates(child as { type?: string; content?: unknown[] }))
}

/**
 * Si esa cuenta puede escribir en esa página como jugadora: con permiso en una campaña suya (la que lee, si se dice),
 * para toda ella o para uno de sus personajes, y viéndola desde allí. Un permiso de una página que ya no ve no vale
 */
export async function playerEdits(
  env: { db: Database },
  userId: string,
  pageId: string,
  campaignId?: string
): Promise<boolean> {
  const grants = (await knowledgeRepo.editorGrants(env.db, userId, pageId)).filter(
    (grant) =>
      (!campaignId || grant.campaignId === campaignId) &&
      (grant.characters === null || grant.mine.some((id) => grant.characters?.includes(id)))
  )
  const first = grants[0]
  if (!first) return false
  const [tree, marks] = await Promise.all([
    knowledgeRepo.worldTree(env.db, first.worldId),
    knowledgeRepo.listMarks(env.db, {
      worldId: first.worldId,
      campaignIds: grants.map((g) => g.campaignId),
      kinds: ['page']
    })
  ])
  return grants.some((grant) =>
    knowledgeFor(
      { kind: 'player', campaignId: grant.campaignId, characterIds: grant.mine, knowsWorld: grant.knowsWorld },
      tree,
      marks
    ).seesPage(pageId)
  )
}

/**
 * Lo que ven todos los que escriben en una página de jugadores: cada personaje con permiso, o la campaña entera (lo
 * que ven todos sus jugadores). null: no es una página de jugadores
 */
export async function editorsSee(env: { db: Database }, worldId: string, pageId: string) {
  const rows = await knowledgeRepo.pageEditorsOf(env.db, pageId)
  if (rows.length === 0) return null
  const campaignIds = [...new Set(rows.map((row) => row.campaignId))]
  const [tree, marks, knows] = await Promise.all([
    knowledgeRepo.worldTree(env.db, worldId),
    knowledgeRepo.listMarks(env.db, { worldId, campaignIds, kinds: ['page'] }),
    knowledgeRepo.knowsWorld(env.db, campaignIds)
  ])
  const readers: Knowledge[] = rows.flatMap((row) =>
    (row.characters ?? [null]).map((character) =>
      knowledgeFor(
        {
          kind: 'player',
          campaignId: row.campaignId,
          characterIds: character ? [character] : [],
          knowsWorld: knows.get(row.campaignId) ?? true
        },
        tree,
        marks
      )
    )
  )
  return (id: string) => readers.every((reader) => reader.seesPage(id))
}

/**
 * Los nombres contra los que se resuelve lo que se escribe en una página de jugadores: las páginas que ven todos los
 * que la editan, por su título (sin alias ni rutas, que pueden decir lo que no ven). null: no es una página de jugadores
 */
export async function editorsNames(
  env: { db: Database },
  worldId: string,
  pageId: string
): Promise<NamedPage[] | null> {
  const sees = await editorsSee(env, worldId, pageId)
  if (!sees) return null
  const rows = await pagesRepo.worldPages(env.db, worldId)
  return rows
    .filter((row) => sees(row.id))
    .map((row) => ({ id: row.id, title: row.title, aliases: [], path: [row.title] }))
}

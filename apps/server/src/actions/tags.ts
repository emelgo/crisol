/**
 * Las etiquetas de la cuenta (ADR-0006): el catálogo en árbol, crear, renombrar, dar color y borrar, y las de un
 * archivo. Las de una página van en su propiedad `etiquetas` (setPageProperties)
 */
import { createTag, deleteTag, listAccountTags, setFileTags, type TagView, updateTag } from '@crisol/contracts'
import { tagsRepo } from '@crisol/db'
import { authorize, can, tagKey, tagTree, uniqueTags } from '@crisol/domain'
import { commonFilesChanged, filesChanged, pagesChanged, tagsChanged } from '../realtime/events.ts'
import { targetOrganization } from './access.ts'
import { type ActionContext, historyContext, InvalidRequestError } from './context.ts'
import { authorizedFile, filesTouched, historyScopeOf } from './files.ts'
import { implement } from './registry.ts'

type Color = TagView['color']

/** El catálogo de una organización en árbol; los mundos de cada una, solo para quien la administra */
async function catalog(ctx: ActionContext, organizationId: string): Promise<TagView[]> {
  const [rows, pages, files] = await Promise.all([
    tagsRepo.listRows(ctx.db, organizationId),
    tagsRepo.taggedPages(ctx.db, organizationId),
    tagsRepo.taggedFiles(ctx.db, organizationId)
  ])
  const owner = can(ctx.actor, 'tags.write', { organizationId })
  const worldNames = new Map(pages.map((page) => [page.worldId, page.worldName]))
  return tagTree<Color>({
    rows: rows.map((row) => ({ id: row.id, name: row.name, color: row.color as Color })),
    pages: pages.map((page) => ({ worldId: page.worldId, tags: tagsRepo.tagsOfProperties(page.properties) })),
    files
  }).map((node) => ({
    id: node.id,
    name: node.name,
    depth: node.depth,
    color: node.color,
    pages: node.pages,
    files: node.files,
    worlds: owner
      ? [...node.worlds].map(([worldId, count]) => ({ worldId, name: worldNames.get(worldId) ?? '', pages: count }))
      : []
  }))
}

/** Una del catálogo, por su nombre; si no está, 404 */
async function inCatalog(ctx: ActionContext, organizationId: string, name: string) {
  const found = (await catalog(ctx, organizationId)).find((tag) => tagKey(tag.name) === tagKey(name))
  if (!found) throw new InvalidRequestError('TAG_NOT_FOUND', `No hay ninguna etiqueta «${name}»`)
  return found
}

/** Tras cambiar etiquetas: el catálogo y lo que las lleva */
function tagsTouched(
  ctx: ActionContext,
  organizationId: string,
  changed?: { worlds: string[]; filePlaces: (string | null)[] }
) {
  ctx.realtime.publish(tagsChanged(organizationId))
  for (const worldId of changed?.worlds ?? []) ctx.realtime.publish(pagesChanged({ worldId, organizationId }))
  for (const worldId of changed?.filePlaces ?? []) {
    ctx.realtime.publish(worldId ? filesChanged({ worldId, organizationId }) : commonFilesChanged(organizationId))
  }
}

export const tagActions = [
  implement(listAccountTags, async (ctx, { organizationId }) => {
    const target = organizationId ?? targetOrganization(ctx, undefined)
    authorize(ctx.actor, 'tags.read', { organizationId: target })
    return { organizationId: target, tags: await catalog(ctx, target) }
  }),

  implement(createTag, async (ctx, { organizationId, name, color }) => {
    const target = targetOrganization(ctx, organizationId)
    authorize(ctx.actor, 'tags.write', { organizationId: target })
    const existing = (await catalog(ctx, target)).find((tag) => tagKey(tag.name) === tagKey(name))
    // Ya guardada: no se repite. Usada pero sin guardar: se guarda (con el color, si se da)
    if (existing?.id) throw new InvalidRequestError('TAG_TAKEN', `Ya hay una etiqueta «${existing.name}»`)
    await tagsRepo.createRow(ctx.db, historyContext(ctx, 'createTag', { name }, { organizationId: target }), {
      organizationId: target,
      name: existing?.name ?? name,
      color: color ?? null
    })
    tagsTouched(ctx, target)
    return inCatalog(ctx, target, name)
  }),

  implement(updateTag, async (ctx, { organizationId, tag, name, color }) => {
    const target = targetOrganization(ctx, organizationId)
    authorize(ctx.actor, 'tags.write', { organizationId: target })
    const current = await inCatalog(ctx, target, tag)
    let now = current.name
    if (name !== undefined && name !== current.name) {
      // Ni dentro de sí misma («lugar» a «lugar/ciudad»)
      if (tagKey(name).startsWith(`${tagKey(current.name)}/`)) throw new InvalidRequestError('TAG_CYCLE')
      const changed = await tagsRepo.retag(
        ctx.db,
        historyContext(ctx, 'renameTag', { from: current.name, to: name }, { organizationId: target }),
        target,
        current.name,
        name
      )
      tagsTouched(ctx, target, changed)
      now = name
    }
    if (color !== undefined && color !== current.color) {
      await tagsRepo.setColor(
        ctx.db,
        historyContext(ctx, 'colorTag', { name: now, color }, { organizationId: target }),
        target,
        now,
        color
      )
      tagsTouched(ctx, target)
    }
    return inCatalog(ctx, target, now)
  }),

  implement(deleteTag, async (ctx, { organizationId, tag }) => {
    const target = targetOrganization(ctx, organizationId)
    authorize(ctx.actor, 'tags.write', { organizationId: target })
    const current = await inCatalog(ctx, target, tag)
    const changed = await tagsRepo.retag(
      ctx.db,
      historyContext(ctx, 'deleteTag', { name: current.name }, { organizationId: target }),
      target,
      current.name,
      null
    )
    tagsTouched(ctx, target, changed)
    return { name: current.name, pages: changed.pages, files: changed.files }
  }),

  implement(setFileTags, async (ctx, { fileId, tags }) => {
    const { file, place } = await authorizedFile(ctx, 'page.write', fileId)
    const next = uniqueTags(tags.map((tag) => tag.trim()))
    const same = next.length === file.tags.length && next.every((tag, i) => tag === file.tags[i])
    if (!same) {
      await tagsRepo.setFileTags(
        ctx.db,
        historyContext(ctx, 'setFileTags', { name: file.name, tags: next }, historyScopeOf(place)),
        fileId,
        next
      )
      await filesTouched(ctx, place)
      ctx.realtime.publish(tagsChanged(place.organizationId))
    }
    return { id: file.id, tags: next }
  })
]

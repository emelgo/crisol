/**
 * Lo de dentro de una página para enseñarlo en otra (la vista previa de un enlace y los incrustados) y el cuerpo que lee
 * un jugador. Sale de la API, que proyecta (el máster ve sus secretos; un jugador, solo lo que sabe: ADR-0017), y nunca
 * abre el documento de Yjs del otro para quien lo mira: se lee aquí
 */
import { getPageContent } from '@crisol/contracts'
import { documentsRepo, pagesRepo } from '@crisol/db'
import { foldName } from '@crisol/domain'
import type { JSONContent } from '@tiptap/core'
import { readDocument } from '../wiki/content.ts'
import { linkName, worldNames } from '../wiki/links.ts'
import { filterBody, viewedPage, visibleProperties } from '../wiki/projection.ts'
import { propertiesOf } from '../wiki/properties.ts'
import type { WikiView } from '../wiki/reader.ts'
import type { ActionContext } from './context.ts'
import { implement } from './registry.ts'

/** Hasta cuántos niveles se abren los incrustados de dentro */
export const MAX_EMBED_DEPTH = 3
/** La vista previa: los primeros bloques, y de su texto, unos cuantos caracteres */
const PREVIEW_BLOCKS = 4

const textOf = (node: JSONContent): string =>
  node.text ?? (node.content ?? []).map(textOf).join(node.type === 'doc' ? '\n' : '')

/** Los bloques de una sección (el título y lo de debajo, hasta el siguiente de su nivel) o un bloque (^id) */
function anchored(blocks: JSONContent[], anchor: string): JSONContent[] {
  if (anchor.startsWith('^')) {
    const block = blocks.find((b) => b.attrs?.id === anchor.slice(1))
    return block ? [block] : []
  }
  const start = blocks.findIndex(
    (b) => b.type === 'heading' && (b.attrs?.id === anchor || foldName(textOf(b)) === foldName(anchor))
  )
  if (start === -1) return []
  const level = Number(blocks[start]?.attrs?.level ?? 1)
  let end = start + 1
  while (end < blocks.length && !(blocks[end]?.type === 'heading' && Number(blocks[end]?.attrs?.level) <= level)) end++
  return blocks.slice(start, end)
}

interface Context {
  ctx: ActionContext
  /** Quien lo mira (ADR-0017): un jugador no ve los secretos que no se le revelaron, ni las notas, ni lo que no conoce */
  view: WikiView
  worldId: string
  linkTitle: (id: string) => string
  /** Las páginas ya abiertas por encima: un incrustado de una de ellas sería un ciclo */
  above: ReadonlySet<string>
  depth: number
  separates: ReadonlyMap<string, string>
}

/** Un bloque listo para enseñar: los secretos con lo suyo, los enlaces con su título y los incrustados abiertos */
async function project(node: JSONContent, at: Context): Promise<JSONContent> {
  if (node.type === 'secret' || node.type === 'note') {
    const documentId = String(node.attrs?.documentId ?? '')
    const pageId = at.separates.get(documentId)
    const content = pageId ? ((await readDocument(at.ctx, { kind: 'separate', documentId, pageId })).content ?? []) : []
    return { ...node, content: await Promise.all(content.map((child) => project(child, at))) }
  }
  if (node.type === 'pageLink' && typeof node.attrs?.pageId === 'string') {
    return { ...node, attrs: { ...node.attrs, title: at.linkTitle(node.attrs.pageId) || node.attrs.title } }
  }
  if (node.type === 'pageEmbed' && typeof node.attrs?.pageId === 'string') {
    const targetId = node.attrs.pageId
    const title = at.linkTitle(targetId) || String(node.attrs.title ?? '')
    if (at.above.has(targetId)) return { ...node, attrs: { ...node.attrs, title, cycle: true } }
    if (at.depth >= MAX_EMBED_DEPTH) return { ...node, attrs: { ...node.attrs, title, tooDeep: true } }
    const inner = await contentOf(at.ctx, targetId, (node.attrs.anchor as string | null) ?? null, {
      ...at,
      depth: at.depth + 1,
      above: new Set([...at.above, targetId])
    })
    return inner
      ? { ...node, attrs: { ...node.attrs, title }, content: inner }
      : { ...node, attrs: { ...node.attrs, title, missing: true } }
  }
  return node.content ? { ...node, content: await Promise.all(node.content.map((child) => project(child, at))) } : node
}

/** Los bloques de una página (o de su sección), proyectados; null si no se ve */
async function contentOf(ctx: ActionContext, pageId: string, anchor: string | null, at: Omit<Context, 'separates'>) {
  const page = await pagesRepo.findPage(ctx.db, pageId)
  if (!page || page.worldId !== at.worldId || !at.view.seesPage(pageId)) return null
  const body = filterBody(await readDocument(ctx, { kind: 'body', pageId }), at.view, pageId) ?? { type: 'doc' }
  const blocks = anchor ? anchored(body.content ?? [], anchor) : (body.content ?? [])
  const separates = new Map(
    (await documentsRepo.documentsOfPages(ctx.db, [pageId])).filter((d) => d.kind !== 'body').map((d) => [d.id, pageId])
  )
  return Promise.all(blocks.map((block) => project(block, { ...at, separates })))
}

export const previewActions = [
  implement(getPageContent, async (ctx, { pageId, anchor, preview, ...as }) => {
    const { page, wiki, view } = await viewedPage(ctx, pageId, as)
    const linkTitle = linkName(await worldNames(ctx, wiki.worldId))
    const summary = visibleProperties(propertiesOf(page.properties), view).find((p) => foldName(p.name) === 'resumen')
    // En la vista previa, lo incrustado dentro no se abre (como si ya se hubiera llegado al último nivel)
    const base = {
      ctx,
      view,
      worldId: wiki.worldId,
      linkTitle,
      above: new Set([page.id]),
      depth: preview ? MAX_EMBED_DEPTH : 0
    }
    let blocks = (await contentOf(ctx, page.id, anchor ?? null, base)) ?? []
    let truncated = false
    if (preview) {
      // Los párrafos vacíos no cuentan
      const meaningful = blocks.filter((b) => b.type !== 'paragraph' || textOf(b).trim() !== '')
      truncated = meaningful.length > PREVIEW_BLOCKS
      blocks = meaningful.slice(0, PREVIEW_BLOCKS)
    }
    return {
      page: {
        id: page.id,
        title: page.title,
        icon: page.icon,
        path: view.pages(await pagesRepo.pagePath(ctx.db, page.id)),
        summary: summary?.type === 'text' && summary.value.trim() ? summary.value : null,
        cover: page.cover ?? null
      },
      blocks: blocks as Record<string, unknown>[],
      truncated
    }
  })
]

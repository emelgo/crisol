/**
 * Exportar la wiki en Markdown (el de la tarea 10): una página, una rama o el mundo entero en un .zip. Una página con
 * subpáginas es una carpeta con su nota dentro (`Página/Página.md`), como en el Crisol de antes. Pasa por la misma
 * proyección que leer: el máster exporta con sus secretos (los jugadores, en el módulo 5, sin lo que no ven)
 */
import type { ExportInput } from '@crisol/contracts'
import { documentsRepo, pagesRepo, worldsRepo } from '@crisol/db'
import { NotFoundError } from '@crisol/domain'
import { pageToMarkdown } from '@crisol/editor/markdown'
import type { JSONContent } from '@tiptap/core'
import { strToU8, zipSync } from 'fflate'
import { authorizedPage, authorizedWiki } from '../actions/access.ts'
import type { ActionContext } from '../actions/context.ts'
import { documentJson } from './content.ts'
import { fileNames } from './file-embeds.ts'
import { propertiesOf } from './properties.ts'

/** Un nombre de archivo que vale en cualquier sistema: sin barras ni lo que Windows no admite */
export function fileName(title: string) {
  const clean = title
    // biome-ignore lint/suspicious/noControlCharactersInRegex: los caracteres de control no valen en un nombre de archivo
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .slice(0, 120)
    .trim()
  return clean || 'Sin título'
}

interface TreePage {
  id: string
  parentId: string | null
  title: string
  properties: unknown[]
}

/**
 * Dónde va cada página dentro del .zip (sin «.md»), con el árbol de todo el mundo. Entre hermanas que se llamarían
 * igual, la segunda lleva « (2)»; una página con hijas es su carpeta y su nota dentro
 */
export function exportPaths(pages: readonly TreePage[]) {
  const children = new Map<string | null, TreePage[]>()
  for (const page of pages) children.set(page.parentId, [...(children.get(page.parentId) ?? []), page])
  const folder = new Map<string, string>()
  const path = new Map<string, string>()
  const walk = (parentId: string | null, prefix: string) => {
    const used = new Set<string>()
    for (const page of children.get(parentId) ?? []) {
      const base = fileName(page.title)
      let name = base
      for (let n = 2; used.has(name.toLocaleLowerCase('es')); n++) name = `${base} (${n})`
      used.add(name.toLocaleLowerCase('es'))
      const here = prefix ? `${prefix}/${name}` : name
      const hasChildren = (children.get(page.id) ?? []).length > 0
      folder.set(page.id, prefix)
      path.set(page.id, hasChildren ? `${here}/${name}` : here)
      if (hasChildren) walk(page.id, here)
    }
  }
  walk(null, '')
  return { path, folder, children }
}

/** El .zip y su nombre */
export async function exportZip(ctx: ActionContext, input: ExportInput): Promise<{ name: string; zip: Uint8Array }> {
  const pageId = input.pageId ?? null
  const wiki = pageId
    ? (await authorizedPage(ctx, 'page.read', pageId)).wiki
    : await authorizedWiki(ctx, 'page.read', input.worldId)
  if (wiki.worldId !== input.worldId) throw new NotFoundError('page')
  const world = await worldsRepo.findWorld(ctx.db, wiki.worldId)
  if (!world) throw new NotFoundError('world')

  const all = await pagesRepo.worldPages(ctx.db, wiki.worldId)
  const { path, folder, children } = exportPaths(all)
  const byId = new Map(all.map((page) => [page.id, page]))

  // Qué páginas van: el mundo entero, una página, o una página con toda su rama
  let chosen: TreePage[] = all
  let strip = ''
  let name = world.name
  if (pageId) {
    const root = byId.get(pageId)
    if (!root) throw new NotFoundError('page')
    name = root.title
    strip = folder.get(root.id) ?? ''
    chosen = [root]
    if (input.children) {
      for (let i = 0; i < chosen.length; i++) chosen.push(...(children.get(chosen[i]?.id ?? null) ?? []))
    }
  }

  // Los enlaces de las propiedades: el título si no se repite en el mundo; si no, su sitio en el .zip
  const titleCount = new Map<string, number>()
  for (const page of all)
    titleCount.set(page.title.toLocaleLowerCase('es'), (titleCount.get(page.title.toLocaleLowerCase('es')) ?? 0) + 1)
  const linkTo = (id: string) => {
    const page = byId.get(id)
    if (!page) return id
    return (titleCount.get(page.title.toLocaleLowerCase('es')) ?? 0) > 1 ? (path.get(id) ?? page.title) : page.title
  }

  const nameOfFile = await fileNames(ctx, wiki.worldId)

  const documents = await documentsRepo.documentsWithState(
    ctx.db,
    chosen.map((page) => page.id)
  )
  const files: Record<string, Uint8Array> = {}
  for (const page of chosen) {
    const own = documents.filter((doc) => doc.pageId === page.id)
    const stored = own.find((doc) => doc.kind === 'body')?.state ?? null
    const body = documentJson(ctx, { kind: 'body', pageId: page.id }, stored)
    const separates = new Map<string, JSONContent[]>()
    for (const doc of own) {
      if (doc.kind === 'body') continue
      separates.set(
        doc.id,
        documentJson(ctx, { kind: 'separate', documentId: doc.id, pageId: page.id }, doc.state).content ?? []
      )
    }
    const markdown = pageToMarkdown({
      properties: propertiesOf(page.properties),
      body,
      separate: (documentId) => separates.get(documentId) ?? null,
      pageTitle: linkTo,
      fileName: nameOfFile
    })
    // Una página sola, sin su rama: su nota, aunque tenga hijas
    const full = pageId && !input.children && page.id === pageId ? fileName(page.title) : (path.get(page.id) ?? page.id)
    const relative = strip && full.startsWith(`${strip}/`) ? full.slice(strip.length + 1) : full
    files[`${relative}.md`] = strToU8(markdown)
  }
  return { name: fileName(name), zip: zipSync(files, { level: 6 }) }
}

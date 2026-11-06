/**
 * La búsqueda de la wiki (ADR-0003): lo que se guarda para buscar (el texto plano y las secciones de cada documento)
 * y la consulta. Indexar va con cada guardado; lo que no se indexó (lo de antes) se indexa al buscar en su mundo
 */
import { documentsRepo, pagesRepo, searchRepo } from '@crisol/db'
import { plainText, sectionsOf, separateHeadings } from '@crisol/editor'
import type { JSONContent } from '@tiptap/core'
import type { ActionEnv } from '../actions/context.ts'
import { documentJson } from './content.ts'

export const SEARCH_PAGE_SIZE = 20

/** Guarda lo que se busca de un documento: su texto plano y sus secciones (y pide poner al día sus trozos) */
export async function indexDocument(env: Pick<ActionEnv, 'db' | 'library'>, documentId: string, json: JSONContent) {
  await documentsRepo.setText(env.db, documentId, plainText(json))
  await searchRepo.replaceSections(env.db, documentId, sectionsOf(json))
  await env.library?.refresh()
}

/** Lo mismo para muchos documentos de una vez (los de una tanda de páginas nuevas): en dos consultas */
export async function indexDocuments(
  env: Pick<ActionEnv, 'db' | 'library'>,
  docs: readonly { documentId: string; json: JSONContent }[]
) {
  if (docs.length === 0) return
  await documentsRepo.setTexts(
    env.db,
    docs.map((doc) => ({ id: doc.documentId, text: plainText(doc.json) }))
  )
  await searchRepo.replaceSectionsMany(
    env.db,
    docs.map((doc) => ({ documentId: doc.documentId, sections: sectionsOf(doc.json) }))
  )
  await env.library?.refresh()
}

/** Indexa lo que falte en el mundo (los documentos de antes de la búsqueda, o de antes de guardar su texto) */
export async function indexMissing(env: ActionEnv, worldId: string, onError?: (error: unknown) => void) {
  for (const doc of await searchRepo.unindexedDocuments(env.db, worldId)) {
    const ref =
      doc.kind === 'body'
        ? ({ kind: 'body', pageId: doc.pageId } as const)
        : ({ kind: 'separate', documentId: doc.id, pageId: doc.pageId } as const)
    // Uno que no se puede indexar no deja al mundo sin búsqueda
    await indexDocument(env, doc.id, documentJson(env, ref, doc.state)).catch((error: unknown) => onError?.(error))
  }
}

export interface SearchInput {
  worldId: string
  /** Sin ella, con plantilla: todas sus páginas por título */
  query?: string | undefined
  tag?: string | undefined
  branchId?: string | undefined
  /** La plantilla ya resuelta (su id) y el campo de enlace con la página a la que apunta */
  template?: string | null
  link?: { field: string; pageId: string } | null
  page: number
}

/**
 * Lo de un secreto o una nota oculta sin título propio lleva el de la sección del cuerpo donde está su bloque. Se mira
 * al buscar, en el cuerpo de ahora: así sigue bien aunque se mueva el secreto o se cambie el título
 */
async function withBodyHeadings<
  T extends { pageId: string; documentId: string; kind: string; heading: string | null; headingId: string | null }
>(env: ActionEnv, sections: T[]): Promise<T[]> {
  const loose = (section: T) => (section.kind === 'secret' || section.kind === 'note') && section.heading === null
  const pageIds = [...new Set(sections.filter(loose).map((section) => section.pageId))]
  const headings = new Map<string, { heading: string | null; headingId: string | null }>()
  for (const pageId of pageIds) {
    const body = await documentsRepo.findBody(env.db, pageId)
    if (!body) continue
    for (const [documentId, place] of separateHeadings(documentJson(env, { kind: 'body', pageId }, body.state)))
      headings.set(documentId, place)
  }
  return sections.map((section) => (loose(section) ? { ...section, ...headings.get(section.documentId) } : section))
}

/** Las páginas que coinciden, con su ruta y las secciones donde sale lo buscado */
export async function searchWorld(env: ActionEnv, input: SearchInput) {
  await indexMissing(env, input.worldId)
  const words = input.query ? searchRepo.searchTerms(input.query) : []
  const terms = words.length > 0 ? await searchRepo.similarWords(env.db, input.worldId, words) : []
  const options = {
    worldId: input.worldId,
    tag: input.tag ?? null,
    branchId: input.branchId ?? null,
    template: input.template ?? null,
    link: input.link ?? null,
    offset: (input.page - 1) * SEARCH_PAGE_SIZE,
    limit: SEARCH_PAGE_SIZE
  }
  const { total, pages } =
    input.query === undefined && input.template
      ? await searchRepo.templatePages(env.db, options)
      : await searchRepo.searchPages(env.db, { ...options, terms })
  const sections = await withBodyHeadings(
    env,
    await searchRepo.matchingSections(
      env.db,
      pages.map((page) => page.id),
      terms
    )
  )
  const paths = await pagesRepo.pagePaths(
    env.db,
    pages.map((page) => page.id)
  )
  return {
    total,
    page: input.page,
    pageSize: SEARCH_PAGE_SIZE,
    results: pages.map((page) => ({
      id: page.id,
      title: page.title,
      icon: page.icon,
      path: paths.get(page.id) ?? [],
      sections: sections
        .filter((section) => section.pageId === page.id)
        .map((section) => ({
          heading: section.heading,
          headingId: section.headingId,
          secret: section.kind === 'secret' || section.kind === 'note',
          excerpt: section.excerpt
        }))
    }))
  }
}

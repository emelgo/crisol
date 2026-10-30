/**
 * La búsqueda de la wiki (ADR-0003): lo que se guarda para buscar (el texto plano y las secciones de cada documento)
 * y la consulta. Indexar va con cada guardado; lo que no se indexó (lo de antes) se indexa al buscar en su mundo
 */
import { documentsRepo, pagesRepo, searchRepo } from '@crisol/db'
import { plainText, sectionsOf } from '@crisol/editor'
import type { JSONContent } from '@tiptap/core'
import type { ActionEnv } from '../actions/context.ts'
import { documentJson } from './content.ts'

export const SEARCH_PAGE_SIZE = 20

/** Guarda lo que se busca de un documento: su texto plano y sus secciones */
export async function indexDocument(env: Pick<ActionEnv, 'db'>, documentId: string, json: JSONContent) {
  await documentsRepo.setText(env.db, documentId, plainText(json))
  await searchRepo.replaceSections(env.db, documentId, sectionsOf(json))
}

/** Indexa lo que falte en el mundo (los documentos de antes de la búsqueda, o de antes de guardar su texto) */
export async function indexMissing(env: ActionEnv, worldId: string) {
  for (const doc of await searchRepo.unindexedDocuments(env.db, worldId)) {
    const ref =
      doc.kind === 'body'
        ? ({ kind: 'body', pageId: doc.pageId } as const)
        : ({ kind: 'separate', documentId: doc.id, pageId: doc.pageId } as const)
    await indexDocument(env, doc.id, documentJson(env, ref, doc.state))
  }
}

export interface SearchInput {
  worldId: string
  query: string
  tag?: string | undefined
  branchId?: string | undefined
  page: number
}

/** Las páginas que coinciden, con su ruta y las secciones donde sale lo buscado */
export async function searchWorld(env: ActionEnv, input: SearchInput) {
  await indexMissing(env, input.worldId)
  const words = searchRepo.searchTerms(input.query)
  const terms = words.length > 0 ? await searchRepo.similarWords(env.db, input.worldId, words) : []
  const { total, pages } = await searchRepo.searchPages(env.db, {
    worldId: input.worldId,
    terms,
    tag: input.tag ?? null,
    branchId: input.branchId ?? null,
    offset: (input.page - 1) * SEARCH_PAGE_SIZE,
    limit: SEARCH_PAGE_SIZE
  })
  const sections = await searchRepo.matchingSections(
    env.db,
    pages.map((page) => page.id),
    terms
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
          secret: section.kind !== 'body',
          excerpt: section.excerpt
        }))
    }))
  }
}

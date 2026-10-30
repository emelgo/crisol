/**
 * Un cambio de Claude en el cuerpo de una página, sobre su JSON: añadir al final, cambiar todo, un bloque (por su id) o
 * una sección (lo de debajo de un título, por su id o su texto; el título se queda)
 */
import type { JSONContent } from '@tiptap/core'
import { fillJsonIds } from '../ids.ts'

export type BodyEdit =
  | { mode: 'append' }
  | { mode: 'replace' }
  | { mode: 'block'; blockId: string }
  | { mode: 'section'; section: string }

export type EditProblem = 'BLOCK_NOT_FOUND' | 'SECTION_NOT_FOUND' | 'AMBIGUOUS_SECTION'

export class EditTargetError extends Error {
  readonly code: EditProblem
  constructor(code: EditProblem) {
    super(code)
    this.code = code
    this.name = 'EditTargetError'
  }
}

const plainText = (node: JSONContent): string =>
  node.text ?? (node.content ?? []).map((child) => (child.type === 'hardBreak' ? ' ' : plainText(child))).join('')

const isEmptyParagraph = (node: JSONContent) => node.type === 'paragraph' && plainText(node).trim() === ''

/** Dónde empieza y acaba (sin incluir) lo de debajo de un título: hasta el siguiente título de su nivel o más alto */
function sectionRange(blocks: JSONContent[], section: string): [number, number] {
  const wanted = section.trim().toLocaleLowerCase('es')
  const byId = blocks.findIndex((block) => block.type === 'heading' && block.attrs?.id === section.trim())
  const byText = blocks.flatMap((block, index) =>
    block.type === 'heading' && plainText(block).trim().toLocaleLowerCase('es') === wanted ? [index] : []
  )
  if (byId === -1 && byText.length > 1) throw new EditTargetError('AMBIGUOUS_SECTION')
  const start = byId !== -1 ? byId : byText[0]
  if (start === undefined) throw new EditTargetError('SECTION_NOT_FOUND')
  const level = Number(blocks[start]?.attrs?.level ?? 1)
  let end = start + 1
  while (end < blocks.length && !(blocks[end]?.type === 'heading' && Number(blocks[end]?.attrs?.level) <= level)) end++
  return [start + 1, end]
}

/**
 * El cuerpo con el cambio hecho, y los ids de los bloques de primer nivel nuevos (para resaltarlos). Los bloques que
 * llegan sin id lo reciben; uno que repita el id de otro que se queda, uno nuevo
 */
export function editBody(
  current: JSONContent,
  edit: BodyEdit,
  incoming: JSONContent[]
): { body: JSONContent; changed: string[] } {
  const blocks = current.content ?? []
  let before: JSONContent[]
  let after: JSONContent[]
  switch (edit.mode) {
    case 'append': {
      // Un cuerpo vacío (un párrafo en blanco) no deja ese párrafo delante
      const kept = blocks.length === 1 && blocks[0] && isEmptyParagraph(blocks[0]) ? [] : blocks
      before = kept
      after = []
      break
    }
    case 'replace':
      before = []
      after = []
      break
    case 'block': {
      const index = blocks.findIndex((block) => block.attrs?.id === edit.blockId)
      if (index === -1) throw new EditTargetError('BLOCK_NOT_FOUND')
      before = blocks.slice(0, index)
      after = blocks.slice(index + 1)
      // El primero de lo nuevo se queda con el id del cambiado si no trae otro: los enlaces a ese bloque siguen valiendo
      const [first, ...rest] = incoming
      if (first && !first.attrs?.id) incoming = [{ ...first, attrs: { ...first.attrs, id: edit.blockId } }, ...rest]
      break
    }
    case 'section': {
      const [start, end] = sectionRange(blocks, edit.section)
      before = blocks.slice(0, start)
      after = blocks.slice(end)
      break
    }
  }
  // Primero lo que se queda, para que conserve sus ids; luego lo nuevo
  const seen = new Set<string>()
  const keptBefore = before.map((block) => fillJsonIds(block, seen))
  const keptAfter = after.map((block) => fillJsonIds(block, seen))
  const added = incoming.map((block) => fillJsonIds(block, seen))
  const content = [...keptBefore, ...added, ...keptAfter]
  return {
    body: {
      ...current,
      type: 'doc',
      content: content.length > 0 ? content : [fillJsonIds({ type: 'paragraph' }, seen)]
    },
    changed: added.map((block) => String(block.attrs?.id ?? '')).filter(Boolean)
  }
}

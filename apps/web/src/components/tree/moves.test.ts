import { describe, expect, it } from 'vitest'
import { dropMove, isInside, keyboardMove, outdentTarget, type TreeNode, type TreeRow, zoneAt } from './moves.ts'

// Un árbol de ejemplo: Eana > (Norte > Hielo), Sur; y Valdren suelta
const nodes: TreeNode[] = [
  { id: 'eana', parentId: null },
  { id: 'norte', parentId: 'eana' },
  { id: 'hielo', parentId: 'norte' },
  { id: 'sur', parentId: 'eana' },
  { id: 'valdren', parentId: null }
]
const byId = new Map(nodes.map((n) => [n.id, n]))
const parentOf = (id: string) => byId.get(id)?.parentId
const node = (id: string) => byId.get(id) as TreeNode

interface Row extends TreeRow {
  id: string
}
// Todo desplegado, en el orden en que se pinta
const rows: Row[] = [
  { id: 'eana', level: 1, posinset: 1, setsize: 2, expanded: true },
  { id: 'norte', level: 2, posinset: 1, setsize: 2, expanded: true },
  { id: 'hielo', level: 3, posinset: 1, setsize: 1, expanded: false },
  { id: 'sur', level: 2, posinset: 2, setsize: 2, expanded: false },
  { id: 'valdren', level: 1, posinset: 2, setsize: 2, expanded: false }
]
const rowOf = (id: string) => rows.find((r) => r.id === id)
const nodeOfRow = (row: Row) => node(row.id)

describe('mover en un árbol', () => {
  it('la zona: el cuarto de arriba, delante; el de abajo, detrás; el resto, dentro (sin «dentro», mitad y mitad)', () => {
    expect(zoneAt(0.1)).toBe('before')
    expect(zoneAt(0.5)).toBe('inside')
    expect(zoneAt(0.9)).toBe('after')
    expect(zoneAt(0.4, false)).toBe('before')
    expect(zoneAt(0.6, false)).toBe('after')
  })

  it('sabe si algo está dentro de otro (o es él)', () => {
    expect(isInside(parentOf, 'hielo', 'eana')).toBe(true)
    expect(isInside(parentOf, 'eana', 'eana')).toBe(true)
    expect(isInside(parentOf, 'valdren', 'eana')).toBe(false)
  })

  it('con Alt y las flechas: entre hermanas, dentro de la de encima y fuera de su madre', () => {
    const siblings = [node('norte'), node('sur')]
    expect(keyboardMove(node('sur'), siblings, (id) => byId.get(id), 'ArrowUp')).toEqual({
      parentId: 'eana',
      before: 'norte'
    })
    expect(keyboardMove(node('norte'), siblings, (id) => byId.get(id), 'ArrowDown')).toEqual({
      parentId: 'eana',
      after: 'sur'
    })
    expect(keyboardMove(node('sur'), siblings, (id) => byId.get(id), 'ArrowRight')).toEqual({ parentId: 'norte' })
    expect(keyboardMove(node('norte'), siblings, (id) => byId.get(id), 'ArrowLeft')).toEqual({
      parentId: null,
      after: 'eana'
    })
    // La primera no sube ni entra en nada; una de lo más alto no sale
    expect(keyboardMove(node('norte'), siblings, (id) => byId.get(id), 'ArrowUp')).toBeNull()
    expect(keyboardMove(node('eana'), [node('eana'), node('valdren')], (id) => byId.get(id), 'ArrowLeft')).toBeNull()
  })

  it('al soltar: dentro, delante o detrás; nunca en sí mismo ni dentro de lo suyo', () => {
    expect(dropMove(node('valdren'), node('norte'), 'inside', parentOf)).toEqual({ parentId: 'norte' })
    expect(dropMove(node('valdren'), node('norte'), 'before', parentOf)).toEqual({ parentId: 'eana', before: 'norte' })
    expect(dropMove(node('valdren'), node('sur'), 'after', parentOf)).toEqual({ parentId: 'eana', after: 'sur' })
    expect(dropMove(node('eana'), node('eana'), 'inside', parentOf)).toBeNull()
    expect(dropMove(node('eana'), node('hielo'), 'inside', parentOf)).toBeNull()
    expect(dropMove(node('eana'), node('hielo'), 'after', parentOf)).toBeNull()
  })

  it('llevado a la izquierda, sale de su madre: sobre su fila, un nivel por paso; desde la última de la rama, detrás', () => {
    // Hielo, arrastrada sobre sí misma un paso a la izquierda: detrás de Norte
    const out = outdentTarget(rowOf('hielo') as Row, nodeOfRow, rowOf, 'inside', 1, 'hielo')
    expect(out?.id).toBe('norte')
    expect(dropMove(node('hielo'), node('hielo'), 'inside', parentOf, out ? nodeOfRow(out) : null)).toEqual({
      parentId: 'eana',
      after: 'norte'
    })
    // Valdren, soltada detrás de Sur (la última de Eana) dos pasos a la izquierda: detrás de Eana, arriba del todo
    const twice = outdentTarget(rowOf('sur') as Row, nodeOfRow, rowOf, 'after', 1, 'valdren')
    expect(twice?.id).toBe('eana')
    // Sin llevarlo a la izquierda, o desde una que no es la última de su rama, no sale
    expect(outdentTarget(rowOf('sur') as Row, nodeOfRow, rowOf, 'after', 0, 'valdren')).toBeNull()
    expect(outdentTarget(rowOf('norte') as Row, nodeOfRow, rowOf, 'after', 1, 'valdren')).toBeNull()
  })
})

/**
 * La paginación de la vista de hoja (spec § `hojas`): por bloques, que nunca se parten. Cada página es una lista de
 * filas: a dos columnas (la primera se llena antes) o a lo ancho. Los saltos fuerzan página o columna; un título va
 * con el bloque siguiente; antes de un bloque a lo ancho se equilibran las dos columnas (salvo un salto de columna a
 * mano); lo que no cabe ni en una página vacía va igual y la página lo avisa
 */

export type SheetBlockKind = 'block' | 'heading' | 'wide' | 'pageBreak' | 'columnBreak'

export interface SheetBlock {
  id: string
  kind: SheetBlockKind
  /** Lo que ocupa en su columna (o a lo ancho), en px, con sus márgenes */
  height: number
}

export type SheetRow = { kind: 'columns'; columns: [string[], string[]] } | { kind: 'wide'; id: string }

export interface SheetPage {
  rows: SheetRow[]
  /** Los bloques que no caben ni en una página vacía (van igual; la página lo avisa) */
  overflow: string[]
}

/** Dónde partir una lista de alturas en dos columnas para que la más alta sea lo más baja posible (la 1.ª primero) */
function balanced(heights: readonly number[]) {
  const total = heights.reduce((sum, h) => sum + h, 0)
  let best = heights.length
  let bestHeight = total
  let left = 0
  for (let split = 0; split <= heights.length; split++) {
    const tallest = Math.max(left, total - left)
    if (tallest < bestHeight) {
      best = split
      bestHeight = tallest
    }
    left += heights[split] ?? 0
  }
  return best
}

export function paginate(blocks: readonly SheetBlock[], pageHeight: number): SheetPage[] {
  const pages: SheetPage[] = []
  let rows: SheetRow[] = []
  let overflow: string[] = []
  let used = 0
  // La fila a dos columnas en curso
  let columns: [SheetBlock[], SheetBlock[]] = [[], []]
  let column: 0 | 1 = 0
  let forced = false
  const height = (list: readonly SheetBlock[]) => list.reduce((sum, b) => sum + b.height, 0)
  const available = () => pageHeight - used

  const closeColumns = (balance: boolean) => {
    if (columns[0].length === 0 && columns[1].length === 0) return
    let [left, right] = columns
    if (balance && !forced) {
      const all = [...left, ...right]
      const split = balanced(all.map((b) => b.height))
      left = all.slice(0, split)
      right = all.slice(split)
    }
    rows.push({ kind: 'columns', columns: [left.map((b) => b.id), right.map((b) => b.id)] })
    used += Math.max(height(left), height(right))
    columns = [[], []]
    column = 0
    forced = false
  }
  const newPage = () => {
    closeColumns(false)
    if (rows.length > 0 || overflow.length > 0) pages.push({ rows, overflow })
    rows = []
    overflow = []
    used = 0
  }

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i] as SheetBlock
    if (block.kind === 'pageBreak') {
      newPage()
      continue
    }
    if (block.kind === 'columnBreak') {
      if (column === 0) {
        column = 1
        forced = true
      } else newPage()
      continue
    }
    if (block.kind === 'wide') {
      closeColumns(true)
      if (block.height > available() && rows.length > 0) newPage()
      if (block.height > pageHeight) overflow.push(block.id)
      rows.push({ kind: 'wide', id: block.id })
      used += block.height
      continue
    }
    // Un título no se queda solo al pie: cuenta con lo que le sigue
    const next = blocks[i + 1]
    const unit = block.kind === 'heading' && next?.kind === 'block' ? block.height + next.height : block.height
    if (height(columns[column]) + unit > available()) {
      if (column === 0 && columns[0].length > 0) column = 1
      else if (columns[0].length > 0 || columns[1].length > 0 || rows.length > 0) newPage()
      // En la columna nueva tampoco cabe: si aún hay sitio en la página, a la página siguiente
      if (height(columns[column]) + unit > available() && (columns[0].length > 0 || rows.length > 0)) newPage()
    }
    if (block.height > pageHeight) overflow.push(block.id)
    columns[column].push(block)
  }
  newPage()
  return pages
}

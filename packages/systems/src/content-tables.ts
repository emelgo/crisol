/**
 * Las tablas de tirar del texto de un documento del contenido (la Bolsa de trucos, Confusión, las Fichas de pluma): las
 * de Markdown con un dado en su primera columna («d100», «1d8»). Cada fila, con su rango («1–2», «01–05», «96–00») y
 * sus celdas. Se tiran en la campaña desde el compendio
 */

export interface ContentTable {
  /** Lo que se tira: «1d100» */
  formula: string
  header: string[]
  /** Cada fila, con su rango y sus celdas; dónde está (su línea, desde la primera tras la raya, y su primera columna) */
  rows: { from: number; to: number; cells: string[]; line: number; column: number }[]
}

/** Las celdas de una fila: | a | b | */
export const tableCells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim())

/** La raya bajo la cabecera: | --- | :---: | */
export const isTableRule = (line: string) => /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(line.trim())

const plain = (cell: string) => cell.replace(/[*_]/g, '').trim()

/** Un número de una fila: «00» en un d100 (o «0» en un d10) es el máximo */
const rangeValue = (written: string, sides: number) => {
  const n = Number(written)
  return n === 0 ? sides : n
}

/** Una tabla de Markdown (sus líneas, cabecera y raya incluidas), si es de tirar: con un dado en su primera columna */
export function diceTableOf(lines: readonly string[]): ContentTable | null {
  const [head, rule, ...body] = lines
  if (!head || !rule || !isTableRule(rule)) return null
  const header = tableCells(head)
  const die = /^(\d*)d(\d+)$/i.exec(plain(header[0] ?? ''))
  if (!die) return null
  const sides = Number(die[2])
  const count = Number(die[1] || 1)
  // Una tabla en dos mitades, una al lado de la otra («1d8 | Criatura | 1d8 | Criatura»): cada mitad, aparte
  const starts = header.flatMap((cell, i) =>
    plain(cell).toLowerCase() === plain(header[0] ?? '').toLowerCase() ? [i] : []
  )
  const rows = starts.flatMap((column, g) =>
    body.flatMap((line, at) => {
      const cells = tableCells(line).slice(column, starts[g + 1] ?? header.length)
      const range = /^(\d+)(?:\s*[–—-]\s*(\d+))?$/.exec(plain(cells[0] ?? ''))
      if (!range) return []
      const from = rangeValue(range[1] as string, sides)
      const to = range[2] === undefined ? from : rangeValue(range[2], sides)
      return [{ from, to, cells, line: at, column }]
    })
  )
  return rows.length > 0 ? { formula: `${count}d${sides}`, header, rows } : null
}

/** Las tablas de tirar de un texto, en su orden */
export function contentTables(text: string): ContentTable[] {
  const tables: ContentTable[] = []
  let block: string[] = []
  const flush = () => {
    const found = block.length > 0 ? diceTableOf(block) : null
    if (found) tables.push(found)
    block = []
  }
  for (const line of text.split('\n')) {
    if (line.trim().startsWith('|')) block.push(line)
    else flush()
  }
  flush()
  return tables
}

/** La fila de un total; si ninguna lo abarca, null */
export function tableRowOf(table: ContentTable, total: number) {
  return table.rows.find((r) => r.from <= total && total <= r.to) ?? null
}

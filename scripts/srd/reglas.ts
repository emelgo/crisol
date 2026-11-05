/**
 * El texto de las reglas de los dos SRD (los estados, los capítulos de reglas, el glosario): las líneas en orden de
 * lectura, cortadas por sus títulos y pasadas a Markdown, con sus apartados, sus viñetas, sus tablas y sus recuadros. Lo
 * que es cada línea lo dice su alto (el tamaño de su letra), que cambia de un PDF a otro: va en su perfil
 */
import { type Box, boxesOf, type Edition, type Lang, type Row, rowsIn, widthOf } from './texto.ts'

/** Un trozo con título: su nombre, su página, el alto de su título y sus líneas */
export interface Entry {
  name: string
  page: number
  h: number
  rows: Row[]
}

/** Qué columna de la página es una línea (las páginas tienen dos) */
const columnOf = (row: Row) => `${row.page}:${row.x < 300 ? 0 : 1}`

/**
 * Corta las líneas por sus títulos: cada título empieza un trozo (lo de antes del primero no va en ninguno). Un título
 * partido en dos líneas seguidas va junto. Para en `stop`
 */
export function cut(rows: readonly Row[], isHeading: (row: Row) => boolean, stop?: RegExp): Entry[] {
  const out: Entry[] = []
  let last: Row | null = null
  for (const row of rows) {
    if (stop?.test(row.text)) break
    if (isHeading(row)) {
      const current = out.at(-1)
      // La segunda línea de un título partido: justo debajo y del mismo tamaño
      if (current && last && current.rows.length === 0 && isHeading(last) && sameBlock(last, row))
        current.name = joinLine(current.name, row.text)
      else out.push({ name: row.text, page: row.page, h: row.h, rows: [] })
    } else out.at(-1)?.rows.push(row)
    last = row
  }
  return out
}

/** Dos líneas seguidas del mismo bloque: del mismo alto, en la misma página y justo una debajo de la otra */
const sameBlock = (a: Row, b: Row) => a.h === b.h && a.page === b.page && b.y > a.y && b.y - a.y < 1.6 * b.h + 2

/** Une dos líneas: sin el guion de una palabra partida; si no, con un espacio */
export function joinLine(text: string, line: string): string {
  if (/[a-záéíóúüñ]-$/i.test(text) && /^[a-záéíóúüñ]/.test(line)) return text.slice(0, -1) + line
  return `${text} ${line}`
}

/** Una línea que empieza en minúscula sigue la frase de antes (un párrafo nuevo empieza en mayúscula) */
const lower = (line: string) => /^[a-záéíóúüñ]/.test(line)

/** Lo que empieza una viñeta */
const BULLET = /^[•●▪]\s*/

/** Qué es cada línea de un PDF, por su alto */
export interface Profile {
  /** Los títulos de apartado, por nivel (### y ####) */
  headings: number[][]
  /** Los títulos de las tablas */
  tableTitles: number[]
  /** Las filas de las tablas (también su cabecera) */
  cells: number[]
  /** Los recuadros: el alto de su título y el de su texto */
  sidebar?: { title: number; body: number }
  /** El alto del texto de siempre (para saber dónde acaba una tabla que no va) */
  body: number[]
}

export interface TextOptions {
  /** Las líneas de la cabecera de una tabla («Level Effect»): lo que sigue, mientras empiece por un número, son sus filas */
  tables?: RegExp
  /** Dónde empieza cada columna (si no, donde empieza la línea más a la izquierda de cada una) */
  bases?: ReadonlyMap<string, number>
  profile?: Profile
  /** Las tablas que no van, por su título: las listas de objetos que ya son contenido (y que no caben en una columna) */
  dropTables?: RegExp
}

/** Dónde empieza cada columna de unas líneas: la más a la izquierda (la del texto de un recuadro, aparte) */
export function basesOf(rows: readonly Row[], profile?: Profile): Map<string, number> {
  const bases = new Map<string, number>()
  for (const row of rows) {
    const key = baseKey(row, profile)
    bases.set(key, Math.min(bases.get(key) ?? row.x, row.x))
  }
  return bases
}

const baseKey = (row: Row, profile?: Profile) => `${columnOf(row)}${row.h === profile?.sidebar?.body ? ':s' : ''}`

type Block =
  | { kind: 'p'; text: string; bullet: boolean; sidebar: boolean }
  | { kind: 'h'; text: string; level: number; last: Row; sidebar: boolean }
  | { kind: 'title'; text: string; last: Row }
  | { kind: 'table'; rows: { cells: string[]; x: number }[] }

/**
 * Las líneas de un trozo como Markdown: un párrafo nuevo si la línea va sangrada o es una viñeta («- »); la línea
 * sangrada que sigue a una viñeta es de la viñeta. Con un perfil, sus apartados («### »), sus tablas y sus recuadros
 */
export function textOf(rows: readonly Row[], options: TextOptions = {}): string {
  const { profile } = options
  const bases = options.bases ?? basesOf(rows, profile)
  const blocks: Block[] = []
  let simple: string[][] | null = null
  // En los capítulos con tablas que no van, solo van las filas de las tablas con su título
  let dropping = Boolean(options.dropTables)
  for (const row of rows) {
    // Lo de una tabla que no va, en toda la sección (y en las dos columnas): lo que no es texto ni título
    if (dropping && profile) {
      const known =
        profile.body.includes(row.h) ||
        profile.headings.some((hs) => hs.includes(row.h)) ||
        row.h === profile.sidebar?.title ||
        row.h === profile.sidebar?.body ||
        profile.tableTitles.includes(row.h)
      // Las filas de una tabla con su título (o tras un apartado) sí van
      const kept = ['title', 'table', 'h'].includes(blocks.at(-1)?.kind ?? '')
      if (!known && !(kept && profile.cells.includes(row.h))) continue
    }
    // Una consonante suelta es un trozo de la palabra que sigue, partida en el PDF («d estreza»)
    const line = row.text.replace(/(^|[^\d\s] )([b-df-hj-np-tv-xz]) (?=[a-záéíóúñ])/g, '$1$2')
    const current = blocks.at(-1)
    // Las tablas sencillas de los estados de 2014: un número y su texto
    if (options.tables?.test(line)) {
      simple = [line.split(' ')]
      blocks.push({ kind: 'table', rows: [{ cells: simple[0] as string[], x: row.x }] })
      continue
    }
    if (simple && current?.kind === 'table') {
      const cells = /^(\d+(?:[–-]\d+)?)\s+(.+)$/.exec(line)
      if (cells) {
        current.rows.push({ cells: [cells[1] as string, cells[2] as string], x: row.x })
        continue
      }
      simple = null
    }
    if (profile) {
      const level = profile.headings.findIndex((hs) => hs.includes(row.h))
      const sidebarTitle = row.h === profile.sidebar?.title
      if (level >= 0 || sidebarTitle) {
        const wanted = sidebarTitle ? 3 : 3 + level
        if (current?.kind === 'h' && current.level === wanted && sameBlock(current.last, row)) {
          current.text = joinLine(current.text, line)
          current.last = row
        } else blocks.push({ kind: 'h', text: line, level: wanted, last: row, sidebar: sidebarTitle })
        continue
      }
      if (profile.tableTitles.includes(row.h) && options.dropTables?.test(line)) {
        dropping = true
        continue
      }
      if (profile.tableTitles.includes(row.h)) {
        if (current?.kind === 'title' && sameBlock(current.last, row)) {
          current.text = joinLine(current.text, line)
          current.last = row
        } else blocks.push({ kind: 'title', text: line, last: row })
        continue
      }
      if (profile.cells.includes(row.h)) {
        const cells = row.cells && row.cells.length > 0 ? row.cells : [line]
        if (current?.kind === 'table') {
          const before = current.rows.at(-1)
          // Una celda sola, más a la derecha que la fila de antes: sigue su última celda (un texto partido)
          if (before && cells.length === 1 && row.x > before.x + 10 && current.rows.length > 1)
            before.cells[before.cells.length - 1] = joinLine(before.cells.at(-1) ?? '', cells[0] as string)
          else current.rows.push({ cells, x: row.x })
        } else blocks.push({ kind: 'table', rows: [{ cells, x: row.x }] })
        continue
      }
    }
    const sidebar = row.h === profile?.sidebar?.body
    const indented = row.x - (bases.get(baseKey(row, profile)) ?? row.x) > 3
    if (BULLET.test(line)) blocks.push({ kind: 'p', text: line.replace(BULLET, ''), bullet: true, sidebar })
    else if (current?.kind === 'p' && current.sidebar === sidebar && (!indented || current.bullet || lower(line)))
      current.text = joinLine(current.text, line)
    else {
      // Lo que sigue a una tabla o a un recuadro (sin un apartado nuevo en medio) es el párrafo que cortaron, si no acabó
      const at = blocks.findLastIndex((b) => b.kind === 'p' && !b.bullet && b.sidebar === sidebar)
      const open = blocks[at]
      const between = blocks.slice(at + 1)
      const cutOff =
        open?.kind === 'p' &&
        open !== current &&
        !/[.!?:”")]$/.test(open.text) &&
        (lower(line) || !indented) &&
        !between.some((b) => b.kind === 'h' && !b.sidebar)
      if (cutOff) open.text = joinLine(open.text, line)
      else blocks.push({ kind: 'p', text: line, bullet: false, sidebar })
    }
  }
  // Las viñetas seguidas van en una lista (separadas por una línea); lo demás, en bloques
  return blocks
    .map((b, i) => {
      const before = blocks[i - 1]
      const text = render(b)
      if (i === 0) return text
      const list = b.kind === 'p' && b.bullet && before?.kind === 'p' && before.bullet
      return `${list ? '\n' : '\n\n'}${text}`
    })
    .join('')
}

function render(block: Block): string {
  switch (block.kind) {
    case 'p':
      return block.bullet ? `- ${block.text}` : block.text
    case 'h':
      return `${'#'.repeat(block.level)} ${block.text}`
    case 'title':
      return `**${block.text}**`
    case 'table':
      return markdownTable(block.rows.map((r) => r.cells))
  }
}

/** Una tabla de Markdown: la primera fila es su cabecera; una fila con más celdas, las de más van en la última */
export function markdownTable(rows: string[][]): string {
  const [head = [], ...body] = rows
  const width = Math.max(head.length, 1)
  const fit = (cells: string[]) => {
    const out = cells.slice(0, width)
    if (cells.length > width) out[width - 1] = cells.slice(width - 1).join(' ')
    while (out.length < width) out.push('')
    return out
  }
  const header = head.length > 0 ? head : ['']
  return [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...body.map((r) => `| ${fit(r).join(' | ')} |`)
  ].join('\n')
}

/**
 * Las letras capitulares de los títulos de los recuadros de 2024 («E» + «xceptions»): van con su palabra, que empieza
 * justo donde acaba la letra (y con el alto de la palabra)
 */
export function joinDropCaps(boxes: readonly Box[], caps: number): Box[] {
  const out = boxes.map((b) => ({ ...b }))
  const gone = new Set<Box>()
  for (const cap of out) {
    if (cap.h !== caps || !/^[A-ZÁÉÍÓÚÑ¿¡]$/.test(cap.text)) continue
    const word = out.find(
      (b) => b !== cap && !gone.has(b) && Math.abs(b.x - cap.xMax) < 1.5 && b.y >= cap.y && b.y - cap.y < 8
    )
    if (!word) continue
    word.text = cap.text + word.text
    word.x = cap.x
    gone.add(cap)
  }
  // Lo demás del alto de las capitulares (un número: «Level 20») va en la línea del título
  for (const cap of out) {
    if (cap.h !== caps || gone.has(cap)) continue
    const same = out.find(
      (b) => b.h !== caps && !gone.has(b) && b.y >= cap.y && b.y - cap.y < 8 && Math.abs(b.x - cap.x) < 250
    )
    if (!same) continue
    cap.y = same.y
    cap.h = same.h
  }
  return out.filter((b) => !gone.has(b))
}

/** Las líneas de unas páginas a dos columnas, en orden de lectura, con las capitulares en su palabra */
export function ruleRows(edition: Edition, lang: Lang, pages: readonly number[], caps?: number): Row[] {
  return pages.flatMap((page) => {
    const all = boxesOf(edition, lang, page).filter((b) => b.y < 740)
    const body = caps ? joinDropCaps(all, caps) : all
    const width = widthOf(edition, lang, page)
    return [
      { x0: 0, x1: width / 2 },
      { x0: width / 2, x1: width }
    ].flatMap((half) => rowsIn(body, half))
  })
}

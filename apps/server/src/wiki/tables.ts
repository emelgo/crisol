/**
 * Las tablas que se llenan solas (ADR-0009): por cada bloque «Tabla de páginas» del panel, las páginas de una plantilla
 * (y de sus copias, por su linaje) cuyo campo apunta a esta página. Se calculan al leer: la web y la IA las reciben hechas
 */
import { type PageTables, pagePanel } from '@crisol/contracts'
import { pagesRepo } from '@crisol/db'
import type { PageProperty, PageTemplate } from '@crisol/domain'
import type { WikiTarget } from '../actions/access.ts'
import { type ActionContext, InvalidRequestError } from '../actions/context.ts'
import { visiblePanel, visibleProperties } from './projection.ts'
import { propertiesOf } from './properties.ts'
import type { WikiView } from './reader.ts'
import { usableTemplates } from './templates.ts'

/** Cuántas filas como mucho tiene una tabla (si hay más, lo dice) */
export const TABLE_ROWS = 100

type TableBlock = Extract<ReturnType<typeof pagePanel.parse>[number], { type: 'related' }>

/** Lo que se ve de una celda para ordenar por ella: su valor como texto (las páginas, por su título) */
const sortText = (cell: PageProperty | null, title: (id: string) => string) => {
  if (!cell) return ''
  if (cell.type === 'pages') return cell.value.map(title).join(', ')
  if (cell.type === 'list') return cell.value.join(', ')
  return String(cell.value ?? '')
}

export async function pageTables(
  ctx: ActionContext,
  wiki: WikiTarget,
  page: { id: string; panel: unknown },
  /** Quien lee: un jugador solo ve las tablas que no están ocultas, con las páginas que ve (ADR-0017) */
  view?: WikiView
): Promise<PageTables> {
  const panel = pagePanel.safeParse(page.panel).data ?? []
  const blocks = (view ? visiblePanel(panel, view) : panel).filter(
    (block): block is TableBlock => block.type === 'related'
  )
  const within = view?.visiblePageIds() ?? null
  if (blocks.length === 0) return { tables: [], linked: [] }
  const templates = await usableTemplates(ctx, wiki.organizationId)
  const found = await Promise.all(
    blocks.map(async (block) => {
      const template = templates.find((each) => each.id === block.template)
      // Sin configurar aún: sin filas (dice que se elijan la plantilla y su campo)
      const unset = !block.template || !block.field
      // Una plantilla propia borrada no estorba: sus páginas siguen con su linaje. Un campo que ya no está, sí
      const usable = !unset && (!template || template.fields.some((f) => f.field === block.field && f.type === 'pages'))
      const rows = usable
        ? await pagesRepo.relatedPages(ctx.db, {
            worldId: wiki.worldId,
            pageId: page.id,
            template: block.template,
            field: block.field,
            limit: TABLE_ROWS,
            ...(within ? { within } : {})
          })
        : []
      return { block, template, unset, usable, rows }
    })
  )
  // Los títulos de las páginas de las celdas, de una vez
  const cellsOf = (properties: unknown[], columns: readonly string[]) => {
    const all = view ? visibleProperties(propertiesOf(properties), view) : propertiesOf(properties)
    return columns.map((column) => all.find((property) => property.field === column) ?? null)
  }
  const linkedIds = new Set<string>()
  for (const { block, rows } of found) {
    for (const row of rows) {
      for (const cell of cellsOf(row.properties, block.columns)) {
        if (cell?.type === 'pages') for (const id of cell.value) linkedIds.add(id)
      }
    }
  }
  const titles = await pagesRepo.titlesOf(ctx.db, wiki.worldId, [...linkedIds])
  const title = (id: string) => titles.get(id) ?? ''
  const tables = found.map(({ block, template, unset, usable, rows }) => {
    const shown = rows.slice(0, TABLE_ROWS).map((row) => ({
      id: row.id,
      title: row.title,
      icon: row.icon,
      cells: cellsOf(row.properties, block.columns)
    }))
    const by = block.sort === 'title' ? -1 : block.columns.indexOf(block.sort)
    if (by >= 0) {
      shown.sort((a, b) => {
        const x = sortText(a.cells[by] ?? null, title)
        const y = sortText(b.cells[by] ?? null, title)
        // Lo vacío, al final
        if (!x !== !y) return x ? -1 : 1
        return x.localeCompare(y, 'es') || a.title.localeCompare(b.title, 'es')
      })
    }
    const columnName = (field: string) =>
      template?.fields.find((f) => f.field === field)?.name ??
      shown.flatMap((row) => row.cells).find((cell) => cell?.field === field)?.name ??
      field
    return {
      blockId: block.id,
      title: block.title,
      problem: unset ? ('unset' as const) : usable ? null : ('field' as const),
      columns: block.columns.map((field) => ({ field, name: columnName(field) })),
      rows: shown,
      more: rows.length > TABLE_ROWS
    }
  })
  return { tables, linked: [...titles].map(([id, linkedTitle]) => ({ id, title: linkedTitle })) }
}

/**
 * Antes de guardar un panel: cada tabla nueva o cambiada, con una plantilla que se puede usar, un campo de enlace suyo y
 * columnas suyas. Las que ya estaban se dejan (su plantilla puede haberse borrado)
 */
export async function checkTables(
  ctx: ActionContext,
  organizationId: string,
  before: unknown,
  after: readonly ReturnType<typeof pagePanel.parse>[number][],
  /** Las plantillas contra las que se mira, si no son las de ahora (al cambiar una que se nombra a sí misma) */
  against?: readonly PageTemplate[]
) {
  const old = new Map((pagePanel.safeParse(before).data ?? []).map((block) => [block.id, JSON.stringify(block)]))
  // Una sin configurar (sin plantilla ni campo) se guarda así: es como nace
  const changed = after.filter(
    (block): block is TableBlock =>
      block.type === 'related' &&
      old.get(block.id) !== JSON.stringify(block) &&
      !(block.template === '' && block.field === '')
  )
  if (changed.length === 0) return
  const templates = against ?? (await usableTemplates(ctx, organizationId))
  for (const block of changed) {
    const template = templates.find((each) => each.id === block.template)
    const fields = template?.fields ?? []
    const link = fields.find((f) => f.field === block.field && f.type === 'pages')
    const columnsOk = block.columns.every((column) => fields.some((f) => f.field === column))
    const sortOk = block.sort === 'title' || block.columns.includes(block.sort)
    if (!template || !link || !columnsOk || !sortOk) {
      throw new InvalidRequestError(
        'BAD_PAGE_TABLE',
        template
          ? `«${block.title || block.id}»: el campo y las columnas tienen que ser de ${template.name} (sus campos de enlace: ${fields
              .filter((f) => f.type === 'pages')
              .map((f) => `${f.name} = ${f.field}`)
              .join(', ')}), y el orden, «title» o una de las columnas`
          : `no hay ninguna plantilla «${block.template}»: mira listar_plantillas`
      )
    }
  }
}

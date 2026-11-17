/**
 * El editor visual de un gráfico (módulo 10, decisión 16; lienzo, pantalla 6), en el sitio del panel de la página
 * mientras el bloque está elegido: su título, el tipo (los seis), los datos (propios, en una tabla de etiquetas y
 * series, o de una tabla de la página), los colores, la leyenda y «Ver YAML» (que también se escribe). Cada cambio se
 * guarda al momento en el YAML del bloque, que conserva lo demás que llevaba
 */
import {
  CHART_TYPES,
  type ChartModel,
  type ChartType,
  chartModel,
  chartNumber,
  chartYaml,
  LEGEND_POSITIONS,
  resolveChart
} from '@crisol/editor'
import type { JSONContent } from '@tiptap/core'
import { ChartColumn, ChartLine, ChartPie, Code, Donut, Plus, Radar, Target, X } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { readTheme } from './chart-block.tsx'
import { chartColors, colorsByLabel } from './chart-config.ts'
import type { ChartEditing } from './chart-editing.ts'
import styles from './chart-editor.module.css'

const TYPE_ICONS: Record<ChartType, typeof ChartColumn> = {
  bar: ChartColumn,
  line: ChartLine,
  pie: ChartPie,
  doughnut: Donut,
  radar: Radar,
  polarArea: Target
}

/** Las tablas de la página (las que llevan id): su id y, para reconocerla, su primera fila */
function pageTables(doc: JSONContent): { id: string; name: string }[] {
  const found: { id: string; name: string }[] = []
  const text = (node: JSONContent): string =>
    node.type === 'text' ? (node.text ?? '') : (node.content ?? []).map(text).join(' ').trim()
  const walk = (node: JSONContent) => {
    if (node.type === 'table' && typeof node.attrs?.id === 'string') {
      const first = node.content?.[0]?.content?.map(text).filter(Boolean) ?? []
      found.push({ id: node.attrs.id, name: first.join(' · ').slice(0, 60) || node.attrs.id })
      return
    }
    for (const child of node.content ?? []) walk(child)
  }
  walk(doc)
  return found
}

/** Un hex de 6 cifras para <input type="color"> (los demás colores, al primero del tema) */
const hex = (color: string, fallback: string) => (/^#[0-9a-f]{6}$/i.test(color) ? color : fallback)

export function ChartEditor({ editing }: { editing: ChartEditing }) {
  const { t } = useTranslation()
  const { yaml, doc, update, close } = editing
  const model = useMemo(() => chartModel(yaml), [yaml])
  const [showYaml, setShowYaml] = useState(false)
  const theme = useMemo(() => readTheme(document.documentElement), [])
  const titleId = useId()
  const tables = useMemo(() => pageTables(doc), [doc])
  const save = (next: ChartModel) => update(chartYaml(next, yaml))

  return (
    <section className={styles.editor} aria-labelledby={titleId}>
      <header className={styles.head}>
        <h2 id={titleId}>
          <ChartColumn size={15} aria-hidden="true" />
          {t('charts.block')}
        </h2>
        <button
          type="button"
          className={styles.close}
          aria-label={t('charts.close')}
          title={t('charts.close')}
          onClick={close}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      {model ? (
        <ModelFields model={model} yaml={yaml} doc={doc} tables={tables} theme={theme} onChange={save} />
      ) : (
        <p className={styles.problem}>{t('charts.failed')}</p>
      )}
      <button
        type="button"
        className={styles.yamlToggle}
        aria-expanded={showYaml || !model}
        onClick={() => setShowYaml(!showYaml)}
      >
        <Code size={15} aria-hidden="true" />
        {showYaml || !model ? t('charts.hideYaml') : t('charts.showYaml')}
      </button>
      {(showYaml || !model) && <YamlField yaml={yaml} onChange={update} />}
    </section>
  )
}

function ModelFields({
  model,
  yaml,
  doc,
  tables,
  theme,
  onChange
}: {
  model: ChartModel
  yaml: string
  doc: JSONContent
  tables: { id: string; name: string }[]
  theme: ReturnType<typeof readTheme>
  onChange: (model: ChartModel) => void
}) {
  const { t } = useTranslation()
  const ids = { title: useId(), table: useId() }
  const byLabel = colorsByLabel({ type: model.type, options: {} })
  const palette = chartColors({ options: { colors: model.colors ?? [] } }, theme)
  const colorAt = (index: number) => hex(palette[index % palette.length] ?? '', theme.colors[0] ?? '#e9b872')
  const setColor = (index: number, color: string) => {
    const count = Math.max(index + 1, byLabel ? model.labels.length : model.series.length)
    const colors = Array.from({ length: count }, (_, i) => (i === index ? color : colorAt(i)))
    onChange({ ...model, colors })
  }
  const fromTable = model.table !== null
  // Los datos de la tabla, para seguir con ellos al pasar a propios
  const resolved = useMemo(() => resolveChart(yaml, doc), [yaml, doc])

  return (
    <div className={styles.fields}>
      <label htmlFor={ids.title}>{t('charts.title')}</label>
      <TextField id={ids.title} value={model.title} onCommit={(title) => onChange({ ...model, title })} />

      <span className={styles.label} id={`${ids.title}-tipo`}>
        {t('charts.type')}
      </span>
      <div className={styles.types} role="toolbar" aria-labelledby={`${ids.title}-tipo`}>
        {CHART_TYPES.map((type) => {
          const Icon = TYPE_ICONS[type]
          return (
            <button
              key={type}
              type="button"
              aria-pressed={model.type === type}
              onClick={() => onChange({ ...model, type })}
            >
              <Icon size={18} aria-hidden="true" />
              {t(`charts.types.${type}`)}
            </button>
          )
        })}
      </div>

      <span className={styles.label} id={`${ids.title}-datos`}>
        {t('charts.data')}
      </span>
      <div className={styles.segmented} role="toolbar" aria-labelledby={`${ids.title}-datos`}>
        <button
          type="button"
          aria-pressed={!fromTable}
          onClick={() => {
            if (!fromTable) return
            const data = resolved.chart
            onChange({
              ...model,
              table: null,
              labels: data && data.labels.length > 0 ? data.labels : ['A', 'B', 'C'],
              series:
                data && data.series.length > 0
                  ? data.series.map((series) => ({ ...series, extra: {} }))
                  : [{ title: t('charts.series', { n: 1 }), data: [1, 2, 3], extra: {} }]
            })
          }}
        >
          {t('charts.own')}
        </button>
        <button
          type="button"
          aria-pressed={fromTable}
          disabled={tables.length === 0}
          title={tables.length === 0 ? t('charts.noTables') : undefined}
          onClick={() => {
            const first = tables[0]
            if (!fromTable && first) onChange({ ...model, table: { id: first.id, byRows: false, select: null } })
          }}
        >
          {t('charts.fromTable')}
        </button>
      </div>

      {model.table ? (
        <>
          <label htmlFor={ids.table}>{t('charts.table')}</label>
          <select
            id={ids.table}
            value={model.table.id}
            onChange={(event) =>
              onChange({
                ...model,
                table: { ...(model.table ?? { byRows: false, select: null }), id: event.currentTarget.value }
              })
            }
          >
            {tables.some((each) => each.id === model.table?.id) ? null : (
              <option value={model.table.id}>{model.table.id}</option>
            )}
            {tables.map((each) => (
              <option key={each.id} value={each.id}>
                {each.name}
              </option>
            ))}
          </select>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={model.table.byRows}
              onChange={(event) =>
                onChange({
                  ...model,
                  table: { ...(model.table ?? { id: '', select: null }), byRows: event.currentTarget.checked }
                })
              }
            />
            {t('charts.byRows')}
          </label>
        </>
      ) : (
        <DataGrid model={model} byLabel={byLabel} colorAt={colorAt} onColor={setColor} onChange={onChange} />
      )}

      <span className={styles.label} id={`${ids.title}-leyenda`}>
        {t('charts.legend')}
      </span>
      <div className={styles.segmented} role="toolbar" aria-labelledby={`${ids.title}-leyenda`}>
        {LEGEND_POSITIONS.map((position) => (
          <button
            key={position}
            type="button"
            aria-pressed={model.legend === position}
            onClick={() => onChange({ ...model, legend: position })}
          >
            {t(`charts.legendPositions.${position}`)}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Las etiquetas y las series en una tabla: una fila por etiqueta y una columna por serie, con sus colores */
function DataGrid({
  model,
  byLabel,
  colorAt,
  onColor,
  onChange
}: {
  model: ChartModel
  byLabel: boolean
  colorAt: (index: number) => string
  onColor: (index: number, color: string) => void
  onChange: (model: ChartModel) => void
}) {
  const { t } = useTranslation()
  const setLabel = (row: number, label: string) =>
    onChange({ ...model, labels: model.labels.map((each, i) => (i === row ? label : each)) })
  const setSeriesTitle = (index: number, title: string) =>
    onChange({ ...model, series: model.series.map((each, i) => (i === index ? { ...each, title } : each)) })
  const setValue = (index: number, row: number, value: number | null) =>
    onChange({
      ...model,
      series: model.series.map((each, i) =>
        i === index
          ? {
              ...each,
              data: Array.from({ length: model.labels.length }, (_, r) => (r === row ? value : (each.data[r] ?? null)))
            }
          : each
      )
    })
  const addRow = () =>
    onChange({
      ...model,
      labels: [...model.labels, t('charts.labelOf', { n: model.labels.length + 1 })],
      series: model.series.map((each) => ({ ...each, data: [...each.data, null] }))
    })
  const addSeries = () =>
    onChange({
      ...model,
      series: [
        ...model.series,
        { title: t('charts.series', { n: model.series.length + 1 }), data: model.labels.map(() => null), extra: {} }
      ]
    })
  const removeRow = (row: number) =>
    onChange({
      ...model,
      labels: model.labels.filter((_, i) => i !== row),
      series: model.series.map((each) => ({ ...each, data: each.data.filter((_, i) => i !== row) })),
      colors: byLabel && model.colors ? model.colors.filter((_, i) => i !== row) : model.colors
    })
  const removeSeries = (index: number) =>
    onChange({
      ...model,
      series: model.series.filter((_, i) => i !== index),
      colors: !byLabel && model.colors ? model.colors.filter((_, i) => i !== index) : model.colors
    })
  return (
    <div className={styles.gridWrap}>
      <table className={styles.grid}>
        <thead>
          <tr>
            <th scope="col">{t('charts.label')}</th>
            {model.series.map((series, index) => (
              <th key={String(index)} scope="col">
                <span className={styles.headCell}>
                  {!byLabel && (
                    <ColorDot value={colorAt(index)} name={series.title} onChange={(color) => onColor(index, color)} />
                  )}
                  <TextField
                    value={series.title}
                    label={t('charts.series', { n: index + 1 })}
                    onCommit={(title) => setSeriesTitle(index, title)}
                  />
                  {model.series.length > 1 && (
                    <RemoveButton
                      label={t('charts.removeSeries', { name: series.title })}
                      onClick={() => removeSeries(index)}
                    />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {model.labels.map((label, row) => (
            <tr key={String(row)}>
              <th scope="row">
                <span className={styles.headCell}>
                  {byLabel && <ColorDot value={colorAt(row)} name={label} onChange={(color) => onColor(row, color)} />}
                  <TextField
                    value={label}
                    label={t('charts.labelOf', { n: row + 1 })}
                    onCommit={(next) => setLabel(row, next)}
                  />
                  {model.labels.length > 1 && (
                    <RemoveButton label={t('charts.removeRow', { name: label })} onClick={() => removeRow(row)} />
                  )}
                </span>
              </th>
              {model.series.map((series, index) => (
                <td key={String(index)}>
                  <NumberField
                    value={series.data[row] ?? null}
                    label={t('charts.value', { series: series.title, label })}
                    onCommit={(value) => setValue(index, row, value)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.adders}>
        <button type="button" onClick={addRow}>
          <Plus size={14} aria-hidden="true" />
          {t('charts.addRow')}
        </button>
        <button type="button" onClick={addSeries}>
          <Plus size={14} aria-hidden="true" />
          {t('charts.addSeries')}
        </button>
      </div>
    </div>
  )
}

/** Un texto que se guarda al salir o con Intro (mientras se escribe, no salta) */
function TextField({
  id,
  value,
  label,
  onCommit
}: {
  id?: string
  value: string
  label?: string
  onCommit: (value: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const [editing, setEditing] = useState(false)
  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])
  return (
    <input
      id={id}
      aria-label={label}
      value={draft}
      maxLength={120}
      autoComplete="off"
      data-1p-ignore
      data-lpignore="true"
      onFocus={() => setEditing(true)}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={() => {
        setEditing(false)
        if (draft !== value) onCommit(draft)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') {
          setDraft(value)
          event.currentTarget.blur()
        }
      }}
    />
  )
}

/** Un número (o vacío, un hueco): se guarda al salir o con Intro */
function NumberField({
  value,
  label,
  onCommit
}: {
  value: number | null
  label: string
  onCommit: (value: number | null) => void
}) {
  const [draft, setDraft] = useState(value === null ? '' : String(value))
  const [editing, setEditing] = useState(false)
  useEffect(() => {
    if (!editing) setDraft(value === null ? '' : String(value))
  }, [value, editing])
  return (
    <input
      className={styles.number}
      inputMode="decimal"
      aria-label={label}
      value={draft}
      autoComplete="off"
      onFocus={() => setEditing(true)}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={() => {
        setEditing(false)
        const next = chartNumber(draft)
        if (next !== value) onCommit(next)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
    />
  )
}

function ColorDot({ value, name, onChange }: { value: string; name: string; onChange: (color: string) => void }) {
  const { t } = useTranslation()
  return (
    <label className={styles.dot} style={{ background: value }} title={t('charts.color', { name })}>
      <input
        type="color"
        value={value}
        aria-label={t('charts.color', { name })}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  )
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className={styles.remove} aria-label={label} title={label} onClick={onClick}>
      <X size={12} aria-hidden="true" />
    </button>
  )
}

/** El YAML del bloque, que también se escribe: se guarda al salir */
function YamlField({ yaml, onChange }: { yaml: string; onChange: (yaml: string) => void }) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(yaml)
  const [editing, setEditing] = useState(false)
  useEffect(() => {
    if (!editing) setDraft(yaml)
  }, [yaml, editing])
  return (
    <textarea
      className={styles.yaml}
      aria-label={t('charts.yaml')}
      value={draft}
      spellCheck={false}
      rows={Math.min(16, Math.max(6, draft.split('\n').length + 1))}
      onFocus={() => setEditing(true)}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={() => {
        setEditing(false)
        if (draft !== yaml) onChange(draft)
      }}
    />
  )
}

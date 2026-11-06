/**
 * Una entrada «Tabla» del compendio (docs/specs/tablas-compendio.md): sus filas con su rango, «Tirar» en la campaña
 * (al registro, con el mismo cálculo que la pestaña «Tabla» de la wiki), lo que salió marcado y, en las que no repiten,
 * lo ya sacado y «Reiniciar» (el máster). Y el editor de sus filas, dentro del de la entrada
 */
import type { RollVisibility } from '@crisol/contracts'
import { type TableProblem, tableFormula, tableProblemList } from '@crisol/dice'
import type { TableEntry, TableEntryRow } from '@crisol/systems'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dices, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { FormError } from '../components/field.tsx'
import { ResetDialog } from '../wiki/table/table-tab.tsx'
import textStyles from './content-text.module.css'
import styles from './entry-table.module.css'

const range = (r: { from: number; to: number }) => (r.from === r.to ? String(r.from) : `${r.from}–${r.to}`)

export function EntryTable({
  campaignId,
  entryKey,
  name,
  table,
  drawn,
  master,
  visibility,
  onOpen
}: {
  campaignId: string
  entryKey: string
  name: string
  table: TableEntry
  /** Lo ya sacado en esta campaña (si no repite) */
  drawn: readonly string[]
  master: boolean
  visibility: RollVisibility
  onOpen: (key: string) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const client = useQueryClient()
  const errorText = useErrorText()
  const announce = useAnnounce()
  const [now, setNow] = useState<string[]>([])
  const [resetting, setResetting] = useState(false)
  const rows = [...table.rows].sort((a, b) => a.from - b.from)
  const once = table.replacement === false
  const out = new Set(drawn)
  const entryQuery = ['compendium', campaignId, 'entry', entryKey]
  const roll = useMutation({
    mutationFn: () => api.call('rollContentTable', { campaignId, key: entryKey, visibility }),
    onSuccess: (result) => {
      // Lo que salió: las filas que abarcan el total y no habían salido ya
      const total = result.roll.total
      setNow(rows.filter((r) => r.from <= total && total <= r.to && !out.has(r.id)).map((r) => r.id))
      const text = (result.roll.table?.results ?? []).map((r) => r.text).join(' · ')
      announce(t('tableTab.rolled', { total, text }))
      if (once) void client.invalidateQueries({ queryKey: entryQuery })
    }
  })
  const reset = useMutation({
    mutationFn: () => api.call('resetContentTable', { campaignId, key: entryKey }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: entryQuery })
      setNow([])
      setResetting(false)
    }
  })
  return (
    <section className={styles.box} aria-label={t('compendium.tableRows', { name })}>
      <div className={textStyles.tableBox}>
        <table className={textStyles.table}>
          <thead>
            <tr>
              <th scope="col">
                <button
                  type="button"
                  className={textStyles.roll}
                  aria-label={t('compendium.rollTable', {
                    formula: tableFormula(table.formula, table.rows),
                    what: name
                  })}
                  aria-disabled={roll.isPending || undefined}
                  onClick={() => {
                    if (!roll.isPending) roll.mutate()
                  }}
                >
                  <Dices size={14} aria-hidden="true" />
                  <span translate="no">{tableFormula(table.formula, table.rows)}</span>
                </button>
              </th>
              <th scope="col">{t('tableTab.result')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const hit = now.includes(r.id)
              return (
                <tr key={r.id} className={!hit && out.has(r.id) ? styles.out : undefined}>
                  <td className={hit ? textStyles.hit : styles.range}>{range(r)}</td>
                  <td className={hit ? textStyles.hit : undefined}>
                    {r.key ? (
                      <button type="button" className={styles.link} onClick={() => r.key && onOpen(r.key)}>
                        {r.text || r.key}
                      </button>
                    ) : (
                      r.text
                    )}
                    {hit && <span className={`${styles.tag} ${styles.now}`}>{t('tableTab.now')}</span>}
                    {!hit && out.has(r.id) && <span className={styles.tag}>{t('tableTab.drawn')}</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {once && (
        <p className={styles.drawn}>
          {t('tableTab.drawnCount', { count: out.size })}
          {master && (
            <button type="button" className={styles.reset} onClick={() => setResetting(true)} disabled={out.size === 0}>
              <RotateCcw size={14} aria-hidden="true" />
              {t('tableTab.reset')}
            </button>
          )}
        </p>
      )}
      <FormError message={roll.error ? errorText(roll.error) : null} />
      {resetting && (
        <ResetDialog
          busy={reset.isPending}
          error={reset.error ? errorText(reset.error) : null}
          onConfirm={() => reset.mutate()}
          onClose={() => {
            setResetting(false)
            reset.reset()
          }}
        />
      )}
    </section>
  )
}

const newId = () => crypto.randomUUID().slice(0, 8)

/** Una tabla vacía, para empezar: una fila */
export const emptyTable = (): TableEntry => ({ rows: [{ id: newId(), from: 1, to: 1, text: '' }] })

/** Lo que dice de sus rangos (las filas que se pisan salen juntas, como en Foundry: eso no es un problema) */
export function tableWarnings(table: TableEntry): TableProblem[] {
  return tableProblemList(table.formula, table.rows).filter((p) => p.code !== 'overlap')
}

/** Sus filas, en el editor de la entrada: la fórmula, si repite y cada fila con su rango y su texto */
export function TableRowsField({ table, onChange }: { table: TableEntry; onChange: (table: TableEntry) => void }) {
  const { t } = useTranslation()
  const formulaId = useId()
  const setRow = (id: string, change: Partial<TableEntryRow>) =>
    onChange({ ...table, rows: table.rows.map((r) => (r.id === id ? { ...r, ...change } : r)) })
  const top = Math.max(0, ...table.rows.map((r) => r.to))
  const problems = tableWarnings(table)
  const say = (p: TableProblem) =>
    (p.code === 'notIntegers' || p.code === 'backwards') && (Number.isNaN(p.from) || Number.isNaN(p.to))
      ? t('tableTab.problems.empty')
      : t(`tableTab.problems.${p.code}`, p)
  return (
    <fieldset className={styles.editor}>
      <legend>{t('compendium.rows')}</legend>
      <div className={styles.head}>
        <label htmlFor={formulaId}>{t('tableTab.formula')}</label>
        <input
          id={formulaId}
          className={styles.formula}
          autoComplete="off"
          spellCheck={false}
          translate="no"
          value={table.formula ?? ''}
          placeholder={top > 1 ? `1d${top}` : '1d6'}
          onChange={(event) => onChange({ ...table, formula: event.currentTarget.value })}
        />
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={table.replacement === false}
            onChange={(event) => onChange({ ...table, replacement: !event.currentTarget.checked })}
          />
          {t('tableTab.noReplacement')}
        </label>
      </div>
      <table className={styles.rows}>
        <thead>
          <tr>
            <th scope="col">{t('tableTab.from')}</th>
            <th scope="col">{t('tableTab.to')}</th>
            <th scope="col">{t('tableTab.result')}</th>
            <th scope="col">
              <span className={styles.hidden}>{t('tableTab.actions')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r) => (
            <tr key={r.id}>
              <td>
                <input
                  type="number"
                  autoComplete="off"
                  aria-label={t('tableTab.fromOf', { text: r.text })}
                  value={Number.isNaN(r.from) ? '' : r.from}
                  onChange={(event) => setRow(r.id, { from: event.currentTarget.valueAsNumber })}
                />
              </td>
              <td>
                <input
                  type="number"
                  autoComplete="off"
                  aria-label={t('tableTab.toOf', { text: r.text })}
                  value={Number.isNaN(r.to) ? '' : r.to}
                  onChange={(event) => setRow(r.id, { to: event.currentTarget.valueAsNumber })}
                />
              </td>
              <td className={styles.text}>
                <input
                  autoComplete="off"
                  maxLength={2000}
                  aria-label={t('tableTab.textOf', { from: r.from, to: r.to })}
                  value={r.text}
                  onChange={(event) => setRow(r.id, { text: event.currentTarget.value })}
                />
              </td>
              <td>
                <button
                  type="button"
                  className={styles.icon}
                  aria-label={t('tableTab.removeRow', { from: r.from, to: r.to })}
                  disabled={table.rows.length === 1}
                  onClick={() => onChange({ ...table, rows: table.rows.filter((x) => x.id !== r.id) })}
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        className={styles.add}
        onClick={() =>
          onChange({ ...table, rows: [...table.rows, { id: newId(), from: top + 1, to: top + 1, text: '' }] })
        }
      >
        <Plus size={15} aria-hidden="true" />
        {t('tableTab.addRow')}
      </button>
      <div aria-live="polite">
        {problems.length > 0 && (
          <ul className={styles.problems}>
            {problems.map((p) => (
              <li key={say(p)}>{say(p)}</li>
            ))}
          </ul>
        )}
      </div>
    </fieldset>
  )
}

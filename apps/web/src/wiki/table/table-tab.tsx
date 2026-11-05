/**
 * La pestaña «Tabla» de una página (docs/specs/personajes.md § tablas): sus filas con su rango y su texto, su fórmula
 * (sin ella, 1dN por la última fila) y si va sin reemplazo; tirar en una campaña del mundo, que deja la tirada en su
 * registro, y la fila que salió, marcada
 */
import type { Page, PageTabView, TableRow } from '@crisol/contracts'
import { type TableProblem, tableProblemList } from '@crisol/dice'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dices, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../../api/context.tsx'
import { useErrorText } from '../../api/errors.ts'
import { useAnnounce } from '../../components/announcer.tsx'
import { BusyButton } from '../../components/busy-button.tsx'
import { ChangesBar } from '../../components/changes.tsx'
import dialogStyles from '../../components/dialog.module.css'
import { FormError } from '../../components/field.tsx'
import form from '../../components/form.module.css'
import { failed, LoadError } from '../../components/load-error.tsx'
import { Modal } from '../../components/modal.tsx'
import { Tour } from '../../components/tour.tsx'
import { useDice } from '../../dice/context.tsx'
import styles from './table-tab.module.css'

const newId = () => crypto.randomUUID().slice(0, 8)

type Draft = { formula: string; replacement: boolean; rows: TableRow[] }
/** Lo que se está cambiando de cada tabla, por su pestaña: cambiar de pestaña de la página no lo pierde */
const drafts = new Map<string, Draft>()

export function TableTab({ page, tab }: { page: Page; tab: PageTabView }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const announce = useAnnounce()
  const dice = useDice()
  const formulaId = useId()
  const campaignId = useId()
  const campaigns = useQuery({
    queryKey: ['campaigns', page.worldId],
    queryFn: () => api.call('listCampaigns', { worldId: page.worldId })
  })
  const [chosenCampaign, setChosenCampaign] = useState<string | null>(null)
  const campaign = chosenCampaign ?? dice.campaignFor(page.worldId) ?? campaigns.data?.campaigns[0]?.id ?? null
  const key = ['randomTable', tab.id, campaign] as const
  const loaded = useQuery({
    queryKey: key,
    queryFn: () => api.call('getRandomTable', { tabId: tab.id, ...(campaign ? { campaignId: campaign } : {}) })
  })
  const [draft, setDraftState] = useState<Draft | null>(() => drafts.get(tab.id) ?? null)
  const setDraft = (next: Draft | null) => {
    if (next) drafts.set(tab.id, next)
    else drafts.delete(tab.id)
    setDraftState(next)
  }
  const [visibility, setVisibility] = useState<'all' | 'hidden'>('all')
  const [last, setLast] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)
  const save = useMutation({
    mutationFn: async () => {
      if (!loaded.data || !draft) return
      await api.call('updateRandomTable', {
        tabId: tab.id,
        version: loaded.data.table.version,
        formula: draft.formula.trim() || null,
        replacement: draft.replacement,
        rows: draft.rows
      })
      await queryClient.invalidateQueries({ queryKey: ['randomTable', tab.id] })
      setDraft(null)
    }
  })
  const roll = useMutation({
    mutationFn: () => api.call('rollOnTable', { tabId: tab.id, campaignId: campaign ?? '', visibility }),
    onSuccess: (out) => {
      const text = out.roll.table?.results[0]?.text
      const hit = loaded.data?.table.rows.find(
        (r) => r.text === text && r.from <= out.roll.total && out.roll.total <= r.to
      )
      setLast(hit?.id ?? null)
      // Lo que salió, también para quien no lo ve marcado
      announce(t('tableTab.rolled', { total: out.roll.total, text: text ?? '' }))
      queryClient.setQueryData(key, (old: typeof loaded.data) => (old ? { ...old, drawn: out.drawn } : old))
    }
  })
  const reset = useMutation({
    mutationFn: () => api.call('resetTableDraws', { tabId: tab.id, campaignId: campaign ?? '' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: key })
      setResetting(false)
    }
  })
  if (!loaded.data) return failed(loaded) ? <LoadError error={loaded.error} onRetry={() => loaded.refetch()} /> : null
  const table = loaded.data.table
  const current = draft ?? { formula: table.formula ?? '', replacement: table.replacement, rows: table.rows }
  const edit = (change: Partial<typeof current>) => setDraft({ ...current, ...change })
  const setRow = (id: string, change: Partial<TableRow>) =>
    edit({ rows: current.rows.map((r) => (r.id === id ? { ...r, ...change } : r)) })
  const problems = draft ? tableProblemList(current.formula, current.rows) : []
  // Cada problema, en su idioma; una fila a medio escribir (sin número), aparte
  const say = (p: TableProblem) =>
    (p.code === 'notIntegers' || p.code === 'backwards') && (Number.isNaN(p.from) || Number.isNaN(p.to))
      ? t('tableTab.problems.empty')
      : t(`tableTab.problems.${p.code}`, p)
  const drawn = new Set(loaded.data.drawn)
  const top = Math.max(0, ...current.rows.map((r) => r.to))
  return (
    <div className={styles.tab}>
      <div className={styles.head}>
        <label htmlFor={formulaId}>{t('tableTab.formula')}</label>
        <input
          id={formulaId}
          className={styles.formula}
          autoComplete="off"
          spellCheck={false}
          value={current.formula}
          placeholder={top > 1 ? `1d${top}` : '1d6'}
          onChange={(event) => edit({ formula: event.currentTarget.value })}
          translate="no"
        />
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={!current.replacement}
            onChange={(event) => edit({ replacement: !event.currentTarget.checked })}
          />
          {t('tableTab.noReplacement')}
        </label>
      </div>
      <table className={styles.rows} data-tour="tabla-filas">
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
          {current.rows.map((r) => (
            <tr key={r.id} data-now={r.id === last ? '' : undefined} data-drawn={drawn.has(r.id) ? '' : undefined}>
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
                  aria-label={t('tableTab.textOf', { from: r.from, to: r.to })}
                  value={r.text}
                  onChange={(event) => setRow(r.id, { text: event.currentTarget.value })}
                />
                {r.id === last && <span className={styles.now}>{t('tableTab.now')}</span>}
                {drawn.has(r.id) && r.id !== last && <span className={styles.out}>{t('tableTab.drawn')}</span>}
              </td>
              <td>
                <button
                  type="button"
                  className={styles.icon}
                  aria-label={t('tableTab.removeRow', { from: r.from, to: r.to })}
                  onClick={() => edit({ rows: current.rows.filter((x) => x.id !== r.id) })}
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
        onClick={() => edit({ rows: [...current.rows, { id: newId(), from: top + 1, to: top + 1, text: '' }] })}
      >
        <Plus size={15} aria-hidden="true" />
        {t('tableTab.addRow')}
      </button>
      {/* Se oye sin cortar lo que se escribe */}
      <div aria-live="polite">
        {problems.length > 0 && (
          <ul className={styles.problems}>
            {problems.map((p) => (
              <li key={say(p)}>{say(p)}</li>
            ))}
          </ul>
        )}
      </div>
      <FormError message={save.error ? errorText(save.error) : null} />
      <ChangesBar shown={draft !== null}>
        <BusyButton
          type="button"
          className={form.button}
          busy={save.isPending}
          disabled={problems.length > 0}
          onClick={() => save.mutate()}
        >
          {t('tableTab.save')}
        </BusyButton>
        <button type="button" className={dialogStyles.cancel} onClick={() => setDraft(null)}>
          {t('tableTab.cancel')}
        </button>
      </ChangesBar>
      <div className={styles.roll} data-tour="tabla-tirar">
        {campaigns.data?.campaigns.length === 0 ? (
          <p className={styles.noCampaign}>{t('tableTab.noCampaign')}</p>
        ) : (
          <>
            <label htmlFor={campaignId}>{t('tableTab.campaign')}</label>
            <select
              id={campaignId}
              value={campaign ?? ''}
              onChange={(event) => setChosenCampaign(event.currentTarget.value)}
            >
              {campaigns.data?.campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </>
        )}
        <fieldset className={styles.visibility}>
          <legend className={styles.hidden}>{t('tableTab.who')}</legend>
          {(['all', 'hidden'] as const).map((v) => (
            <label key={v}>
              <input
                type="radio"
                name={`${campaignId}-v`}
                checked={visibility === v}
                onChange={() => setVisibility(v)}
              />
              {t(v === 'all' ? 'dice.visibility.all' : 'dice.visibility.hidden')}
            </label>
          ))}
        </fieldset>
        <BusyButton
          type="button"
          className={form.button}
          busy={roll.isPending}
          disabled={!campaign || draft !== null || table.rows.length === 0}
          onClick={() => roll.mutate()}
        >
          <Dices size={16} aria-hidden="true" />
          {t('tableTab.roll')}
        </BusyButton>
        {!table.replacement && (
          <span className={styles.drawnCount}>
            {t('tableTab.drawnCount', { count: drawn.size })}
            <button
              type="button"
              className={styles.reset}
              onClick={() => setResetting(true)}
              disabled={drawn.size === 0}
            >
              <RotateCcw size={14} aria-hidden="true" />
              {t('tableTab.reset')}
            </button>
          </span>
        )}
      </div>
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
      <Tour
        id="tabla"
        steps={[
          { target: '[data-tour="tabla-filas"]', text: t('tour.table.rows') },
          { target: '[data-tour="tabla-tirar"]', text: t('tour.table.roll') }
        ]}
      />
    </div>
  )
}

/** Reiniciar lo sacado en la campaña: no se deshace, así que se pregunta */
function ResetDialog({
  busy,
  error,
  onConfirm,
  onClose
}: {
  busy: boolean
  error: string | null
  onConfirm: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  return (
    <Modal ref={dialog} aria-labelledby={titleId} className={dialogStyles.dialog} onClose={onClose}>
      <div className={dialogStyles.body}>
        <h2 id={titleId}>{t('tableTab.resetTitle')}</h2>
        <p className={dialogStyles.description}>{t('tableTab.resetText')}</p>
        <FormError message={error} />
        <div className={dialogStyles.actions}>
          <BusyButton type="button" className={form.button} busy={busy} onClick={onConfirm} data-autofocus="">
            {t('tableTab.reset')}
          </BusyButton>
          <button type="button" className={dialogStyles.cancel} onClick={() => dialog.current?.close()}>
            {t('tableTab.cancel')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

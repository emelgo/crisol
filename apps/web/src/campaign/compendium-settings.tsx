/**
 * «Ajustes del compendio» de una campaña, para el máster (docs/specs/compendio-jugadores.md): sus fuentes y lo que ven
 * sus jugadores, por sección y por tipo. Lo que se oculta no les sale en el compendio, ni al buscar, ni a su IA
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { ActionOutput } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import dialog from '../components/dialog.module.css'
import { FormError } from '../components/field.tsx'
import { Modal } from '../components/modal.tsx'
import styles from './compendium-settings.module.css'

type Compendium = ActionOutput<'getCampaignCompendium'>
type Section = Compendium['sections'][number]

export function CompendiumSettings({
  campaignId,
  compendium,
  onClose
}: {
  campaignId: string
  compendium: Compendium
  onClose: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const client = useQueryClient()
  const errorText = useErrorText()
  const titleId = useId()
  const playersId = useId()
  const campaign = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => api.call('getCampaign', { campaignId })
  })
  const hidden = new Set(campaign.data?.campaign.hiddenTypes ?? [])
  const save = useMutation({
    mutationFn: (hiddenTypes: string[]) => api.call('updateCampaign', { campaignId, hiddenTypes }),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: ['campaign', campaignId] }),
        client.invalidateQueries({ queryKey: ['compendium', campaignId] })
      ])
  })
  // Ocultar o enseñar unos tipos (los de una sección, de una vez)
  const set = (keys: readonly string[], hide: boolean) => {
    const next = new Set(hidden)
    for (const key of keys) {
      if (hide) next.add(key)
      else next.delete(key)
    }
    save.mutate([...next])
  }
  const sources = compendium.sources.map((s) => s.name).join(t('compendium.and'))
  return (
    <Modal aria-labelledby={titleId} className={`${dialog.dialog} ${styles.dialog}`} onClose={onClose}>
      <div className={dialog.body}>
        <h2 id={titleId}>{t('compendium.settings.title')}</h2>
        <div className={styles.block}>
          <h3 className={styles.label}>{t('compendium.settings.sources')}</h3>
          <p className={styles.sources}>
            {compendium.system?.name}
            {sources && ` · ${sources}`}
          </p>
        </div>
        <div className={styles.block}>
          <h3 id={playersId} className={styles.label}>
            {t('compendium.settings.players')}
          </h3>
          <ul className={styles.list} aria-labelledby={playersId} aria-busy={save.isPending}>
            {compendium.sections.map((section) => (
              <SectionRows
                key={section.key}
                section={section}
                hidden={hidden}
                busy={save.isPending || !campaign.data}
                onSet={set}
              />
            ))}
          </ul>
          <FormError message={save.error ? errorText(save.error) : null} />
        </div>
      </div>
    </Modal>
  )
}

/** Una sección: si es de un solo tipo, una fila; si no, la suya (todos a la vez) y, debajo, cada tipo */
function SectionRows({
  section,
  hidden,
  busy,
  onSet
}: {
  section: Section
  hidden: ReadonlySet<string>
  busy: boolean
  onSet: (keys: readonly string[], hide: boolean) => void
}) {
  const { t } = useTranslation()
  const keys = section.types.map((type) => type.key)
  const only = section.types.length === 1 ? section.types[0] : undefined
  if (only)
    return <Row label={section.label} visible={!hidden.has(only.key)} busy={busy} onToggle={(v) => onSet(keys, !v)} />
  const count = keys.filter((key) => hidden.has(key)).length
  return (
    <>
      <Row
        label={section.label}
        visible={count === 0}
        busy={busy}
        note={count > 0 && count < keys.length ? t('compendium.settings.someHidden', { count }) : undefined}
        onToggle={(v) => onSet(keys, !v)}
      />
      {section.types.map((type) => (
        <Row
          key={type.key}
          label={type.label}
          visible={!hidden.has(type.key)}
          busy={busy}
          inner
          onToggle={(v) => onSet([type.key], !v)}
        />
      ))}
    </>
  )
}

/** Una fila: su nombre y el interruptor «A la vista / Oculto» */
function Row({
  label,
  visible,
  busy,
  note,
  inner = false,
  onToggle
}: {
  label: string
  visible: boolean
  busy: boolean
  note?: string | undefined
  inner?: boolean
  onToggle: (visible: boolean) => void
}) {
  const { t } = useTranslation()
  const labelId = useId()
  return (
    <li className={styles.row} data-inner={inner ? '' : undefined} data-hidden={visible ? undefined : ''}>
      <span id={labelId} className={styles.name}>
        {label}
      </span>
      {note && <span className={styles.note}>{note}</span>}
      <button
        type="button"
        role="switch"
        aria-checked={visible}
        aria-labelledby={labelId}
        className={styles.switch}
        disabled={busy}
        onClick={() => onToggle(!visible)}
      >
        {visible ? <Eye size={16} aria-hidden="true" /> : <EyeOff size={16} aria-hidden="true" />}
        <span aria-hidden="true">{visible ? t('compendium.settings.visible') : t('compendium.settings.hidden')}</span>
      </button>
    </li>
  )
}

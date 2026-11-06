/**
 * «Poner en juego», en una criatura del compendio (docs/specs/criaturas.md): unas copias numeradas (un número o una
 * tirada: 1d4+1) o la única, con sus PG medios o tirados. Dice lo que ya está en juego de ella
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Swords } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { BusyButton } from '../components/busy-button.tsx'
import { FormError } from '../components/field.tsx'
import styles from './put-in-play.module.css'

export function PutInPlay({
  worldId,
  campaignId,
  entryKey
}: {
  worldId: string
  campaignId: string
  entryKey: string
}) {
  const { t } = useTranslation()
  const api = useApi()
  const client = useQueryClient()
  const errorText = useErrorText()
  const titleId = useId()
  const manyId = useId()
  const [unique, setUnique] = useState(false)
  const [many, setMany] = useState('1')
  const [hp, setHp] = useState<'average' | 'rolled'>('average')
  const list = useQuery({
    queryKey: ['creatures', campaignId],
    queryFn: () => api.call('listInPlay', { campaignId })
  })
  const now = (list.data?.creatures ?? []).filter((c) => c.key === entryKey)
  const count = /^\d+$/.test(many.trim()) ? Math.max(1, Math.min(50, Number(many.trim()))) : null
  const put = useMutation({
    mutationFn: () =>
      api.call('putInPlay', {
        campaignId,
        key: entryKey,
        hp,
        ...(unique ? { unique: true } : count !== null ? { count } : { formula: many.trim() })
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['creatures', campaignId] })
  })
  const label = unique
    ? t('inPlay.put.goUnique')
    : count !== null
      ? t('inPlay.put.go', { count })
      : t('inPlay.put.goRolled')
  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.title}>
        {t('inPlay.put.title')}
      </h2>
      <fieldset className={styles.toggle}>
        <legend className={styles.hidden}>{t('inPlay.put.how')}</legend>
        {[false, true].map((each) => (
          <label key={String(each)} className={styles.option}>
            <input type="radio" name={`${titleId}-como`} checked={unique === each} onChange={() => setUnique(each)} />
            <span>{each ? t('inPlay.put.unique') : t('inPlay.put.copies')}</span>
          </label>
        ))}
      </fieldset>
      {!unique && (
        <div className={styles.field}>
          <label htmlFor={manyId}>{t('inPlay.put.many')}</label>
          <input
            id={manyId}
            value={many}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setMany(event.currentTarget.value)}
          />
          <span className={styles.hint}>{t('inPlay.put.manyHint')}</span>
        </div>
      )}
      <fieldset className={styles.toggle}>
        <legend className={styles.legend}>{t('inPlay.put.hp')}</legend>
        {(['average', 'rolled'] as const).map((each) => (
          <label key={each} className={styles.option}>
            <input type="radio" name={`${titleId}-pg`} checked={hp === each} onChange={() => setHp(each)} />
            <span>{t(`inPlay.put.${each}`)}</span>
          </label>
        ))}
      </fieldset>
      <BusyButton
        className={styles.go}
        busy={put.isPending}
        disabled={!unique && !many.trim()}
        onClick={() => put.mutate()}
      >
        <Swords size={16} aria-hidden="true" />
        {label}
      </BusyButton>
      <FormError message={put.error ? errorText(put.error) : null} />
      <p className={styles.now}>
        {t('inPlay.put.now')}: {now.length > 0 ? now.map((c) => c.name).join(', ') : t('inPlay.put.none')}
      </p>
      {now.length > 0 && (
        <Link
          to="/mundos/$worldId/campanas/$campaignId/en-juego"
          params={{ worldId, campaignId }}
          search={{ ver: now[now.length - 1]?.id }}
          className={styles.see}
        >
          {t('inPlay.put.see')}
        </Link>
      )}
    </section>
  )
}

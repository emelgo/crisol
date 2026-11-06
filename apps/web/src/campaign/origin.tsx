/**
 * Las copias del compendio del mundo (docs/specs/compendio-mundo.md): el aviso cuando su original cambia, la ventana
 * con lo que cambió campo a campo para traerlo, y llevar una entrada del mundo al sistema de la cuenta
 */
import { type Language, type Text, textOf } from '@crisol/systems'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { TriangleAlert } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ActionOutput } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { Loading } from '../components/brand.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import dialogStyles from '../components/dialog.module.css'
import { FormError } from '../components/field.tsx'
import formStyles from '../components/form.module.css'
import { Modal } from '../components/modal.tsx'
import styles from './origin.module.css'

type Item = ActionOutput<'getCampaignContent'>['items'][number]
type WorldInfo = NonNullable<Item['world']>
interface Where {
  worldId: string
  systemId: string
}

/** Un valor de un campo, para leerlo: un texto en el idioma, una lista, un número, o «Su mecánica» */
function shown(value: unknown, language: Language, words: { empty: string; mechanics: string; yes: string }): string {
  if (value === null || value === undefined || value === '') return words.empty
  if (typeof value === 'boolean') return value ? words.yes : words.empty
  if (typeof value === 'number' || typeof value === 'string') return String(value)
  if (Array.isArray(value)) return value.map((v) => shown(v, language, words)).join(', ')
  const text = textOf(value as Text, language)
  return text || words.mechanics
}

/** «El original ha cambiado» (con «Ver cambios»), o que ya no está */
export function OriginNotice({
  campaignId,
  where,
  item,
  language,
  writable
}: {
  campaignId: string
  where: Where
  item: Item & { world: WorldInfo }
  language: Language
  writable: boolean
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const origin = item.world.origin
  if (!origin || (!origin.changed && !origin.missing)) return null
  return (
    <>
      <div className={styles.notice} role="status">
        <TriangleAlert size={16} aria-hidden="true" />
        <span>{origin.missing ? t('compendium.originMissing') : t('compendium.originChanged')}</span>
        {origin.changed && writable && (
          <button type="button" className={styles.see} onClick={() => setOpen(true)}>
            {t('compendium.seeChanges')}
          </button>
        )}
      </div>
      {open && (
        <OriginChanges
          campaignId={campaignId}
          where={where}
          item={item}
          language={language}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

/** Lo que cambió en el original, campo a campo, para elegir qué se trae */
function OriginChanges({
  campaignId,
  where,
  item,
  language,
  onClose
}: {
  campaignId: string
  where: Where
  item: Item & { world: WorldInfo }
  language: Language
  onClose: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const client = useQueryClient()
  const errorText = useErrorText()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const changes = useQuery({
    queryKey: ['compendium', campaignId, 'origin', item.key],
    queryFn: () => api.call('getContentOrigin', { ...where, key: item.key, language })
  })
  // De entrada, todo elegido
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set())
  const fields = (changes.data?.changes ?? []).map((c) => c.key).filter((k) => !skipped.has(k))
  const pull = useMutation({
    mutationFn: () => api.call('pullContentOrigin', { ...where, key: item.key, version: item.world.version, fields }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['compendium', campaignId] })
      dialog.current?.close()
    }
  })
  const words = { empty: t('compendium.empty'), mechanics: t('compendium.mechanicsValue'), yes: t('compendium.yes') }
  const toggle = (key: string) =>
    setSkipped((was) => {
      const next = new Set(was)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  return (
    <Modal
      ref={dialog}
      aria-labelledby={titleId}
      className={`${dialogStyles.dialog} ${styles.dialog}`}
      onClose={onClose}
    >
      <div className={dialogStyles.body}>
        <h2 id={titleId}>{t('compendium.changesTitle')}</h2>
        {!changes.data ? (
          <Loading />
        ) : changes.data.changes.length === 0 ? (
          <p className={dialogStyles.description}>{t('compendium.noChanges')}</p>
        ) : (
          <>
            <p className={dialogStyles.description}>
              {t('compendium.changesText', { name: changes.data.origin?.name ?? '' })}
            </p>
            <table className={styles.changes}>
              <thead>
                <tr>
                  <td />
                  <th scope="col">{t('compendium.field')}</th>
                  <th scope="col">{t('compendium.inCopy')}</th>
                  <th scope="col">{t('compendium.inOriginal')}</th>
                </tr>
              </thead>
              <tbody>
                {changes.data.changes.map((change) => (
                  <tr key={change.key}>
                    <td>
                      <input
                        type="checkbox"
                        checked={!skipped.has(change.key)}
                        aria-label={t('compendium.pickField', { field: change.label })}
                        onChange={() => toggle(change.key)}
                      />
                    </td>
                    <th scope="row">{change.label}</th>
                    <td className={styles.copy}>{shown(change.copy, language, words)}</td>
                    <td>{shown(change.after, language, words)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={styles.note}>{t('compendium.keepRest')}</p>
          </>
        )}
        <FormError message={pull.error ? errorText(pull.error) : null} />
        <div className={dialogStyles.actions}>
          {changes.data && changes.data.changes.length > 0 && (
            <BusyButton
              className={formStyles.button}
              busy={pull.isPending}
              disabled={fields.length === 0}
              data-autofocus=""
              onClick={() => pull.mutate()}
            >
              {t('compendium.pull', { count: fields.length })}
            </BusyButton>
          )}
          <button type="button" className={dialogStyles.cancel} onClick={() => dialog.current?.close()}>
            {t('compendium.notNow')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/** Llevar una entrada del mundo al sistema de la cuenta (para usarla en otros mundos), quitándola o no del mundo */
export function ToSystem({
  campaignId,
  where,
  version,
  item,
  name,
  onMoved,
  onClose
}: {
  campaignId: string
  where: Where
  /** La versión del sistema */
  version: number
  item: Item
  name: string
  onMoved: (removed: boolean) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const client = useQueryClient()
  const errorText = useErrorText()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [remove, setRemove] = useState(false)
  const move = useMutation({
    mutationFn: () => api.call('copyContent', { ...where, key: item.key, to: 'system', remove, version }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['compendium', campaignId] })
      onMoved(remove)
      dialog.current?.close()
    }
  })
  return (
    <Modal ref={dialog} aria-labelledby={titleId} className={dialogStyles.dialog} onClose={onClose}>
      <div className={dialogStyles.body}>
        <h2 id={titleId}>{t('compendium.toSystemTitle', { name })}</h2>
        <p className={dialogStyles.description}>{t('compendium.toSystemText')}</p>
        <label className={styles.check}>
          <input type="checkbox" checked={remove} onChange={(event) => setRemove(event.currentTarget.checked)} />
          {t('compendium.removeFromWorld')}
        </label>
        <FormError message={move.error ? errorText(move.error) : null} />
        <div className={dialogStyles.actions}>
          <BusyButton
            className={formStyles.button}
            busy={move.isPending}
            data-autofocus=""
            onClick={() => move.mutate()}
          >
            {t('compendium.toSystemDo')}
          </BusyButton>
          <button type="button" className={dialogStyles.cancel} onClick={() => dialog.current?.close()}>
            {t('compendium.cancel')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

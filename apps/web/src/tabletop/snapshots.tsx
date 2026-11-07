/**
 * Las instantáneas de la escena abierta (docs/specs/herramientas-mesa.md): guardar lo de la campaña en ella con su
 * miniatura (una captura pequeña del lienzo), la lista con sus miniaturas y volver a una, con aviso (se deshace desde
 * el historial)
 */
import type { SnapshotView } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { FormError } from '../components/field.tsx'
import styles from './tools.module.css'
import visionStyles from './vision.module.css'
import { Confirm } from './vision-panel.tsx'

/** Lo más que pesa una miniatura (lo que admite la API) y su lado mayor */
export const THUMBNAIL_BYTES = 200_000
export const THUMBNAIL_SIDE = 480

const when = (iso: string) => {
  const date = new Date(iso)
  const today = new Date()
  const time = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  return date.toDateString() === today.toDateString()
    ? { today: true, time }
    : { today: false, time: `${date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}, ${time}` }
}

export function SnapshotsPanel({
  campaignId,
  sceneId,
  capture
}: {
  campaignId: string
  sceneId: string
  /** La miniatura de lo que se ve ahora (null si no se puede) */
  capture: () => Promise<string | null>
}) {
  const { t } = useTranslation()
  const api = useApi()
  const client = useQueryClient()
  const errorText = useErrorText()
  const key = ['snapshots', campaignId, sceneId]
  const list = useQuery({ queryKey: key, queryFn: () => api.call('listSnapshots', { campaignId, sceneId }) })
  const [name, setName] = useState('')
  const [restoring, setRestoring] = useState<SnapshotView | null>(null)
  const [deleting, setDeleting] = useState<SnapshotView | null>(null)
  const refresh = () => client.invalidateQueries({ queryKey: key })
  const save = useMutation({
    mutationFn: async (title: string) => {
      const thumbnail = await capture().catch(() => null)
      return api.call('saveSnapshot', { campaignId, sceneId, name: title, ...(thumbnail ? { thumbnail } : {}) })
    },
    onSuccess: () => {
      setName('')
      void refresh()
    }
  })
  const restore = useMutation({
    mutationFn: (snapshotId: string) => api.call('restoreSnapshot', { campaignId, snapshotId })
  })
  const remove = useMutation({
    mutationFn: (snapshotId: string) => api.call('deleteSnapshot', { snapshotId }),
    onSuccess: () => void refresh()
  })
  const fallback = () => {
    const { time } = when(new Date().toISOString())
    return t('tools.snapshotAt', { time })
  }
  const error = [save, restore, remove, list].find((m) => m.error)?.error ?? null
  return (
    <>
      <form
        className={styles.saveSnapshot}
        onSubmit={(event) => {
          event.preventDefault()
          save.mutate(name.trim() || fallback())
        }}
      >
        <label className={visionStyles.field}>
          <span>{t('tools.snapshotName')}</span>
          <input
            className={visionStyles.input}
            value={name}
            maxLength={80}
            placeholder={fallback()}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <button type="submit" className={styles.primary} disabled={save.isPending}>
          <Camera aria-hidden="true" size={15} />
          {t('tools.saveSnapshot')}
        </button>
      </form>
      {restore.data && restore.data.skipped.length > 0 && (
        <p className={visionStyles.stat} role="status">
          {t('tools.skipped', { list: restore.data.skipped.join(', ') })}
        </p>
      )}
      {list.data && list.data.snapshots.length === 0 && (
        <span className={visionStyles.stat}>{t('tools.noSnapshots')}</span>
      )}
      <ul className={styles.snapshots} aria-label={t('tools.snapshots')}>
        {(list.data?.snapshots ?? []).map((snapshot) => {
          const date = when(snapshot.createdAt)
          return (
            <li key={snapshot.id} className={styles.snapshot}>
              <div className={styles.thumb}>
                {snapshot.thumbnail ? <img src={snapshot.thumbnail} alt="" /> : <Camera aria-hidden="true" size={22} />}
              </div>
              <b>{snapshot.name}</b>
              <span>
                {[
                  date.today ? t('tools.today', { time: date.time }) : date.time,
                  t('tools.tokens', { count: snapshot.tokens })
                ].join(' · ')}
              </span>
              <div className={visionStyles.row}>
                <button type="button" className={visionStyles.ghost} onClick={() => setRestoring(snapshot)}>
                  {t('tools.restore')}
                </button>
                <button
                  type="button"
                  className={styles.icon}
                  aria-label={t('tools.deleteSnapshot', { name: snapshot.name })}
                  title={t('tools.remove')}
                  onClick={() => setDeleting(snapshot)}
                >
                  <Trash2 aria-hidden="true" size={15} />
                </button>
              </div>
            </li>
          )
        })}
      </ul>
      <FormError message={error ? errorText(error) : null} />
      {restoring && (
        <Confirm
          title={t('tools.restoreTitle')}
          text={t('tools.restoreText', { name: restoring.name })}
          confirm={t('tools.restoreConfirm')}
          onConfirm={() => restore.mutate(restoring.id)}
          onClose={() => setRestoring(null)}
        />
      )}
      {deleting && (
        <Confirm
          title={t('tools.deleteSnapshotTitle')}
          text={t('tools.deleteSnapshotText', { name: deleting.name })}
          confirm={t('tools.remove')}
          onConfirm={() => remove.mutate(deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  )
}

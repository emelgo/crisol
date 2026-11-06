/**
 * Tras traer un sistema de Foundry, sus imágenes (docs/specs/imagenes.md): cuántas van con cada licencia, la casilla de
 * no traer las que solo se pueden usar en Foundry (para tu uso privado, ADR-0014) y la subida en tandas, con su avance
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { BusyButton } from '../components/busy-button.tsx'
import { FormError } from '../components/field.tsx'
import form from '../components/form.module.css'
import styles from './foundry-images.module.css'
import { toBase64, type ZipImage } from './foundry-zip.ts'

/** Lo que va en cada petición: unos 4 MB (en base64, un tercio más) */
const BATCH = 4 * 1024 * 1024
const LICENSES = ['cc-by', 'mit', 'foundry-only', 'cc-by-nc-sa', 'unknown'] as const

export function FoundryImages({
  systemId,
  images,
  onDone
}: {
  systemId: string
  images: readonly ZipImage[]
  onDone: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const [restricted, setRestricted] = useState(true)
  const [sent, setSent] = useState(0)
  const counts = new Map<string, number>()
  for (const image of images) counts.set(image.license, (counts.get(image.license) ?? 0) + 1)
  // Por defecto se traen todas; las «solo para Foundry» y las de licencia que no admite el producto, si se quiere
  const chosen = images.filter((i) => restricted || (i.license !== 'foundry-only' && i.license !== 'cc-by-nc-sa'))
  const upload = useMutation({
    mutationFn: async () => {
      let batch: ZipImage[] = []
      let size = 0
      const flush = async () => {
        if (batch.length === 0) return
        await api.call('putSystemImages', {
          systemId,
          images: batch.map((i) => ({ path: i.path, data: toBase64(i.bytes), license: i.license, credit: i.credit }))
        })
        setSent((n) => n + batch.length)
        batch = []
        size = 0
      }
      for (const image of chosen) {
        // Una imagen que sola pasa del límite, fuera
        if (image.bytes.length > BATCH) continue
        if (size + image.bytes.length > BATCH || batch.length >= 100) await flush()
        batch.push(image)
        size += image.bytes.length
      }
      await flush()
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['compendium'] })
      onDone()
    }
  })
  return (
    <div className={styles.images}>
      <p className={styles.head}>{t('systems.images.found', { count: images.length })}</p>
      <ul className={styles.licenses}>
        {LICENSES.filter((l) => counts.has(l)).map((license) => (
          <li key={license} data-restricted={license === 'foundry-only' || license === 'cc-by-nc-sa' ? '' : undefined}>
            <strong>{counts.get(license)}</strong> {t(`systems.images.license.${license}`)}
          </li>
        ))}
      </ul>
      {(counts.has('foundry-only') || counts.has('cc-by-nc-sa')) && (
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={restricted}
            onChange={(event) => setRestricted(event.currentTarget.checked)}
          />
          {t('systems.images.restricted')}
        </label>
      )}
      {upload.isPending && (
        <p className={styles.progress} role="status">
          {t('systems.images.sending', { sent, total: chosen.length })}
        </p>
      )}
      <FormError message={upload.error ? errorText(upload.error) : null} />
      <div className={styles.actions}>
        <BusyButton
          type="button"
          className={form.button}
          busy={upload.isPending}
          disabled={chosen.length === 0}
          onClick={() => upload.mutate()}
        >
          {t('systems.images.send', { count: chosen.length })}
        </BusyButton>
        <button type="button" className={styles.skip} onClick={onDone} disabled={upload.isPending}>
          {t('systems.images.skip')}
        </button>
      </div>
    </div>
  )
}

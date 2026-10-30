/**
 * La portada de un mundo vista grande, y su cuadro para cambiarla: las imágenes del mundo en miniatura, subir otra,
 * quitarla y encuadrarla arrastrando sobre la vista previa (o con las flechas)
 */
import type { PageCover as Cover } from '@crisol/contracts'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Move, Upload } from 'lucide-react'
import { type KeyboardEvent, type PointerEvent, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { BusyButton } from '../components/busy-button.tsx'
import dialogStyles from '../components/dialog.module.css'
import { FormError } from '../components/field.tsx'
import form from '../components/form.module.css'
import { Modal } from '../components/modal.tsx'
import { useWorldFiles } from '../wiki/cover.tsx'
import styles from './world-cover.module.css'

/** La portada entera, encima de todo */
export function CoverViewer({ url, label, onClose }: { url: string; label: string; onClose: () => void }) {
  return (
    <Modal className={styles.viewer} aria-label={label} onClose={onClose}>
      <img src={url} alt="" className={styles.full} />
    </Modal>
  )
}

const clamp = (value: number) => Math.round(Math.min(100, Math.max(0, value)))

/** Cambiar la portada: elegirla, subirla o quitarla, y encuadrarla. Se guarda con «Guardar» */
export function CoverDialog({
  worldId,
  title,
  cover,
  background,
  onSave,
  onClose
}: {
  worldId: string
  title: string
  cover: Cover | null
  /** El color que se ve sin imagen */
  background: string
  onSave: (cover: Cover | null) => Promise<unknown>
  onClose: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const dialog = useRef<HTMLDialogElement>(null)
  const upload = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const files = useWorldFiles(worldId)
  const images = files.data?.files.filter((file) => file.kind === 'image') ?? []
  const [chosen, setChosen] = useState<Cover | null>(cover)
  const image = chosen ? images.find((file) => file.id === chosen.fileId) : undefined
  const save = useMutation({ mutationFn: () => onSave(chosen), onSuccess: () => dialog.current?.close() })
  const uploadImage = useMutation({
    mutationFn: async (file: File) => {
      const stored = await api.uploadFile({ worldId, name: file.name }, file)
      if (stored.kind !== 'image') throw new ApiError('BAD_COVER', 400)
      await queryClient.invalidateQueries({ queryKey: ['files', worldId] })
      setChosen({ fileId: stored.id, x: 50, y: 50 })
    }
  })

  // Encuadrar: arrastrar la imagen (hacia la derecha enseña lo de la izquierda) o las flechas, de 5 en 5
  const drag = useRef<{ x: number; y: number; from: Cover } | null>(null)
  const startDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (!chosen) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { x: event.clientX, y: event.clientY, from: chosen }
  }
  const moveDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const start = drag.current
    if (!start) return
    const box = event.currentTarget.getBoundingClientRect()
    setChosen({
      ...start.from,
      x: clamp(start.from.x - ((event.clientX - start.x) / box.width) * 100),
      y: clamp(start.from.y - ((event.clientY - start.y) / box.height) * 100)
    })
  }
  const nudge = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, -5], ArrowDown: [0, 5] }[event.key]
    if (!chosen || !step) return
    event.preventDefault()
    setChosen({ ...chosen, x: clamp(chosen.x + (step[0] ?? 0)), y: clamp(chosen.y + (step[1] ?? 0)) })
  }

  return (
    <Modal ref={dialog} className={styles.dialog} aria-labelledby={titleId} onClose={onClose}>
      <div className={dialogStyles.body}>
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className={styles.preview}
          style={{ background }}
          disabled={!image}
          aria-label={t('cover.framing')}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={() => {
            drag.current = null
          }}
          onPointerCancel={() => {
            drag.current = null
          }}
          onKeyDown={nudge}
        >
          {image && chosen && (
            <>
              <img
                src={image.url}
                alt=""
                draggable={false}
                className={styles.image}
                style={{ objectPosition: `${chosen.x}% ${chosen.y}%` }}
              />
              <span className={styles.hint} aria-hidden="true">
                <Move size={14} />
                {t('cover.drag')}
              </span>
            </>
          )}
        </button>
        {/* biome-ignore lint/a11y/useSemanticElements: una fila de botones que se marcan (aria-pressed), no un formulario */}
        <div className={styles.thumbs} role="group" aria-label={t('cover.image')}>
          {images.map((file) => (
            <button
              key={file.id}
              type="button"
              className={styles.thumb}
              aria-pressed={chosen?.fileId === file.id}
              aria-label={file.name}
              title={file.name}
              onClick={() => setChosen({ fileId: file.id, x: 50, y: 50 })}
            >
              <img src={file.url} alt="" />
            </button>
          ))}
          <BusyButton
            className={styles.upload}
            busy={uploadImage.isPending}
            aria-label={t('cover.upload')}
            title={t('cover.upload')}
            onClick={() => upload.current?.click()}
          >
            <Upload aria-hidden="true" size={18} />
          </BusyButton>
          <input
            ref={upload}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              const file = event.currentTarget.files?.[0]
              event.currentTarget.value = ''
              if (file) uploadImage.mutate(file)
            }}
          />
        </div>
        <FormError message={save.error || uploadImage.error ? errorText(save.error ?? uploadImage.error) : null} />
        <div className={styles.footer}>
          {chosen && (
            <button type="button" className={styles.remove} onClick={() => setChosen(null)}>
              {t('cover.remove')}
            </button>
          )}
          <div className={dialogStyles.actions}>
            <button type="button" className={dialogStyles.cancel} onClick={() => dialog.current?.close()}>
              {t('list.cancel')}
            </button>
            <BusyButton className={form.button} busy={save.isPending} onClick={() => save.mutate()}>
              {t('list.save')}
            </BusyButton>
          </div>
        </div>
      </div>
    </Modal>
  )
}

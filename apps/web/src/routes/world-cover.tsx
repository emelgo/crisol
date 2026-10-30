/**
 * La portada de un mundo vista grande, y su cuadro para cambiarla: las imágenes del mundo en miniatura, subir otra,
 * quitarla y encuadrarla arrastrando sobre la vista previa (o con las flechas)
 */
import type { PageCover as Cover } from '@crisol/contracts'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Move, Upload, ZoomIn, ZoomOut } from 'lucide-react'
import { type KeyboardEvent, type PointerEvent, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { BusyButton } from '../components/busy-button.tsx'
import dialogStyles from '../components/dialog.module.css'
import { FormError } from '../components/field.tsx'
import form from '../components/form.module.css'
import { Modal } from '../components/modal.tsx'
import { coverStyle, useWorldFiles } from '../wiki/cover.tsx'
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
const ZOOM = { min: 1, max: 3, step: 0.1 }
const clampZoom = (value: number) => Math.round(Math.min(ZOOM.max, Math.max(ZOOM.min, value)) * 100) / 100

/** Si dos portadas son la misma (imagen, encuadre y acercamiento) */
const sameCover = (a: Cover | null, b: Cover | null) =>
  a === b ||
  (a !== null && b !== null && a.fileId === b.fileId && a.x === b.x && a.y === b.y && (a.zoom ?? 1) === (b.zoom ?? 1))

/**
 * Cambiar la portada: elegirla, subirla o quitarla, encuadrarla y acercarla. Con cambios salen «Cancelar» (los deshace)
 * y «Guardar»
 */
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
  const changed = !sameCover(chosen, cover)
  const zoom = chosen?.zoom ?? 1
  const setZoom = (value: number) => {
    if (chosen) setChosen({ ...chosen, zoom: clampZoom(value) })
  }
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
    // Acercada, la imagen se mueve más despacio: el mismo gesto, menos trozo
    const box = event.currentTarget.getBoundingClientRect()
    const scale = start.from.zoom ?? 1
    setChosen({
      ...start.from,
      x: clamp(start.from.x - ((event.clientX - start.x) / (box.width * scale)) * 100),
      y: clamp(start.from.y - ((event.clientY - start.y) / (box.height * scale)) * 100)
    })
  }
  const nudge = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!chosen) return
    // + y - acercan y alejan
    if (event.key === '+' || event.key === '-') {
      event.preventDefault()
      setZoom(zoom + (event.key === '+' ? ZOOM.step : -ZOOM.step))
      return
    }
    const step = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, -5], ArrowDown: [0, 5] }[event.key]
    if (!step) return
    event.preventDefault()
    setChosen({ ...chosen, x: clamp(chosen.x + (step[0] ?? 0)), y: clamp(chosen.y + (step[1] ?? 0)) })
  }
  // La rueda del ratón sobre la vista previa acerca y aleja (sin mover la página: por eso no es pasiva)
  const preview = useRef<HTMLButtonElement>(null)
  const zoomRef = useRef(setZoom)
  zoomRef.current = setZoom
  const zoomNow = useRef(zoom)
  zoomNow.current = zoom
  useEffect(() => {
    const element = preview.current
    if (!element) return
    const wheel = (event: WheelEvent) => {
      if (element.disabled) return
      event.preventDefault()
      zoomRef.current(zoomNow.current + (event.deltaY < 0 ? ZOOM.step : -ZOOM.step))
    }
    element.addEventListener('wheel', wheel, { passive: false })
    return () => element.removeEventListener('wheel', wheel)
  }, [])

  return (
    <Modal ref={dialog} className={styles.dialog} aria-labelledby={titleId} onClose={onClose}>
      <div className={dialogStyles.body}>
        <h2 id={titleId}>{title}</h2>
        <button
          ref={preview}
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
              <img src={image.url} alt="" draggable={false} className={styles.image} style={coverStyle(chosen)} />
              <span className={styles.hint} aria-hidden="true">
                <Move size={14} />
                {t('cover.drag')}
              </span>
            </>
          )}
        </button>
        {image && (
          <div className={styles.zoom}>
            <button type="button" aria-label={t('cover.zoomOut')} onClick={() => setZoom(zoom - ZOOM.step)}>
              <ZoomOut aria-hidden="true" size={18} />
            </button>
            <input
              type="range"
              aria-label={t('cover.zoom')}
              min={ZOOM.min}
              max={ZOOM.max}
              step={0.05}
              value={zoom}
              onChange={(event) => setZoom(Number(event.currentTarget.value))}
            />
            <button type="button" aria-label={t('cover.zoomIn')} onClick={() => setZoom(zoom + ZOOM.step)}>
              <ZoomIn aria-hidden="true" size={18} />
            </button>
          </div>
        )}
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
          {changed && (
            <div className={dialogStyles.actions}>
              <button type="button" className={dialogStyles.cancel} onClick={() => setChosen(cover)}>
                {t('list.cancel')}
              </button>
              <BusyButton className={form.button} busy={save.isPending} onClick={() => save.mutate()}>
                {t('list.save')}
              </BusyButton>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

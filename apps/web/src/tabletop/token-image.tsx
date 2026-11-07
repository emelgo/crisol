/**
 * El creador de fichas (docs/specs/fichas.md): una imagen del mundo para la ficha, encuadrada en redondo. Se arrastra
 * para moverla y se acerca con el deslizador o la rueda; se guarda el centro (de 0 a 1) y cuánto se acerca, y la mesa
 * y la tele la recortan igual
 */
import type { TokenView } from '@crisol/contracts'
import { useMutation } from '@tanstack/react-query'
import { type PointerEvent, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import dialogStyles from '../components/dialog.module.css'
import { FormError } from '../components/field.tsx'
import { Modal } from '../components/modal.tsx'
import { useWorldFiles } from '../wiki/cover-look.ts'
import styles from './fichas.module.css'

/** Lo que mide el círculo de la vista previa, en px */
const PREVIEW = 176
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

export function TokenImageEditor({
  token,
  worldId,
  fileId,
  onClose
}: {
  token: TokenView
  worldId: string
  /** La imagen con la que empieza (la elegida en el panel), si no es la suya */
  fileId?: string | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const titleId = useId()
  const zoomId = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const files = useWorldFiles(worldId)
  const images = files.data?.files.filter((file) => file.kind === 'image') ?? []
  const [chosen, setChosen] = useState<string | null>(fileId ?? token.image?.fileId ?? null)
  const [crop, setCrop] = useState(
    fileId && fileId !== token.image?.fileId
      ? { x: 0.5, y: 0.5, zoom: 1 }
      : { x: token.image?.x ?? 0.5, y: token.image?.y ?? 0.5, zoom: token.image?.zoom ?? 1 }
  )
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null)
  const drag = useRef<{ x: number; y: number; from: { x: number; y: number } } | null>(null)
  const k = natural ? (PREVIEW / Math.min(natural.width, natural.height)) * crop.zoom : 1
  const save = useMutation({
    mutationFn: (image: TokenView['image']) => api.call('updateToken', { tokenId: token.id, image }),
    onSuccess: () => dialog.current?.close()
  })
  const onDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { x: event.clientX, y: event.clientY, from: { x: crop.x, y: crop.y } }
  }
  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current
    if (!start || !natural) return
    const x = clamp(start.from.x - (event.clientX - start.x) / (natural.width * k), -1, 2)
    const y = clamp(start.from.y - (event.clientY - start.y) / (natural.height * k), -1, 2)
    setCrop((current) => ({ ...current, x, y }))
  }
  return (
    <Modal
      ref={dialog}
      aria-labelledby={titleId}
      className={`${dialogStyles.dialog} ${styles.imageDialog}`}
      onClose={onClose}
    >
      <div className={styles.imageBody}>
        <h2 id={titleId}>{t('tokens.imageOf', { name: token.label })}</h2>
        <div className={styles.imageRow}>
          <div
            className={styles.round}
            style={{ inlineSize: PREVIEW, blockSize: PREVIEW }}
            data-faction={token.faction}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={() => {
              drag.current = null
            }}
            onWheel={(event) => {
              const factor = Math.exp(-event.deltaY * 0.0015)
              setCrop((c) => ({ ...c, zoom: clamp(c.zoom * factor, 0.2, 10) }))
            }}
          >
            {chosen && (
              <img
                src={`/api/files/${chosen}`}
                alt=""
                draggable={false}
                onLoad={(event) =>
                  setNatural({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })
                }
                style={
                  natural
                    ? {
                        inlineSize: natural.width * k,
                        blockSize: natural.height * k,
                        insetInlineStart: PREVIEW / 2 - crop.x * natural.width * k,
                        insetBlockStart: PREVIEW / 2 - crop.y * natural.height * k
                      }
                    : { opacity: 0 }
                }
              />
            )}
          </div>
          <div className={styles.field}>
            <label htmlFor={zoomId}>{t('tokens.zoom')}</label>
            <input
              id={zoomId}
              type="range"
              min={1}
              max={4}
              step={0.05}
              value={crop.zoom}
              onChange={(event) => {
                const zoom = Number(event.currentTarget.value)
                setCrop((c) => ({ ...c, zoom }))
              }}
            />
          </div>
        </div>
        <ul className={styles.imageList} aria-label={t('tokens.worldImages')}>
          {images.map((file) => (
            <li key={file.id}>
              <button
                type="button"
                aria-pressed={chosen === file.id}
                onClick={() => {
                  setChosen(file.id)
                  setNatural(null)
                  setCrop({ x: 0.5, y: 0.5, zoom: 1 })
                }}
              >
                <img src={file.url} alt="" loading="lazy" />
                <span>{file.name}</span>
              </button>
            </li>
          ))}
        </ul>
        <FormError message={save.error ? errorText(save.error) : null} />
        <div className={styles.imageActs}>
          <button
            type="button"
            className={styles.primary}
            disabled={!chosen || save.isPending}
            onClick={() => chosen && save.mutate({ fileId: chosen, ...crop })}
          >
            {t('tokens.saveImage')}
          </button>
          {token.image && (
            <button type="button" className={styles.ghost} disabled={save.isPending} onClick={() => save.mutate(null)}>
              {t('tokens.removeImage')}
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}

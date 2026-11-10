/**
 * Una imagen enseñada, en grande (docs/specs/ensenar.md): ocupa la pantalla, se acerca con la rueda o con dos dedos y se
 * cierra con la X, con Escape o pulsando fuera de ella
 */
import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './image-viewer.module.css'

export type ShownImage = { fileId: string; title: string }

export function ImageViewer({ image, onClose }: { image: ShownImage; onClose: () => void }) {
  const { t } = useTranslation()
  const [zoom, setZoom] = useState(1)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: pulsar fuera es un atajo del ratón; con el teclado, Escape
    // biome-ignore lint/a11y/noStaticElementInteractions: el fondo, para cerrar al pulsar fuera de la imagen
    <div
      className={styles.viewer}
      role="dialog"
      aria-modal="true"
      aria-label={image.title}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      onWheel={(event) => setZoom((z) => Math.min(6, Math.max(1, z * (event.deltaY < 0 ? 1.15 : 0.87))))}
    >
      <img
        src={`/api/files/${image.fileId}`}
        alt={image.title}
        style={{ transform: `scale(${zoom})` }}
        onDoubleClick={() => setZoom((z) => (z > 1 ? 1 : 2.5))}
      />
      <p className={styles.title}>{image.title}</p>
      <button type="button" className={styles.close} aria-label={t('show.close')} onClick={onClose}>
        <X aria-hidden="true" size={22} />
      </button>
    </div>
  )
}

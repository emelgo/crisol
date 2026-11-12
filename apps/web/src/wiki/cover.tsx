/**
 * La portada de la página: una imagen del mundo de cabecera, recortada a lo ancho alrededor de su punto de encuadre.
 * «Portada» abre el cuadro de la portada, el mismo que el de un mundo
 */
import type { PageCover as Cover, Page } from '@crisol/contracts'
import { useQueryClient } from '@tanstack/react-query'
import { Maximize2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import list from '../components/list.module.css'
import { CoverDialog, CoverViewer } from '../routes/world-cover.tsx'
import styles from './cover.module.css'
import { coverStyle, useWorldFiles } from './cover-look.ts'
import { useReadAs } from './read-as.tsx'

/** La forma de la cabecera de una página, más o menos (su ancho cambia con la pantalla; su alto, no) */
const PAGE_COVER = '4 / 1'

/**
 * La imagen de cabecera, si la tiene (si su archivo ya no está, nada). Como la portada de un mundo: al pasar por
 * encima, «Ver» (en grande) y «Cambiar»; y, como en el Crisol antiguo, se arrastra arriba o abajo para encuadrarla
 */
export function PageCoverImage({ page }: { page: Page }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  // Quien lee desde una campaña no ve los archivos del mundo: su portada, por su id (el servidor mira que la vea)
  const readAs = useReadAs()
  const files = useWorldFiles(page.worldId, !readAs)
  const [viewing, setViewing] = useState(false)
  // Mientras se arrastra: dónde empezó y el encuadre que lleva
  const drag = useRef<{ y: number; start: number; height: number } | null>(null)
  const [dragY, setDragY] = useState<number | null>(null)
  const file = !page.cover
    ? undefined
    : readAs
      ? { url: `/api/files/${page.cover.fileId}` }
      : files.data?.files.find((f) => f.id === page.cover?.fileId)
  if (!page.cover || !file) return null
  const cover = page.cover
  // Se encuadra y se cambia en el mundo, no leyendo desde una campaña
  const fixed = page.locked || Boolean(readAs)
  const save = async (next: Cover | null) => {
    await api.call('updatePage', { pageId: page.id, cover: next })
    await queryClient.invalidateQueries({ queryKey: ['pages', page.worldId] })
  }
  const shown = dragY === null ? cover : { ...cover, y: dragY }
  return (
    <div className={styles.cover} data-cover-image="" data-dragging={dragY !== null || undefined}>
      <img
        src={file.url}
        alt=""
        className={styles.image}
        style={coverStyle(shown)}
        draggable={false}
        onPointerDown={(event) => {
          if (fixed) return
          event.currentTarget.setPointerCapture(event.pointerId)
          drag.current = { y: event.clientY, start: cover.y, height: event.currentTarget.clientHeight }
          setDragY(cover.y)
        }}
        onPointerMove={(event) => {
          const at = drag.current
          if (!at) return
          // Bajar el ratón enseña lo de arriba
          const moved = ((event.clientY - at.y) / at.height) * 100
          setDragY(Math.round(Math.min(100, Math.max(0, at.start - moved))))
        }}
        onPointerUp={() => {
          const y = dragY
          drag.current = null
          setDragY(null)
          if (y !== null && y !== cover.y) void save({ ...cover, y })
        }}
      />
      <div className={styles.coverActions}>
        {!fixed && <span className={styles.dragHint}>{t('cover.drag')}</span>}
        <button type="button" className={styles.coverButton} aria-haspopup="dialog" onClick={() => setViewing(true)}>
          <Maximize2 aria-hidden="true" size={14} />
          {t('cover.view')}
        </button>
        {!fixed && (
          <CoverPicker
            worldId={page.worldId}
            cover={cover}
            title={t('cover.of', { name: page.title })}
            label={t('cover.change')}
            triggerClassName={styles.coverButton}
            onSave={save}
          />
        )}
      </div>
      {viewing && <CoverViewer url={file.url} label={page.title} onClose={() => setViewing(false)} />}
    </div>
  )
}

/** El botón «Portada» de una página y su caja */
export function CoverButton({
  page,
  className,
  label
}: {
  page: Page
  className?: string | undefined
  label?: string
}) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  return (
    <CoverPicker
      worldId={page.worldId}
      cover={page.cover}
      title={t('cover.of', { name: page.title })}
      triggerClassName={className}
      {...(label ? { label } : {})}
      onSave={async (cover) => {
        await api.call('updatePage', { pageId: page.id, cover })
        await queryClient.invalidateQueries({ queryKey: ['pages', page.worldId] })
      }}
    />
  )
}

/**
 * «Portada» y su cuadro, el mismo que el de un mundo (routes/world-cover.tsx): subirla o elegirla de tus archivos,
 * encuadrarla, acercarla y quitarla. La vista previa, con la forma de la cabecera de una página
 */
export function CoverPicker({
  worldId,
  cover,
  title,
  onSave,
  triggerClassName,
  label
}: {
  worldId: string
  cover: Cover | null
  /** El título del cuadro */
  title: string
  onSave: (cover: Cover | null) => Promise<unknown>
  /** El texto del botón (sin él, «Portada») */
  label?: string
  /** El aspecto del botón (en la cabecera de una página, discreto) */
  triggerClassName?: string | undefined
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className={triggerClassName ?? list.secondary}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {label ?? t('cover.button')}
      </button>
      {open && (
        <CoverDialog
          worldId={worldId}
          title={title}
          cover={cover}
          aspect={PAGE_COVER}
          onSave={(next) => onSave(next)}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

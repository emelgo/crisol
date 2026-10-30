/**
 * La portada de la página: una imagen del mundo de cabecera, recortada a lo ancho alrededor de su punto de encuadre.
 * «Portada» abre una caja (patrón de despliegue, como el icono) para elegirla de las del mundo o subir una, moverle el
 * encuadre y quitarla
 */
import type { PageCover as Cover, Page } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { BusyButton } from '../components/busy-button.tsx'
import { FormError } from '../components/field.tsx'
import list from '../components/list.module.css'
import styles from './cover.module.css'

const useWorldFiles = (worldId: string) => {
  const api = useApi()
  return useQuery({ queryKey: ['files', worldId], queryFn: () => api.call('listFiles', { worldId }) })
}

/** La imagen de cabecera, si la tiene (si su archivo ya no está, nada) */
export function PageCoverImage({ page }: { page: Page }) {
  const files = useWorldFiles(page.worldId)
  const file = page.cover ? files.data?.files.find((f) => f.id === page.cover?.fileId) : undefined
  if (!page.cover || !file) return null
  return (
    <div className={styles.cover}>
      <img
        src={file.url}
        alt=""
        className={styles.image}
        style={{ objectPosition: `${page.cover.x}% ${page.cover.y}%` }}
      />
    </div>
  )
}

/** El botón «Portada» y su caja */
export function CoverButton({ page }: { page: Page }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const files = useWorldFiles(page.worldId)
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const selectId = useId()
  const upload = useRef<HTMLInputElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const images = files.data?.files.filter((file) => file.kind === 'image') ?? []
  const save = useMutation({
    mutationFn: (cover: Cover | null) => api.call('updatePage', { pageId: page.id, cover }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pages', page.worldId] })
  })
  const uploadCover = useMutation({
    mutationFn: async (file: File) => {
      const stored = await api.uploadFile({ worldId: page.worldId, name: file.name }, file)
      if (stored.kind !== 'image') throw new ApiError('BAD_COVER', 400)
      await queryClient.invalidateQueries({ queryKey: ['files', page.worldId] })
      return api.call('updatePage', { pageId: page.id, cover: { fileId: stored.id, x: 50, y: 50 } })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pages', page.worldId] })
  })
  const cover = page.cover
  return (
    <div className={styles.wrapper}>
      <button
        ref={trigger}
        type="button"
        className={list.secondary}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        {t('cover.button')}
      </button>
      {/* biome-ignore lint/a11y/useSemanticElements: la caja que despliega «Portada» (ARIA), no un grupo de un formulario */}
      <div
        id={panelId}
        role="group"
        aria-label={t('cover.button')}
        className={styles.panel}
        hidden={!open}
        onKeyDown={(event) => {
          // Escape la cierra y el foco vuelve al botón
          if (event.key !== 'Escape') return
          setOpen(false)
          trigger.current?.focus()
        }}
      >
        <label htmlFor={selectId}>{t('cover.image')}</label>
        <select
          id={selectId}
          value={cover?.fileId ?? ''}
          onChange={(event) => {
            const fileId = event.currentTarget.value
            save.mutate(fileId ? { fileId, x: cover?.x ?? 50, y: cover?.y ?? 50 } : null)
          }}
        >
          <option value="">{t('cover.none')}</option>
          {images.map((file) => (
            <option key={file.id} value={file.id}>
              {file.name}
            </option>
          ))}
        </select>
        <BusyButton className={list.secondary} busy={uploadCover.isPending} onClick={() => upload.current?.click()}>
          {t('cover.upload')}
        </BusyButton>
        <input
          ref={upload}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            const chosen = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            if (chosen) uploadCover.mutate(chosen)
          }}
        />
        {cover && (
          <>
            <Framing cover={cover} onChange={(next) => save.mutate(next)} />
            <button type="button" className={list.secondary} onClick={() => save.mutate(null)}>
              {t('cover.remove')}
            </button>
          </>
        )}
        <FormError message={save.error || uploadCover.error ? errorText(save.error ?? uploadCover.error) : null} />
      </div>
    </div>
  )
}

/** El punto de encuadre: dos deslizadores; se guarda al soltar (no un cambio por paso) */
function Framing({ cover, onChange }: { cover: Cover; onChange: (cover: Cover) => void }) {
  const { t } = useTranslation()
  const xId = useId()
  const yId = useId()
  const [point, setPoint] = useState({ x: cover.x, y: cover.y })
  const commit = () => {
    if (point.x !== cover.x || point.y !== cover.y) onChange({ ...cover, ...point })
  }
  const slider = (axis: 'x' | 'y', id: string) => (
    <input
      id={id}
      type="range"
      min={0}
      max={100}
      step={5}
      value={point[axis]}
      onChange={(event) => setPoint({ ...point, [axis]: Number(event.currentTarget.value) })}
      onPointerUp={commit}
      onKeyUp={commit}
      onBlur={commit}
    />
  )
  return (
    <fieldset className={styles.framing}>
      <legend>{t('cover.framing')}</legend>
      <label htmlFor={xId}>{t('cover.horizontal')}</label>
      {slider('x', xId)}
      <label htmlFor={yId}>{t('cover.vertical')}</label>
      {slider('y', yId)}
    </fieldset>
  )
}

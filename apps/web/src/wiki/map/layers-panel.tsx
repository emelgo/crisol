/**
 * Las capas de un mapa (módulo 9, lienzo «Mapas con capas»): de arriba abajo, como en un programa de dibujo. El ojo
 * apaga una capa solo en esta pantalla (se recuerda en el aparato); el máster, además, las crea, las renombra, las
 * ordena (arrastrando o con Alt y las flechas), las deja «Solo del máster» y las quita con lo suyo
 */
import type { MapLayerView, MapView, Page } from '@crisol/contracts'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  GripVertical,
  Layers,
  Lock,
  LockOpen,
  Plus,
  Trash2,
  X
} from 'lucide-react'
import { type DragEvent, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../../api/context.tsx'
import { useErrorText } from '../../api/errors.ts'
import { useAnnounce } from '../../components/announcer.tsx'
import { FormError } from '../../components/field.tsx'
import { focusOnMount } from '../../components/focus.ts'
import { mapKey } from './keys.ts'
import styles from './map.module.css'

const hereKey = (mapId: string) => `crisol.mapa.capas-apagadas.${mapId}`

/** Las capas apagadas en esta pantalla, recordadas en el aparato (sin almacenamiento, solo esta visita) */
export function useHiddenHere(mapId: string) {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => {
    try {
      const stored = localStorage.getItem(hereKey(mapId))
      return new Set(stored ? (JSON.parse(stored) as string[]) : [])
    } catch {
      return new Set()
    }
  })
  const toggle = useCallback(
    (layerId: string) =>
      setHidden((current) => {
        const next = new Set(current)
        if (next.has(layerId)) next.delete(layerId)
        else next.add(layerId)
        try {
          localStorage.setItem(hereKey(mapId), JSON.stringify([...next]))
        } catch {
          // Sin almacenamiento: vale para esta visita
        }
        return next
      }),
    [mapId]
  )
  return { hidden, toggle }
}

/** Crear, cambiar y quitar capas, con el mapa de la caché al día */
function useLayers(page: Page, map: MapView) {
  const api = useApi()
  const queryClient = useQueryClient()
  const key = mapKey(page.worldId, map.tabId)
  const refresh = () => queryClient.invalidateQueries({ queryKey: key })
  const create = useMutation({
    mutationFn: (name: string) => api.call('createMapLayer', { mapId: map.id, name }),
    onSuccess: refresh
  })
  const update = useMutation({
    mutationFn: ({ layerId, ...patch }: { layerId: string; name?: string; hidden?: boolean; after?: string | null }) =>
      api.call('updateMapLayer', { layerId, ...patch }),
    onMutate: ({ layerId, name, hidden }) =>
      queryClient.setQueryData<MapView>(key, (current) =>
        current
          ? {
              ...current,
              layers: current.layers.map((layer) =>
                layer.id === layerId
                  ? { ...layer, ...(name !== undefined ? { name } : {}), ...(hidden !== undefined ? { hidden } : {}) }
                  : layer
              )
            }
          : current
      ),
    onSettled: refresh
  })
  const remove = useMutation({
    mutationFn: (layerId: string) => api.call('deleteMapLayer', { layerId }),
    onSuccess: refresh
  })
  return { create, update, remove }
}

export function LayersPanel({
  page,
  map,
  editable,
  hiddenHere,
  onToggleHere,
  onClose
}: {
  page: Page
  map: MapView
  editable: boolean
  hiddenHere: ReadonlySet<string>
  onToggleHere: (layerId: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const announce = useAnnounce()
  const errorText = useErrorText()
  const layers = useLayers(page, map)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  // De arriba abajo: la de más arriba, primero
  const ordered = [...map.layers].reverse()
  const count = (layerId: string) => map.elements.filter((e) => (e.layerId ?? map.layers[0]?.id) === layerId).length

  /** Mover una capa a un puesto de la lista (de arriba abajo) */
  const moveTo = (layer: MapLayerView, index: number) => {
    const others = ordered.filter((other) => other.id !== layer.id)
    const target = Math.max(0, Math.min(others.length, index))
    // En el orden de pintar (de abajo arriba), va tras la que queda debajo de ella en la lista
    const below = others[target]
    layers.update.mutate(
      { layerId: layer.id, after: below ? below.id : null },
      { onSuccess: () => announce(t('map.layers.moved', { name: layer.name, at: target + 1, of: ordered.length })) }
    )
  }

  const onDrop = (event: DragEvent, index: number) => {
    event.preventDefault()
    const layer = ordered.find((l) => l.id === dragging)
    setDragging(null)
    if (layer && ordered.indexOf(layer) !== index) moveTo(layer, index)
  }

  return (
    <section className={styles.panel} aria-label={t('map.layers.title')}>
      <header className={styles.panelHead}>
        <h2 className={styles.layersTitle}>
          <Layers aria-hidden="true" size={15} />
          {t('map.layers.title')}
        </h2>
        <button type="button" className={styles.close} aria-label={t('map.layers.close')} onClick={onClose}>
          <X aria-hidden="true" size={16} />
        </button>
      </header>
      {ordered.length === 0 && <p className={styles.layersEmpty}>{t('map.layers.none')}</p>}
      <ul className={styles.layers}>
        {ordered.map((layer, index) => {
          const off = hiddenHere.has(layer.id)
          return (
            <li
              key={layer.id}
              className={styles.layer}
              data-off={off || undefined}
              data-dragging={dragging === layer.id || undefined}
              draggable={editable && renaming !== layer.id}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'move'
                setDragging(layer.id)
              }}
              onDragEnd={() => setDragging(null)}
              onDragOver={(event) => {
                if (dragging) event.preventDefault()
              }}
              onDrop={(event) => onDrop(event, index)}
            >
              {editable && <GripVertical aria-hidden="true" size={14} className={styles.layerGrip} />}
              <div className={styles.layerName}>
                {renaming === layer.id ? (
                  <input
                    ref={focusOnMount}
                    className={styles.layerInput}
                    defaultValue={layer.name}
                    aria-label={t('map.layers.name')}
                    maxLength={60}
                    onBlur={(event) => {
                      const name = event.currentTarget.value.trim()
                      setRenaming(null)
                      if (name && name !== layer.name) layers.update.mutate({ layerId: layer.id, name })
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur()
                      if (event.key === 'Escape') {
                        event.currentTarget.value = layer.name
                        event.currentTarget.blur()
                      }
                    }}
                  />
                ) : editable ? (
                  <button
                    type="button"
                    className={styles.layerLabel}
                    aria-label={t('map.layers.rename', { name: layer.name })}
                    onClick={() => setRenaming(layer.id)}
                    onKeyDown={(event) => {
                      // Alt y las flechas: subirla o bajarla
                      if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
                        event.preventDefault()
                        moveTo(layer, index + (event.key === 'ArrowUp' ? -1 : 1))
                      }
                    }}
                  >
                    {layer.name}
                  </button>
                ) : (
                  <span className={styles.layerLabel}>{layer.name}</span>
                )}
                <small>{t('map.layers.count', { count: count(layer.id) })}</small>
              </div>
              {layer.hidden && (
                <span className={styles.masterOnly}>
                  <Lock aria-hidden="true" size={11} />
                  {t('map.layers.masterOnly')}
                </span>
              )}
              <span className={styles.layerTools}>
                {editable && (
                  <>
                    <button
                      type="button"
                      className={styles.layerTool}
                      aria-label={t('map.layers.up', { name: layer.name })}
                      disabled={index === 0}
                      onClick={() => moveTo(layer, index - 1)}
                    >
                      <ChevronUp aria-hidden="true" size={14} />
                    </button>
                    <button
                      type="button"
                      className={styles.layerTool}
                      aria-label={t('map.layers.down', { name: layer.name })}
                      disabled={index === ordered.length - 1}
                      onClick={() => moveTo(layer, index + 1)}
                    >
                      <ChevronDown aria-hidden="true" size={14} />
                    </button>
                    <button
                      type="button"
                      className={styles.layerTool}
                      aria-pressed={layer.hidden}
                      aria-label={t('map.layers.secret', { name: layer.name })}
                      title={t(layer.hidden ? 'map.layers.secretOn' : 'map.layers.secretOff')}
                      onClick={() => layers.update.mutate({ layerId: layer.id, hidden: !layer.hidden })}
                    >
                      {layer.hidden ? <Lock aria-hidden="true" size={14} /> : <LockOpen aria-hidden="true" size={14} />}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  aria-pressed={!off}
                  aria-label={t('map.layers.here', { name: layer.name })}
                  title={t('map.layers.hereHint')}
                  onClick={() => onToggleHere(layer.id)}
                >
                  {off ? <EyeOff aria-hidden="true" size={15} /> : <Eye aria-hidden="true" size={15} />}
                </button>
                {editable && (
                  <button
                    type="button"
                    className={styles.layerTool}
                    aria-label={t('map.layers.remove', { name: layer.name })}
                    onClick={() => setDeleting(deleting === layer.id ? null : layer.id)}
                    aria-expanded={deleting === layer.id}
                  >
                    <Trash2 aria-hidden="true" size={14} />
                  </button>
                )}
              </span>
              {deleting === layer.id && (
                <div className={styles.layerConfirm}>
                  <span>{t('map.layers.removeAsk', { count: count(layer.id) })}</span>
                  <button
                    type="button"
                    ref={focusOnMount}
                    className={`${styles.layerTool} ${styles.danger}`}
                    onClick={() =>
                      layers.remove.mutate(layer.id, {
                        onSuccess: () => {
                          setDeleting(null)
                          announce(t('map.layers.removed', { name: layer.name }))
                        }
                      })
                    }
                  >
                    {t('map.layers.removeConfirm')}
                  </button>
                  <button type="button" className={styles.layerTool} onClick={() => setDeleting(null)}>
                    {t('map.layers.cancel')}
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {editable && (
        <button
          type="button"
          className={styles.layerAdd}
          disabled={layers.create.isPending}
          onClick={() =>
            layers.create.mutate(t('map.layers.newName', { n: map.layers.length + 1 }), {
              onSuccess: (layer) => setRenaming(layer.id)
            })
          }
        >
          <Plus aria-hidden="true" size={15} />
          {t('map.layers.add')}
        </button>
      )}
      {map.pins.length > 0 && <p className={styles.layersPins}>{t('map.layers.pins', { count: map.pins.length })}</p>}
      <FormError
        message={
          layers.create.error || layers.update.error || layers.remove.error
            ? errorText(layers.create.error ?? layers.update.error ?? layers.remove.error)
            : null
        }
      />
    </section>
  )
}

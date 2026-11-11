/**
 * Recolocar las filas del panel de una plantilla (sus campos y sus bloques), como los bloques del panel de una página:
 * con sus seis puntos, arrastrándolos, o con el foco en ellos, con Alt y las flechas. Pulsarlos abre sus opciones
 */
import { GripVertical } from 'lucide-react'
import { type DragEvent, type KeyboardEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './editor.module.css'

export function useReorder(move: (from: number, to: number) => void) {
  const [dragging, setDragging] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)
  const end = () => {
    setDragging(null)
    setOver(null)
  }
  /** Lo de cada fila: dónde caería lo arrastrado (encima de ella) */
  const row = (index: number) => ({
    'data-over': (dragging !== null && over === index && dragging !== index) || undefined,
    'data-dragging': dragging === index || undefined,
    onDragOver: (event: DragEvent<HTMLElement>) => {
      if (dragging === null) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      setOver(index)
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      if (dragging === null) return
      event.preventDefault()
      if (dragging !== index) move(dragging, index)
      end()
    }
  })
  return { row, start: setDragging, end }
}

/** Los seis puntos de una fila: se arrastran, Alt y las flechas la suben o la bajan, y pulsarlos abre sus opciones */
export function Grip({
  name,
  index,
  count,
  open,
  onToggle,
  onMove,
  onDragStart,
  onDragEnd
}: {
  name: string
  index: number
  count: number
  open: boolean
  onToggle: () => void
  onMove: (from: number, to: number) => void
  onDragStart: (index: number) => void
  onDragEnd: () => void
}) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      className={styles.grip}
      draggable
      aria-label={t('templateEditor.gripOf', { name })}
      title={t('templateEditor.gripHint')}
      aria-expanded={open}
      aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
      onClick={onToggle}
      onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
        if (!event.altKey) return
        if (event.key === 'ArrowUp' && index > 0) {
          event.preventDefault()
          onMove(index, index - 1)
        } else if (event.key === 'ArrowDown' && index < count - 1) {
          event.preventDefault()
          onMove(index, index + 1)
        }
      }}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', name)
        onDragStart(index)
      }}
      onDragEnd={onDragEnd}
    >
      <GripVertical size={14} aria-hidden="true" />
    </button>
  )
}

/** Mover una fila de una lista de un sitio a otro */
export function moved<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list]
  const [item] = next.splice(from, 1)
  if (item !== undefined) next.splice(to, 0, item)
  return next
}

/**
 * La página de un pin o de algo dibujado: el nombre que se escribe y, debajo, un desplegable que flota (no mueve el
 * panel, que se desplaza) con las páginas del mundo que lo contienen, como «Página…» de la pizarra (Enrique,
 * 2026-11-16: «que no desentone»). Las flechas eligen, Intro pone la elegida y, si ninguna se llama así, el nombre
 * escrito (será una subpágina nueva de la del mapa); Escape cierra el desplegable
 */
import { autoUpdate, computePosition, flip, offset, shift, size } from '@floating-ui/dom'
import { FilePlus2 } from 'lucide-react'
import { type KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import styles from './map.module.css'

/** Cuántas páginas sugiere a la vez */
const SUGGESTED = 8

type Row = { id: string; title: string; path?: readonly string[] }

export function PagePicker({
  id,
  value,
  pages,
  placeholder,
  onCommit
}: {
  id: string
  /** La página de ahora (su título; vacío, sin página) */
  value: string
  pages: readonly Row[]
  placeholder?: string
  /** El nombre elegido o escrito (vacío: sin página) */
  onCommit: (title: string) => void
}) {
  const { t } = useTranslation()
  const [text, setText] = useState(value)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  // Si cambia por otro lado (la IA, deshacer), se ve lo nuevo
  useEffect(() => setText(value), [value])
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)

  const wanted = text.trim().toLocaleLowerCase('es')
  const exact = pages.find((row) => row.title.toLocaleLowerCase('es') === wanted)
  // La que se llama así, las que empiezan así, las que tienen una palabra que empieza así y las demás que lo contienen
  const rank = (title: string) => {
    const lower = title.toLocaleLowerCase('es')
    if (lower === wanted) return 0
    if (lower.startsWith(wanted)) return 1
    if (lower.split(/[\s\-–—(«"']+/).some((word) => word.startsWith(wanted))) return 2
    return lower.includes(wanted) ? 3 : 4
  }
  const matches = wanted
    ? pages
        .map((row, index) => ({ row, index, rank: rank(row.title) }))
        .filter((item) => item.rank < 4)
        .sort((a, b) => a.rank - b.rank || a.index - b.index)
        .map((item) => item.row)
        .slice(0, SUGGESTED)
    : pages.slice(0, SUGGESTED)
  // Lo escrito, si no se llama así ninguna: una página nueva
  const options: { key: string; title: string; row: Row | null }[] = [
    ...matches.map((row) => ({ key: row.id, title: row.title, row })),
    ...(wanted && !exact ? [{ key: 'nueva', title: text.trim(), row: null }] : [])
  ]
  const chosen = options[Math.min(active, options.length - 1)]

  // El desplegable, bajo el campo y a su ancho, fuera del panel (que se desplaza y lo cortaría)
  useLayoutEffect(() => {
    const anchor = input.current
    const floating = list.current
    if (!open || !anchor || !floating) return
    return autoUpdate(anchor, floating, () => {
      void computePosition(anchor, floating, {
        strategy: 'fixed',
        placement: 'bottom-start',
        middleware: [
          offset(4),
          flip({ padding: 8 }),
          shift({ padding: 8 }),
          size({
            padding: 8,
            apply: ({ rects, availableHeight }) => {
              floating.style.inlineSize = `${rects.reference.width}px`
              floating.style.maxBlockSize = `${Math.max(120, availableHeight)}px`
            }
          })
        ]
      }).then(({ x, y }) => Object.assign(floating.style, { left: `${x}px`, top: `${y}px` }))
    })
  }, [open])

  const commit = (title: string) => {
    setText(title)
    setOpen(false)
    setActive(0)
    if (title.trim() !== value) onCommit(title.trim())
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) return setOpen(true)
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((current) => (current + step + options.length) % Math.max(options.length, 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      commit(open && chosen ? chosen.title : text)
    } else if (event.key === 'Escape' && open) {
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
    }
  }

  return (
    <>
      <input
        ref={input}
        id={id}
        value={text}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && options.length > 0}
        aria-controls={`${id}-pages`}
        aria-activedescendant={open && chosen ? `${id}-${chosen.key}` : undefined}
        onChange={(event) => {
          setText(event.currentTarget.value)
          setActive(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => commit(text)}
        onKeyDown={onKeyDown}
      />
      {open &&
        options.length > 0 &&
        createPortal(
          <div
            ref={list}
            id={`${id}-pages`}
            role="listbox"
            aria-label={t('map.pin.pages')}
            className={styles.pagePicker}
          >
            {options.map((option) => (
              <div
                key={option.key}
                id={`${id}-${option.key}`}
                role="option"
                aria-selected={option === chosen}
                tabIndex={-1}
                data-new={option.row ? undefined : ''}
                // Antes de que el campo pierda el foco (si no, se guardaría lo escrito a medias)
                onMouseDown={(event) => {
                  event.preventDefault()
                  commit(option.title)
                }}
              >
                {option.row ? (
                  <>
                    <span>{option.title}</span>
                    {option.row.path && option.row.path.length > 1 && (
                      <span className={styles.pagePath}>{option.row.path.slice(0, -1).join(' / ')}</span>
                    )}
                  </>
                ) : (
                  <>
                    <FilePlus2 aria-hidden="true" size={14} />
                    <span>{t('map.pin.newPage', { title: option.title })}</span>
                  </>
                )}
              </div>
            ))}
          </div>,
          document.body
        )}
    </>
  )
}

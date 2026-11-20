/**
 * El enlace de una página a una entrada del compendio (`[[@Goblin jefe]]`, docs/specs/criaturas.md § wiki): su nombre,
 * y al pasar el ratón o al elegirlo (en el móvil, al tocarlo) su tarjeta, con unas cifras suyas y «Abrir», que la abre
 * en el compendio de una campaña del mundo con su sistema. Si no está en el compendio, se ve como por resolver
 */
import { useNavigate } from '@tanstack/react-router'
import type { Node } from '@tiptap/core'
import { type NodeViewProps, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import { BookOpen } from 'lucide-react'
import { type FocusEvent, type KeyboardEvent, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './content-link.module.css'
import { entryHref, useLinkedEntry } from './content-scope.tsx'

export function withContentLinkView(node: Node) {
  return node.extend({
    addNodeView() {
      return ReactNodeViewRenderer(ContentLinkView, { as: 'span' })
    }
  })
}

function ContentLinkView({ node, selected }: NodeViewProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const cardId = useId()
  const name = String(node.attrs.name ?? '')
  const label = (node.attrs.label as string | null) || null
  const [hovering, setHovering] = useState(false)
  const [pinned, setPinned] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Desde donde se lee: el mundo, la campaña (lo que ve ella) o el sistema de un capítulo
  const { scope, entry, missing } = useLinkedEntry(name)
  const href = entry ? entryHref(scope, entry) : null
  const [focused, setFocused] = useState(false)
  const [closed, setClosed] = useState(false)
  const show = Boolean(entry) && !closed && (hovering || pinned || selected || focused)
  const hover = (inside: boolean) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setHovering(inside), inside ? 300 : 200)
  }
  const open = () => {
    if (href) void navigate({ href })
  }
  return (
    <NodeViewWrapper
      as="span"
      className={styles.wrapper}
      onMouseEnter={() => {
        setClosed(false)
        hover(true)
      }}
      onMouseLeave={() => hover(false)}
      onFocus={() => {
        setClosed(false)
        setFocused(true)
      }}
      onBlur={(event: FocusEvent<HTMLElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget as globalThis.Node | null)) setFocused(false)
      }}
      onKeyDown={(event: KeyboardEvent) => {
        // Escape la cierra (WCAG 1.4.13), sin salir de lo que se escribe
        if (event.key === 'Escape' && show) {
          event.stopPropagation()
          setClosed(true)
          setPinned(false)
        }
      }}
    >
      {href ? (
        <a
          href={href}
          className={styles.link}
          data-content-link=""
          aria-describedby={show ? cardId : undefined}
          onClick={(event) => {
            event.preventDefault()
            // En lo táctil, el primer toque enseña la tarjeta
            if (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches && !pinned) setPinned(true)
            else open()
          }}
        >
          <BookOpen size={13} aria-hidden="true" />
          {/* Sin texto propio, su nombre de verdad (el enlace puede ir por su clave o con su tipo delante) */}
          {label ?? entry?.name ?? name}
        </a>
      ) : (
        <span
          className={styles.link}
          data-content-link=""
          data-state={missing ? 'missing' : 'loading'}
          title={missing ? t('contentLink.missing', { name: label ?? name }) : undefined}
        >
          <BookOpen size={13} aria-hidden="true" />
          {label ?? name}
        </span>
      )}
      {show && entry && (
        <span id={cardId} className={styles.card} data-content-card="" contentEditable={false}>
          <span className={styles.kind}>
            {entry.world ? t('contentLink.world', { type: entry.typeLabel }) : entry.typeLabel}
          </span>
          <strong className={styles.name}>{entry.name}</strong>
          {entry.lines.length > 0 && (
            <span className={styles.lines}>
              {entry.lines.map((line) => (
                <span key={line.label} className={styles.line}>
                  <span className={styles.label}>{line.label}</span> {line.value}
                </span>
              ))}
            </span>
          )}
          {href && (
            <button
              type="button"
              className={styles.open}
              onMouseDown={(event) => event.preventDefault()}
              onClick={open}
            >
              {t('contentLink.open')}
            </button>
          )}
        </span>
      )}
    </NodeViewWrapper>
  )
}

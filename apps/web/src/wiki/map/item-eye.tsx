/**
 * El ojo de un pin o de algo dibujado (Enrique, 2026-11-16: «"Revelar…" no se entiende … como el ojo del árbol»): dice
 * si lo conoce la campaña y, al pulsarlo, se lo da a conocer o se lo quita al momento. Con varias campañas, abre la
 * lista de ellas con su marca, como «Revelar a…» del árbol. Marcar es preparar (no avisa a nadie), como en el árbol
 */

import type { Page } from '@crisol/contracts'
import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Eye, EyeOff } from 'lucide-react'
import { type KeyboardEvent, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useApi } from '../../api/context.tsx'
import { useCurrentCampaign } from '../../campaign/current-campaign.ts'
import { itemKnowledgeKey, type MarkTarget, useMark } from '../who-knows.tsx'
import styles from './map.module.css'

type Row = { campaignId: string; name: string; knows: boolean; seesPage: boolean }

export function ItemEye({
  page,
  target,
  feminine,
  hidden
}: {
  page: Pick<Page, 'id' | 'worldId'>
  target: Exclude<MarkTarget, { kind: 'tab' }>
  /** «La conoce» (una región, una ruta) o «Lo conoce» (un pin, un texto) */
  feminine: boolean
  /** Si está oculto a los jugadores: al cambiarlo, lo que ve cada campaña se vuelve a pedir */
  hidden: boolean
}) {
  const { t } = useTranslation()
  const api = useApi()
  // Desde la Mesa de una campaña, solo ella
  const current = useCurrentCampaign()
  const known = useQuery({
    queryKey: [...itemKnowledgeKey(page.worldId, target.targetId), hidden],
    queryFn: () => api.call('getItemKnowledge', { worldId: page.worldId, ...target }),
    select: current ? (data) => ({ campaigns: data.campaigns.filter((row) => row.campaignId === current) }) : undefined
  })
  const mark = useMark(page, target)
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const context = feminine ? 'f' : 'm'

  // La lista, bajo el botón y fuera del panel (que se desplaza)
  useLayoutEffect(() => {
    const anchor = button.current
    const floating = menu.current
    if (!open || !anchor || !floating) return
    floating.querySelector<HTMLElement>('[role="menuitemcheckbox"]')?.focus()
    return autoUpdate(anchor, floating, () => {
      void computePosition(anchor, floating, {
        strategy: 'fixed',
        placement: 'bottom-start',
        middleware: [offset(4), flip({ padding: 8 }), shift({ padding: 8 })]
      }).then(({ x, y }) => Object.assign(floating.style, { left: `${x}px`, top: `${y}px` }))
    })
  }, [open])
  useEffect(() => {
    if (!open) return
    const outside = (event: Event) => {
      const at = event.target as Node
      if (!menu.current?.contains(at) && !button.current?.contains(at)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])

  const campaigns = known.data?.campaigns ?? []
  if (campaigns.length === 0) return null
  const toggle = (row: Row) => mark.mutate({ campaignId: row.campaignId, known: !row.knows })
  const state = (row: Row) => t(row.knows ? 'map.eye.knows' : 'map.eye.unknown', { context })

  // Una sola campaña: el ojo con su estado; pulsarlo lo cambia al momento
  const [only] = campaigns
  if (campaigns.length === 1 && only) {
    return (
      <button
        type="button"
        className={styles.eye}
        data-known={only.knows || undefined}
        aria-label={t('map.eye.label', { name: only.name, state: state(only) })}
        title={t('map.eye.toggle', { name: only.name })}
        disabled={mark.isPending}
        onClick={() => toggle(only)}
      >
        {only.knows ? <Eye aria-hidden="true" size={16} /> : <EyeOff aria-hidden="true" size={16} />}
        <span>{state(only)}</span>
        {only.knows && !only.seesPage && <span className={styles.eyeNote}>{t('map.eye.pageUnknown')}</span>}
      </button>
    )
  }

  // Varias: cuántas lo conocen y, al pulsar, la lista con la marca de cada una
  const knowing = campaigns.filter((row) => row.knows).length
  const summary =
    knowing === 0
      ? t('map.eye.none', { context })
      : knowing === campaigns.length
        ? t('map.eye.all', { context })
        : t('map.eye.some', { context, count: knowing, total: campaigns.length })
  const close = () => {
    setOpen(false)
    button.current?.focus()
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault()
      event.stopPropagation()
      return close()
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"]')]
    const at = items.indexOf(document.activeElement as HTMLElement)
    items[(at + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
  }
  return (
    <>
      <button
        ref={button}
        type="button"
        className={styles.eye}
        data-known={knowing > 0 || undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {knowing > 0 ? <Eye aria-hidden="true" size={16} /> : <EyeOff aria-hidden="true" size={16} />}
        <span>{summary}</span>
        <ChevronDown aria-hidden="true" size={14} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            id={menuId}
            role="menu"
            aria-label={t('map.eye.campaigns')}
            className={styles.eyeMenu}
            onKeyDown={onKeyDown}
          >
            {campaigns.map((row) => (
              <button
                key={row.campaignId}
                type="button"
                role="menuitemcheckbox"
                className={styles.eyeItem}
                aria-checked={row.knows}
                tabIndex={-1}
                disabled={mark.isPending}
                onClick={() => toggle(row)}
              >
                {row.knows ? (
                  <Eye aria-hidden="true" size={15} className={styles.eyeIcon} />
                ) : (
                  <EyeOff aria-hidden="true" size={15} className={styles.eyeIcon} />
                )}
                <span className={styles.eyeName}>{row.name}</span>
                <span className={styles.eyeState}>
                  {state(row)}
                  {row.knows && !row.seesPage && ` · ${t('map.eye.pageUnknown')}`}
                </span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  )
}

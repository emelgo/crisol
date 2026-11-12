/**
 * Buscar y elegir un icono de rol (el paquete de game-icons.net, @crisol/contracts game-icons.ts): un buscador (por su
 * nombre en español o en inglés, sin tildes) y los iconos por grupos. Abajo, su crédito (CC BY 3.0 lo pide)
 */
import { GAME_ICON_GROUPS, GAME_ICONS, gameIcon } from '@crisol/contracts'
import { Search } from 'lucide-react'
import { type KeyboardEvent, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from './icon.tsx'
import styles from './icon-browser.module.css'

const plain = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('es')
    .replace(/[-\s]+/g, ' ')
    .trim()

export function IconBrowser({
  value,
  onPick,
  autoFocus = false
}: {
  value: string | null
  onPick: (icon: string) => void
  autoFocus?: boolean
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const headingId = useId()
  const wanted = plain(query)
  const shown = wanted
    ? GAME_ICONS.filter((icon) => plain(icon.label).includes(wanted) || plain(icon.id).includes(wanted))
    : GAME_ICONS
  const chosen = gameIcon(value)?.id
  // Una sola parada del tabulador (la elegida o la primera); las flechas recorren la rejilla, Inicio y Fin
  const order = GAME_ICON_GROUPS.flatMap((group) => shown.filter((icon) => icon.group === group))
  const [focusAt, setFocusAt] = useState<string | null>(null)
  const stop = order.some((icon) => icon.id === focusAt)
    ? focusAt
    : order.some((icon) => icon.id === chosen)
      ? chosen
      : (order[0]?.id ?? null)
  const list = useRef<HTMLDivElement>(null)
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const at = order.findIndex((icon) => icon.id === stop)
    if (at < 0) return
    const grid = list.current?.querySelector('ul')
    const columns = grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 8
    const moves: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: columns,
      ArrowUp: -columns,
      Home: -at,
      End: order.length - 1 - at
    }
    const step = moves[event.key]
    if (step === undefined) return
    event.preventDefault()
    const next = order[Math.max(0, Math.min(order.length - 1, at + step))]
    if (!next) return
    setFocusAt(next.id)
    list.current?.querySelector<HTMLElement>(`[data-icono="${next.id}"]`)?.focus()
  }
  return (
    <div className={styles.browser}>
      <label className={styles.search}>
        <Search aria-hidden="true" size={15} />
        <input
          type="search"
          value={query}
          placeholder={t('icon.search')}
          aria-label={t('icon.search')}
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          data-form-type="other"
          // biome-ignore lint/a11y/noAutofocus: se abre para buscar, dentro de su caja
          autoFocus={autoFocus}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      </label>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: las flechas recorren los botones de dentro */}
      <div ref={list} className={styles.list} onKeyDown={onKeyDown}>
        {shown.length === 0 && <p className={styles.none}>{t('icon.noneFound')}</p>}
        {GAME_ICON_GROUPS.map((group) => {
          const here = shown.filter((icon) => icon.group === group)
          if (here.length === 0) return null
          return (
            <section key={group} className={styles.group} aria-labelledby={`${headingId}-${group}`}>
              <h3 id={`${headingId}-${group}`}>{t(`icon.groups.${group}`)}</h3>
              <ul className={styles.grid}>
                {here.map((icon) => (
                  <li key={icon.id}>
                    <button
                      type="button"
                      className={styles.choice}
                      title={icon.label}
                      aria-label={icon.label}
                      aria-pressed={chosen === icon.id}
                      tabIndex={icon.id === stop ? 0 : -1}
                      data-icono={icon.id}
                      onFocus={() => setFocusAt(icon.id)}
                      onClick={() => onPick(`gi:${icon.id}`)}
                    >
                      <Icon value={`gi:${icon.id}`} size={22} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
      <p className={styles.credit}>
        {t('icon.creditBefore')}{' '}
        <a href="https://game-icons.net" target="_blank" rel="noreferrer">
          game-icons.net
        </a>
        {t('icon.creditAfter')}
      </p>
    </div>
  )
}

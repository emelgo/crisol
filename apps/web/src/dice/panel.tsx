/**
 * Los dados de un mundo (docs/diseno.md, lienzo «Tirar dados»): un botón flotante con forma de d20, abajo a la
 * derecha, que abre los dados junto a él (no es una pantalla ni va en la barra). Encima, el resultado de cada tirada;
 * el historial, en una ficha junto al d20 (en la Mesa, en una de sus ventanas)
 */
import type { Campaign } from '@crisol/contracts'
import { useQuery } from '@tanstack/react-query'
import { useRouterState } from '@tanstack/react-router'
import { X } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useId, useReducer, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { Tour } from '../components/tour.tsx'
import { useDice, useWorldInPath } from './context.tsx'
import styles from './dice.module.css'
import { CloseFloating, focusLauncher, useCloseFloating, useSheet } from './floating.ts'
import { RollLog } from './log.tsx'
import { RollNotices } from './notices.tsx'
import { EMPTY, poolReducer } from './pool.ts'
import { DiceRack } from './rack.tsx'

/** Lo que se puede enfocar dentro de la hoja, para que el foco no salga de ella */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea, [tabindex="0"]'

/** Las campañas del mundo en las que puede tirar la cuenta, y la elegida */
export function useDiceCampaign(worldId: string | undefined) {
  const api = useApi()
  const dice = useDice()
  const campaigns = useQuery({
    queryKey: ['campaigns', worldId],
    queryFn: () => api.call('listCampaigns', { worldId: worldId ?? '' }),
    enabled: Boolean(worldId)
  })
  const list = campaigns.data?.campaigns ?? []
  const chosen: Campaign | undefined = list.find((c) => c.id === (worldId && dice.campaignFor(worldId))) ?? list[0]
  return { list, chosen, loading: campaigns.isPending }
}

export function DicePanel() {
  const worldId = useWorldInPath()
  if (!worldId) return null
  return <WorldDice key={worldId} worldId={worldId} />
}

/** Dentro de una campaña se tira en ella; fuera, en la elegida (con varias, se elige junto a «Tirar») */
const IN_CAMPAIGN = /^\/mundos\/[^/]+\/campanas\/[^/]+/

function WorldDice({ worldId }: { worldId: string }) {
  const { t } = useTranslation()
  const dice = useDice()
  // Las campañas, solo de un mundo que existe y se puede ver (el de una dirección cualquiera, no)
  const api = useApi()
  const worlds = useQuery({ queryKey: ['worlds'], queryFn: () => api.call('listWorlds', {}) })
  const known = worlds.data?.worlds.some((w) => w.id === worldId) ?? false
  const { list, chosen, loading } = useDiceCampaign(known ? worldId : undefined)
  const [pool, change] = useReducer(poolReducer, EMPTY)
  const sheet = useSheet()
  const inCampaign = useRouterState({ select: (state) => IN_CAMPAIGN.test(state.location.pathname) })
  const choose = list.length > 1 && !inCampaign
  const chooser = choose && chosen ? <CampaignChooser worldId={worldId} list={list} chosen={chosen} /> : null
  return (
    <>
      <DiceLauncher />
      {dice.open && (
        <Floating
          label={t('dice.title')}
          className={styles.dice}
          sheet={sheet}
          onClose={dice.close}
          tour="ficha-dados"
          open
        >
          {sheet && <span className={styles.grip} aria-hidden="true" />}
          {chosen ? (
            <DiceRack campaign={chosen} pool={pool} change={change} sheet={sheet} chooser={chooser} />
          ) : (
            !loading && <p className={styles.empty}>{t('dice.noCampaign')}</p>
          )}
          <Tour
            id="dados"
            steps={[
              { target: '[data-tour="dados-columna"]', text: t('tour.dice.card'), placement: 'left' },
              { target: '[data-tour="dados-historial"]', text: t('tour.dice.roll'), placement: 'left' }
            ]}
          />
        </Floating>
      )}
      {dice.history && (
        <Floating label={t('dice.history')} className={styles.card} sheet={sheet} onClose={dice.closeHistory}>
          {sheet && <span className={styles.grip} aria-hidden="true" />}
          <header className={styles.head}>
            <h2 className={styles.title}>{t('dice.history')}</h2>
            {chooser ?? (chosen && <span className={styles.campaignName}>{chosen.name}</span>)}
            <HistoryClose />
          </header>
          {chosen ? (
            <RollLog key={chosen.id} campaign={chosen} />
          ) : (
            !loading && <p className={styles.empty}>{t('dice.noCampaign')}</p>
          )}
        </Floating>
      )}
      {chosen && <RollNotices key={chosen.id} campaign={chosen} />}
    </>
  )
}

/** La × del historial: al abrirse, el foco va a ella (lo que lo abrió ya no está); al cerrar, vuelve al d20 */
function HistoryClose() {
  const { t } = useTranslation()
  const close = useCloseFloating()
  return (
    <button
      type="button"
      className={styles.close}
      aria-label={t('dice.closeHistory')}
      // biome-ignore lint/a11y/noAutofocus: el botón que abrió el historial desaparece al abrirlo
      autoFocus
      onClick={close}
    >
      <X size={16} aria-hidden="true" />
    </button>
  )
}

/** En qué campaña se tira, con varias en el mundo (se recuerda) */
function CampaignChooser({ worldId, list, chosen }: { worldId: string; list: Campaign[]; chosen: Campaign }) {
  const { t } = useTranslation()
  const dice = useDice()
  const id = useId()
  return (
    <>
      <label className={styles.hidden} htmlFor={`${id}-campaign`}>
        {t('dice.campaign')}
      </label>
      <select
        id={`${id}-campaign`}
        className={styles.campaign}
        value={chosen.id}
        onChange={(event) => dice.setCampaign(worldId, event.currentTarget.value)}
      >
        {list.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </>
  )
}

/** El botón flotante: un d20, como en las fichas de D&D Beyond */
function DiceLauncher() {
  const { t } = useTranslation()
  const dice = useDice()
  return (
    <button
      type="button"
      className={styles.launcher}
      aria-expanded={dice.open}
      title={t('ribbon.dice')}
      data-tour="dados"
      onClick={dice.toggle}
    >
      {/* Su nombre, en texto (no aria-label): el «20» del dibujo se lee como texto visible (WCAG 2.5.3) */}
      <span className={styles.hidden}>{t('ribbon.dice')}</span>
      <D20 />
    </button>
  )
}

/** Un d20 de frente: el hexágono, su cara de arriba y las aristas que bajan a los lados */
function D20() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" className={styles.d20}>
      <path d="M12 2 21 7v10l-9 5-9-5V7z" />
      <path d="M12 7.5 17 16H7z" />
      <path d="M12 2v5.5M21 7l-4 9M3 7l4 9M7 16l-4 1M17 16l4 1M7 16l5 6M17 16l-5 6" />
      {/* El «20», con trazos y no con texto: así no cuenta como texto de la página (axe le medía el contraste) */}
      <path
        className={styles.digits}
        d="M10.05 11.45a0.9 0.9 0 0 1 1.75 0.25c0 0.45-0.3 0.75-0.65 1.1L10.05 14.1h1.8"
      />
      <ellipse className={styles.digits} cx="13.25" cy="12.6" rx="0.8" ry="1.45" />
    </svg>
  )
}

/**
 * Lo que flota junto al d20 (los dados abiertos, el historial): se cierra con Escape (el foco vuelve al d20) o al pulsar
 * fuera. En el móvil es una hoja con la página oscurecida detrás, que se porta como una ventana
 */
function Floating({
  label,
  className,
  sheet,
  onClose,
  tour,
  open,
  children
}: {
  label: string
  className: string | undefined
  sheet: boolean
  onClose: () => void
  tour?: string
  /** Los dados abiertos: el «?» se esconde mientras */
  open?: boolean
  children: ReactNode
}) {
  const card = useRef<HTMLElement>(null)
  // Lo de detrás, inerte mientras la hoja está abierta en el móvil; se suelta antes de devolver el foco al d20
  const release = useRef<() => void>(() => {})
  const close = useCallback(() => {
    release.current()
    onClose()
    focusLauncher()
  }, [onClose])
  useEffect(() => {
    if (!sheet) return
    const own = card.current
    const parent = own?.parentElement
    if (!own || !parent) return
    const frozen = [...parent.children].filter(
      (el): el is HTMLElement => el instanceof HTMLElement && el !== own && !el.inert && !el.dataset.diceBackdrop
    )
    for (const el of frozen) el.inert = true
    release.current = () => {
      for (const el of frozen) el.inert = false
      frozen.length = 0
    }
    // Si dentro ya tiene el foco algo (el campo de la tirada escrita, la × del historial), se queda ahí
    if (!own.contains(document.activeElement)) own.focus()
    return () => release.current()
  }, [sheet])
  // Pulsar fuera lo cierra (sin mover el foco: va a lo que se pulsó). No cuentan el d20, que lo abre y lo cierra, ni un
  // cuadro que se abrió desde dentro (aplicar el daño, el color de los dados)
  useEffect(() => {
    const outside = (event: globalThis.PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (!target || card.current?.contains(target)) return
      if (target.closest('[data-tour="dados"], dialog[open]')) return
      release.current()
      onClose()
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [onClose])
  // Escape lo cierra y el foco vuelve al d20
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      // Un menú o un cuadro abierto encima se cierra él antes
      const above = (event.target as HTMLElement | null)?.closest(
        'dialog, [role="dialog"], [role="menu"], [role="listbox"], [data-popover]'
      )
      if (above && above !== card.current) return
      close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [close])
  // En el móvil, Tab no sale de la hoja: del último control vuelve al primero, y al revés
  const trap = (event: React.KeyboardEvent) => {
    if (!sheet || event.key !== 'Tab' || !card.current) return
    const controls = [...card.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
    const first = controls[0]
    const last = controls.at(-1)
    if (!first || !last) return
    if (event.shiftKey && (document.activeElement === first || document.activeElement === card.current)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }
  const Card = sheet ? 'div' : 'aside'
  return (
    <>
      {/* En el móvil, la hoja sube desde abajo con la página oscurecida detrás: pulsar fuera la cierra */}
      <button
        type="button"
        className={styles.backdrop}
        aria-hidden="true"
        tabIndex={-1}
        data-dice-backdrop="true"
        onClick={close}
      />
      <Card
        ref={(element: HTMLElement | null) => {
          card.current = element
        }}
        tabIndex={-1}
        className={className}
        aria-label={label}
        data-tour={tour}
        data-dice-open={open || undefined}
        {...(sheet ? { role: 'dialog', 'aria-modal': true } : {})}
        onKeyDown={trap}
      >
        <CloseFloating.Provider value={close}>{children}</CloseFloating.Provider>
      </Card>
    </>
  )
}

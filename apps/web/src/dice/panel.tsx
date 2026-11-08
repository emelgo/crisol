/**
 * Los dados de un mundo (docs/diseno.md): un botón flotante con forma de d20, abajo a la derecha, que abre y cierra
 * su ficha junto a él, en esa esquina (no es una pantalla ni va en la barra). En la ficha, arriba, la campaña en la
 * que se tira (con varias, se elige y se recuerda); abajo, la tirada
 */
import type { Campaign } from '@crisol/contracts'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Settings, X } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useDismiss } from '../components/dismiss.ts'
import { Tour } from '../components/tour.tsx'
import { Composer } from './composer.tsx'
import { useDice, useWorldInPath } from './context.tsx'
import styles from './dice.module.css'
import { RollLog } from './log.tsx'
import { appendRoll } from './rolls.ts'
import { useTray } from './tray.tsx'

/** En el móvil la ficha es una hoja con la página oscurecida: se porta como una ventana */
const SHEET = '(max-width: 48rem)'
function useSheet(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia?.(SHEET)
      query?.addEventListener('change', onChange)
      return () => query?.removeEventListener('change', onChange)
    },
    () => window.matchMedia?.(SHEET).matches ?? false,
    () => false
  )
}

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
  const dice = useDice()
  if (!worldId) return null
  return (
    <>
      <DiceLauncher />
      {dice.open && <DiceCard key={worldId} worldId={worldId} />}
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
      <path className={styles.digits} d="M10.05 11.45a0.9 0.9 0 0 1 1.75 0.25c0 0.45-0.3 0.75-0.65 1.1L10.05 14.1h1.8" />
      <ellipse className={styles.digits} cx="13.25" cy="12.6" rx="0.8" ry="1.45" />
    </svg>
  )
}

function DiceCard({ worldId }: { worldId: string }) {
  const { t } = useTranslation()
  const dice = useDice()
  const id = useId()
  const queryClient = useQueryClient()
  const tray = useTray()
  const accounts = useAccounts()
  const { account } = accounts.useAccount()
  const [options, setOptions] = useState(false)
  const optionsRoot = useRef<HTMLDivElement>(null)
  const gear = useRef<HTMLButtonElement>(null)
  useDismiss(
    options,
    useCallback(() => setOptions(false), []),
    optionsRoot,
    gear
  )
  const { list, chosen, loading } = useDiceCampaign(worldId)
  const card = useRef<HTMLElement>(null)
  const sheet = useSheet()
  // Con el menú del engranaje abierto, Escape cierra solo el menú
  const optionsOpen = useRef(options)
  optionsOpen.current = options
  // Lo de detrás, inerte mientras la hoja está abierta en el móvil; se suelta antes de devolver el foco al d20
  const release = useRef<() => void>(() => {})
  const closeCard = useCallback(() => {
    release.current()
    dice.close()
    document.querySelector<HTMLElement>('[data-tour="dados"]')?.focus()
  }, [dice.close])
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
    own.focus()
    return () => release.current()
  }, [sheet])
  // Escape la cierra y el foco vuelve al d20
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || optionsOpen.current) return
      // Un menú o un cuadro abierto encima se cierra él antes
      if ((event.target as HTMLElement | null)?.closest('dialog, [role="menu"], [role="listbox"]')) return
      closeCard()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [closeCard])
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
        onClick={closeCard}
      />
      <Card
        ref={(element: HTMLElement | null) => {
          card.current = element
        }}
        tabIndex={-1}
        className={styles.card}
        aria-label={t('dice.title')}
        data-tour="ficha-dados"
        {...(sheet ? { role: 'dialog', 'aria-modal': true } : {})}
        onKeyDown={trap}
      >
        <span className={styles.grip} aria-hidden="true" />
        <header className={styles.head}>
          <h2 className={styles.title}>{t('dice.title')}</h2>
          {list.length > 1 && chosen ? (
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
          ) : (
            chosen && <span className={styles.campaignName}>{chosen.name}</span>
          )}
          <button
            ref={gear}
            type="button"
            className={styles.gear}
            aria-label={t('dice.options')}
            aria-expanded={options}
            onClick={() => setOptions(!options)}
          >
            <Settings size={16} aria-hidden="true" />
          </button>
          {options && (
            <div ref={optionsRoot} className={styles.options}>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={account?.diceOthers !== false}
                  onChange={(event) => void accounts.updateDice({ diceOthers: event.currentTarget.checked })}
                />
                {t('dice.others')}
              </label>
            </div>
          )}
          <button type="button" className={styles.close} aria-label={t('dice.close')} onClick={closeCard}>
            <X size={16} aria-hidden="true" />
          </button>
        </header>
        {chosen ? (
          <>
            <RollLog key={chosen.id} campaign={chosen} />
            <div data-tour="tirada">
              <Composer
                key={chosen.id}
                campaign={chosen}
                onRolled={(roll) => {
                  appendRoll(queryClient, roll)
                  tray.play(roll)
                }}
              />
            </div>
          </>
        ) : (
          !loading && <p className={styles.empty}>{t('dice.noCampaign')}</p>
        )}
        <Tour
          id="dados"
          steps={[
            { target: '[data-tour="ficha-dados"]', text: t('tour.dice.card'), placement: 'left' },
            { target: '[data-tour="tirada"]', text: t('tour.dice.roll'), placement: 'left' }
          ]}
        />
      </Card>
    </>
  )
}

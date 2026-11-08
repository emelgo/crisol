/**
 * Los dados de un mundo (docs/diseno.md): un botón flotante con forma de d20, abajo a la derecha, que abre y cierra
 * su ficha junto a él, en esa esquina (no es una pantalla ni va en la barra). En la ficha, arriba, la campaña en la
 * que se tira (con varias, se elige y se recuerda); abajo, la tirada
 */
import type { Campaign } from '@crisol/contracts'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Settings, X } from 'lucide-react'
import { useCallback, useId, useRef, useState } from 'react'
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
      aria-label={t('ribbon.dice')}
      aria-expanded={dice.open}
      title={t('ribbon.dice')}
      data-tour="dados"
      onClick={dice.toggle}
    >
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
      <text x="12" y="14.6" textAnchor="middle">
        20
      </text>
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
  return (
    <>
      {/* En el móvil, la hoja sube desde abajo con la página oscurecida detrás: pulsar fuera la cierra */}
      <button type="button" className={styles.backdrop} aria-hidden="true" tabIndex={-1} onClick={dice.close} />
      <aside className={styles.card} aria-label={t('dice.title')} data-tour="ficha-dados">
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
          <button type="button" className={styles.close} aria-label={t('dice.close')} onClick={dice.close}>
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
      </aside>
    </>
  )
}

/**
 * La ficha de dados de un mundo: a la derecha, en el sitio del panel de la página, sin tapar el texto. Se abre y se
 * cierra con «Dados» en la barra. Arriba, la campaña en la que se tira (con varias, se elige y se recuerda); abajo,
 * la tirada
 */
import type { Campaign } from '@crisol/contracts'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Settings, X } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
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
  if (!worldId || !dice.open) return null
  return <DiceCard key={worldId} worldId={worldId} />
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
            type="button"
            className={styles.gear}
            aria-label={t('dice.options')}
            aria-expanded={options}
            onClick={() => setOptions(!options)}
          >
            <Settings size={16} aria-hidden="true" />
          </button>
          {options && (
            <div className={styles.options}>
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

/**
 * La ficha de dados de un mundo: a la derecha, en el sitio del panel de la página, sin tapar el texto. Se abre y se
 * cierra con «Dados» en la barra. Arriba, la campaña en la que se tira (con varias, se elige y se recuerda); abajo,
 * la tirada
 */
import type { Campaign } from '@crisol/contracts'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouterState } from '@tanstack/react-router'
import { X } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { Tour } from '../components/tour.tsx'
import { Composer } from './composer.tsx'
import { useDice } from './context.tsx'
import styles from './dice.module.css'
import { RollLog } from './log.tsx'
import { appendRoll } from './rolls.ts'

/** El mundo en el que se está, si se está en uno */
export function useWorldInPath() {
  return useRouterState({ select: (state) => /^\/mundos\/([^/]+)/.exec(state.location.pathname)?.[1] })
}

/** Las campañas del mundo en las que puede tirar la cuenta, y la elegida */
export function useDiceCampaign(worldId: string) {
  const api = useApi()
  const dice = useDice()
  const campaigns = useQuery({
    queryKey: ['campaigns', worldId],
    queryFn: () => api.call('listCampaigns', { worldId })
  })
  const list = campaigns.data?.campaigns ?? []
  const chosen: Campaign | undefined = list.find((c) => c.id === dice.campaignFor(worldId)) ?? list[0]
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
  const { list, chosen, loading } = useDiceCampaign(worldId)
  return (
    <aside className={styles.card} aria-label={t('dice.title')} data-tour="ficha-dados">
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
        <button type="button" className={styles.close} aria-label={t('dice.close')} onClick={dice.close}>
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      {chosen ? (
        <>
          <RollLog key={chosen.id} campaign={chosen} />
          <div data-tour="tirada">
            <Composer key={chosen.id} campaign={chosen} onRolled={(roll) => appendRoll(queryClient, roll)} />
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
  )
}

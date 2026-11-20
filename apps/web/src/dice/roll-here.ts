/**
 * Tirar desde donde se está (una tirada escrita en una página): en la campaña elegida en la ficha de dados y con su
 * visibilidad (si vale en ella). Si el mundo no tiene campañas, sin apuntar, y se dice
 */
import type { DiceRoll } from '@crisol/contracts'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { useDice, useWorldInPath } from './context.tsx'
import { appendRoll } from './rolls.ts'
import { useTray } from './tray.tsx'
import { visibilityIn } from './visibility.ts'

export function useRollHere() {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const announce = useAnnounce()
  const tray = useTray()
  const dice = useDice()
  const { account } = useAccounts().useAccount()
  const worldId = useWorldInPath()
  const errorText = useErrorText()
  const roll = async (formula: string) => {
    // La campaña elegida en la ficha (o la primera); si aún se están pidiendo, se espera a ellas
    const data = worldId
      ? await queryClient.ensureQueryData({
          queryKey: ['campaigns', worldId],
          queryFn: () => api.call('listCampaigns', { worldId })
        })
      : null
    const campaigns = data?.campaigns ?? []
    const chosen = campaigns.find((c) => c.id === (worldId && dice.campaignFor(worldId))) ?? campaigns[0]
    if (chosen) {
      const visibility = visibilityIn(dice.visibility, chosen.role)
      // Los dados caen ya, mientras se pregunta; si falla, se van
      const throwing = tray.start(formula)
      const { roll: done } = await api
        .call('rollDice', { campaignId: chosen.id, formula, visibility })
        .catch((error: unknown) => {
          throwing?.cancel()
          throw error
        })
      appendRoll(queryClient, done)
      if (throwing) throwing.land(done)
      else tray.play(done)
      announce(t('dice.rolled', { label: done.label ?? done.formula, total: done.total }))
      return
    }
    const tried = await api.call('tryDice', { formula })
    const alone: DiceRoll = {
      ...tried,
      id: crypto.randomUUID(),
      campaignId: '',
      by: { userId: account?.id ?? '', name: account?.name ?? '', color: account?.diceColor ?? null },
      ai: false,
      visibility: 'all',
      createdAt: new Date().toISOString()
    }
    tray.play(alone)
    announce(t('dice.rolledAlone', { label: tried.label ?? tried.formula, total: tried.total }))
  }
  // Lo que falle (el límite por minuto, la red) se dice, como en la ficha
  return (formula: string) => roll(formula).catch((error: unknown) => announce(errorText(error)))
}

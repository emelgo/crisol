/**
 * Tirar desde donde se está (una tirada escrita en una página): en la campaña elegida en la ficha de dados y con su
 * visibilidad (si vale en ella). Si el mundo no tiene campañas, sin apuntar, y se dice
 */
import type { DiceRoll, RollVisibility } from '@crisol/contracts'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useAnnounce } from '../components/announcer.tsx'
import { useDice, useWorldInPath } from './context.tsx'
import { useDiceCampaign } from './panel.tsx'
import { appendRoll } from './rolls.ts'
import { useTray } from './tray.tsx'

const ALLOWED: Record<'master' | 'player', readonly RollVisibility[]> = {
  master: ['all', 'hidden'],
  player: ['all', 'self', 'master']
}

export function useRollHere() {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const announce = useAnnounce()
  const tray = useTray()
  const dice = useDice()
  const { account } = useAccounts().useAccount()
  const worldId = useWorldInPath()
  const { chosen } = useDiceCampaign(worldId)
  return async (formula: string) => {
    if (chosen) {
      const visibility = ALLOWED[chosen.role].includes(dice.visibility) ? dice.visibility : 'all'
      const { roll } = await api.call('rollDice', { campaignId: chosen.id, formula, visibility })
      appendRoll(queryClient, roll)
      tray.play(roll)
      announce(t('dice.rolled', { label: roll.label ?? roll.formula, total: roll.total }))
      return
    }
    const tried = await api.call('tryDice', { formula })
    const alone: DiceRoll = {
      ...tried,
      id: crypto.randomUUID(),
      campaignId: '',
      by: { userId: '', name: account?.name ?? '', color: account?.diceColor ?? null },
      ai: false,
      visibility: 'all',
      createdAt: new Date().toISOString()
    }
    tray.play(alone)
    announce(t('dice.rolledAlone', { label: tried.label ?? tried.formula, total: tried.total }))
  }
}

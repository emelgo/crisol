/**
 * El registro de tiradas de una campaña, en la ficha de dados: en el orden en que se tiraron, la última abajo. Llegan
 * en vivo (las de los demás se anuncian); las anteriores, al pedirlas, de 50 en 50
 */
import type { Campaign, DiceRoll, RollVisibility } from '@crisol/contracts'
import { describeFormula } from '@crisol/dice'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Crown, EyeOff, List, Repeat } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useAnnounce } from '../components/announcer.tsx'
import { useRolled } from '../realtime/context.tsx'
import styles from './log.module.css'
import { appendRoll, colorOf, type RollsPage, rollsKey } from './rolls.ts'

/** Lo que puede usar cada uno: Repetir vuelve a tirar con la misma visibilidad, si se puede; si no, para todos */
const ALLOWED: Record<Campaign['role'], readonly RollVisibility[]> = {
  master: ['all', 'hidden'],
  player: ['all', 'self', 'master']
}

const clock = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' })

export function RollLog({ campaign }: { campaign: Campaign }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const announce = useAnnounce()
  const { account } = useAccounts().useAccount()
  const list = useRef<HTMLOListElement>(null)
  const rolls = useInfiniteQuery({
    queryKey: rollsKey(campaign.id),
    queryFn: ({ pageParam }): Promise<RollsPage> =>
      api.call('listRolls', { campaignId: campaign.id, ...(pageParam ? { before: pageParam } : {}) }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next ?? undefined
  })
  // La más reciente, abajo: las páginas van de la más nueva a la más vieja
  const all = [...(rolls.data?.pages ?? [])].reverse().flatMap((page) => page.rolls)
  const last = all.at(-1)?.id
  // Lo nuevo, a la vista: abajo del todo
  useEffect(() => {
    if (last && list.current) list.current.scrollTop = list.current.scrollHeight
  }, [last])
  useRolled((roll) => {
    if (roll.campaignId !== campaign.id || roll.by.name === account?.name) return
    announce(t('dice.heard', { who: roll.by.name, label: roll.label ?? roll.formula, total: roll.total }))
  })
  const again = useMutation({
    mutationFn: (roll: DiceRoll) =>
      api.call('rollDice', {
        campaignId: campaign.id,
        formula: roll.label ? `${roll.formula} # ${roll.label}` : roll.formula,
        visibility:
          roll.by.name === account?.name && ALLOWED[campaign.role].includes(roll.visibility) ? roll.visibility : 'all'
      }),
    onSuccess: ({ roll }) => {
      appendRoll(queryClient, roll)
      announce(t('dice.rolled', { label: roll.label ?? roll.formula, total: roll.total }))
    }
  })
  return (
    <div className={styles.wrap}>
      {rolls.hasNextPage && (
        <button
          type="button"
          className={styles.older}
          disabled={rolls.isFetchingNextPage}
          onClick={() => void rolls.fetchNextPage()}
        >
          {t('dice.older')}
        </button>
      )}
      <ol ref={list} className={styles.log} aria-label={t('dice.log')}>
        {all.map((roll) => (
          <Entry key={roll.id} roll={roll} mine={roll.by.name === account?.name} onAgain={() => again.mutate(roll)} />
        ))}
      </ol>
    </div>
  )
}

function Entry({ roll, mine, onAgain }: { roll: DiceRoll; mine: boolean; onAgain: () => void }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const flag =
    roll.visibility === 'master'
      ? { text: t('dice.flag.master'), icon: Crown, cls: styles.flagMaster }
      : roll.visibility === 'self'
        ? { text: t(mine ? 'dice.flag.self' : 'dice.flag.selfOther'), icon: EyeOff, cls: styles.flag }
        : roll.visibility === 'hidden'
          ? { text: t('dice.flag.hidden'), icon: EyeOff, cls: styles.flag }
          : null
  const FlagIcon = flag?.icon
  return (
    <li className={flag ? styles.private : styles.entry}>
      <div className={styles.who}>
        <span
          className={styles.dot}
          style={{ background: colorOf(roll.by.userId, roll.by.color) }}
          aria-hidden="true"
        />
        <b>{mine ? t('dice.me') : roll.by.name}</b>
        {roll.ai && <span>{t('dice.ai')}</span>}
        <time dateTime={roll.createdAt}>{clock.format(new Date(roll.createdAt))}</time>
        {flag && FlagIcon && (
          <span className={flag.cls}>
            <FlagIcon size={13} aria-hidden="true" />
            {flag.text}
          </span>
        )}
      </div>
      <div className={styles.line}>
        <div className={styles.what}>
          <span className={styles.label}>{roll.label ?? describeFormula(roll.formula)}</span>
          <span className={styles.formula}>{roll.formula}</span>
        </div>
        <div className={styles.result}>
          <span
            className={
              roll.critical === 'high'
                ? styles.totalCritical
                : roll.critical === 'low'
                  ? styles.totalFumble
                  : styles.total
            }
          >
            {roll.total}
          </span>
          {roll.critical && (
            <span className={roll.critical === 'high' ? styles.critical : styles.fumble}>
              {t(roll.critical === 'high' ? 'dice.critical' : 'dice.fumble')}
            </span>
          )}
        </div>
      </div>
      <div className={styles.more}>
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
          <List size={13} aria-hidden="true" />
          {t('dice.breakdown')}
        </button>
        <button type="button" onClick={onAgain}>
          <Repeat size={13} aria-hidden="true" />
          {t('dice.again')}
        </button>
      </div>
      {open && <p className={styles.detail}>{roll.detail}</p>}
    </li>
  )
}

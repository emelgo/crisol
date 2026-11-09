/**
 * El historial de tiradas de una campaña (lienzo «Tirar dados»): en el orden en que se tiraron, la última abajo, con
 * quién, lo que salió en cada dado y el total. Todas o solo las mías. Llegan en vivo (las de los demás se anuncian
 * desde el aviso de resultados); las anteriores, al pedirlas, de 50 en 50. Cada una se repite con «Otra vez»; el máster aplica su daño
 */
import type { Campaign, DiceRoll } from '@crisol/contracts'
import { describeFormula } from '@crisol/dice'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Crown, EyeOff, Repeat, Settings, Swords } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useDismiss } from '../components/dismiss.ts'
import { ApplyRoll } from '../creatures/apply.tsx'
import styles from './log.module.css'
import { DiceRow, RollTags, useRollAgain } from './roll-parts.tsx'
import { colorOf, isMine, type RollsPage, rollsKey } from './rolls.ts'

export { againVisibility } from './roll-parts.tsx'

const clock = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' })

export function RollLog({ campaign }: { campaign: Campaign }) {
  const { t } = useTranslation()
  const api = useApi()
  const { account } = useAccounts().useAccount()
  const list = useRef<HTMLOListElement>(null)
  const [onlyMine, setOnlyMine] = useState(false)
  const rolls = useInfiniteQuery({
    queryKey: rollsKey(campaign.id),
    queryFn: ({ pageParam }): Promise<RollsPage> =>
      api.call('listRolls', { campaignId: campaign.id, ...(pageParam ? { before: pageParam } : {}) }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next ?? undefined
  })
  // La más reciente, abajo: las páginas van de la más nueva a la más vieja
  const all = [...(rolls.data?.pages ?? [])].reverse().flatMap((page) => page.rolls)
  const shown = onlyMine ? all.filter((roll) => isMine(roll, account)) : all
  const last = shown.at(-1)?.id
  // Lo nuevo, a la vista: abajo del todo
  // (tras pintarse, dos veces: la ventana acaba de abrirse y las tiradas de abajo toman su alto al verse)
  useEffect(() => {
    const el = list.current
    if (!last || !el) return
    const bottom = () => {
      el.scrollTop = el.scrollHeight
    }
    bottom()
    let second = 0
    const first = requestAnimationFrame(() => {
      bottom()
      second = requestAnimationFrame(bottom)
    })
    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [last])
  const again = useRollAgain(campaign)
  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <div className={styles.segmented}>
          <button type="button" aria-pressed={!onlyMine} onClick={() => setOnlyMine(false)}>
            {t('dice.all')}
          </button>
          <button type="button" aria-pressed={onlyMine} onClick={() => setOnlyMine(true)}>
            {t('dice.mine')}
          </button>
        </div>
        <DiceOptions />
      </div>
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
        {shown.map((roll) => (
          <Entry
            key={roll.id}
            roll={roll}
            mine={isMine(roll, account)}
            master={campaign.role === 'master'}
            onAgain={() => again.mutate(roll)}
          />
        ))}
      </ol>
      {shown.length === 0 && !rolls.isPending && <p className={styles.empty}>{t('dice.none')}</p>}
    </div>
  )
}

/** El engranaje: ver caer o no los dados de los demás */
function DiceOptions() {
  const { t } = useTranslation()
  const accounts = useAccounts()
  const { account } = accounts.useAccount()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const gear = useRef<HTMLButtonElement>(null)
  useDismiss(
    open,
    useCallback(() => setOpen(false), []),
    root,
    gear
  )
  return (
    <span className={styles.optionsWrap}>
      <button
        ref={gear}
        type="button"
        className={styles.gear}
        aria-label={t('dice.options')}
        title={t('dice.options')}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Settings size={15} aria-hidden="true" />
      </button>
      {open && (
        <div ref={root} className={styles.options}>
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
    </span>
  )
}

function Entry({
  roll,
  mine,
  master,
  onAgain
}: {
  roll: DiceRoll
  mine: boolean
  /** El máster aplica el daño de una tirada a las criaturas en juego y a los personajes */
  master: boolean
  onAgain: () => void
}) {
  const { t } = useTranslation()
  const [applying, setApplying] = useState(false)
  const flag =
    roll.visibility === 'master'
      ? { text: t('dice.flag.master'), icon: Crown, cls: styles.flagMaster }
      : roll.visibility === 'self'
        ? { text: t(mine ? 'dice.flag.self' : 'dice.flag.selfOther'), icon: EyeOff, cls: styles.flag }
        : roll.visibility === 'hidden'
          ? { text: t('dice.flag.hidden'), icon: EyeOff, cls: styles.flag }
          : null
  const FlagIcon = flag?.icon
  const who = mine ? t('dice.me') : roll.by.name
  const what = roll.label ?? describeFormula(roll.formula)
  return (
    <li className={flag ? styles.private : styles.entry}>
      <span className={styles.avatar} style={{ background: colorOf(roll.by.userId, roll.by.color) }} aria-hidden="true">
        {roll.by.name.trim().charAt(0).toUpperCase()}
      </span>
      <div className={styles.body}>
        <div className={styles.who}>
          <b>{who}</b>
          {roll.ai && <span>{t('dice.ai')}</span>}
          <time dateTime={roll.createdAt}>{clock.format(new Date(roll.createdAt))}</time>
          {flag && FlagIcon && (
            <span className={flag.cls}>
              <FlagIcon size={12} aria-hidden="true" />
              {flag.text}
            </span>
          )}
        </div>
        <p className={styles.what}>
          <span className={styles.label}>{what}</span>
          {roll.label && (
            <span className={styles.formula} translate="no">
              {' · '}
              {roll.formula}
            </span>
          )}
        </p>
        <DiceRow roll={roll} />
        <RollTags roll={roll} />
        {/* En una tabla: lo que salió (y lo de sus tablas anidadas) */}
        {roll.table && (
          <ul className={styles.tableResults}>
            {roll.table.results
              .map((result, i) => ({ id: `${roll.id}-${i}`, text: result.text }))
              .map((result) => (
                <li key={result.id}>{result.text}</li>
              ))}
          </ul>
        )}
      </div>
      <div className={styles.side}>
        <span className={styles.total} data-critical={roll.critical ?? undefined}>
          {roll.total}
        </span>
        <div className={styles.more}>
          <button type="button" aria-label={t('dice.againOf', { what })} title={t('dice.again')} onClick={onAgain}>
            <Repeat size={14} aria-hidden="true" />
          </button>
          {master && roll.apply && (
            <button type="button" onClick={() => setApplying(true)}>
              <Swords size={13} aria-hidden="true" />
              {t('inPlay.apply.open')}
            </button>
          )}
        </div>
      </div>
      {applying && <ApplyRoll roll={roll} onClose={() => setApplying(false)} />}
    </li>
  )
}

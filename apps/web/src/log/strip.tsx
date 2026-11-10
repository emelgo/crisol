/**
 * El registro de la partida en la Mesa (docs/specs/registro.md, lienzo «Sala de jugadores», tableros A y C): una tira de
 * cristal abajo, a la derecha del zoom, con las últimas líneas y el cuadro para escribir; al desplegarla, el hilo entero.
 * Lo que llega lo decide el servidor (a cada uno, lo suyo); aquí se vuelve a pedir con cada aviso
 */
import type { Campaign, LogEntry } from '@crisol/contracts'
import { describeFormula } from '@crisol/dice'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, ChevronUp, Lock, MessageSquare, SendHorizontal, Trash2 } from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useDismiss } from '../components/dismiss.ts'
import { useDice } from '../dice/context.tsx'
import { RollLog } from '../dice/log.tsx'
import { colorOf } from '../dice/rolls.ts'
import { useRolled } from '../realtime/context.tsx'
import styles from './strip.module.css'

const MASTER = 'master'
const DELETE_WINDOW_MS = 5 * 60_000
const clock = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' })

export const logKey = (campaignId: string) => ['log', campaignId]

type Page = { entries: LogEntry[]; next: string | null }
type Tab = 'chat' | 'rolls' | 'all'

/** Lo que escribe quien está en la caja: un susurro (/s nombre), una tirada (/t), una acción (/yo) o fuera de personaje (/ooc) */
export function parseCommand(
  raw: string,
  recipients: readonly { id: string; name: string }[]
):
  | { kind: 'say'; text: string; style?: 'ic' | 'ooc' | 'emote'; whisper?: string[] }
  | { kind: 'roll'; formula: string }
  | { kind: 'error'; code: 'noRecipient' } {
  const text = raw.trim()
  const command = /^\/(\S+)\s*([\s\S]*)$/.exec(text)
  if (!command) return { kind: 'say', text }
  const [, name = '', rest = ''] = command
  const lower = name.toLowerCase()
  if (lower === 't' || lower === 'tirar') return { kind: 'roll', formula: rest }
  if (lower === 'yo' || lower === 'me') return { kind: 'say', text: rest, style: 'emote' }
  if (lower === 'ooc') return { kind: 'say', text: rest, style: 'ooc' }
  if (lower === 's' || lower === 'w') {
    const [who = '', ...words] = rest.split(/\s+/)
    const found = recipients.find((r) => r.name.toLowerCase().split(/\s+/)[0] === who.toLowerCase())
    if (!found) return { kind: 'error', code: 'noRecipient' }
    return { kind: 'say', text: words.join(' '), whisper: [found.id] }
  }
  return { kind: 'say', text }
}

export function LogStrip({
  campaign,
  edge = false
}: {
  campaign: Campaign /** Sin zoom al lado: pegada al borde */
  edge?: boolean
}) {
  const { t } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const queryClient = useQueryClient()
  const { account } = useAccounts().useAccount()
  const master = campaign.role === 'master'
  // Minimizada (solo su cabecera, con cuántas nuevas) o abierta (el hilo y el cuadro); se recuerda en este aparato
  const remembered = `crisol.registro.${campaign.id}`
  const [open, setOpenState] = useState(() => {
    try {
      return localStorage.getItem(remembered) === 'abierto'
    } catch {
      return false
    }
  })
  const setOpen = (next: boolean) => {
    setOpenState(next)
    try {
      localStorage.setItem(remembered, next ? 'abierto' : 'cerrado')
    } catch {
      // Sin almacenamiento, solo mientras dure la pestaña
    }
  }
  const [seen, setSeen] = useState<number | null>(null)
  // Chat (sin tiradas, limpio), Tiradas (el historial de los dados) o Todo (Enrique, 2026-11-10)
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const stored = localStorage.getItem(`${remembered}.pestana`)
      return stored === 'rolls' || stored === 'all' ? stored : 'chat'
    } catch {
      return 'chat'
    }
  })
  const pick = (next: Tab) => {
    setTab(next)
    try {
      localStorage.setItem(`${remembered}.pestana`, next)
    } catch {
      // Sin almacenamiento, solo mientras dure la pestaña
    }
  }
  // «Historial» en los dados abre el registro en sus tiradas
  const { setHistoryHost } = useDice()
  useEffect(() => {
    setHistoryHost(() => {
      setOpenState(true)
      setTab('rolls')
    })
    return () => setHistoryHost(null)
  }, [setHistoryHost])
  const [text, setText] = useState('')
  const [whisper, setWhisper] = useState<string[]>([])
  const [problem, setProblem] = useState<string | null>(null)
  const list = useRef<HTMLOListElement>(null)
  const key = logKey(campaign.id)
  const only = tab === 'all' ? 'all' : 'messages'
  const log = useInfiniteQuery({
    queryKey: [...key, only],
    queryFn: ({ pageParam }): Promise<Page> =>
      api.call('listLog', { campaignId: campaign.id, only, ...(pageParam ? { before: pageParam } : {}) }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next ?? undefined
  })
  const members = useQuery({
    queryKey: ['members', campaign.id],
    queryFn: () => api.call('listMembers', { campaignId: campaign.id })
  })
  // Las tiradas llegan por su aviso (no por el del registro): también se vuelve a pedir
  useRolled((roll) => {
    if (roll.campaignId === campaign.id) void queryClient.invalidateQueries({ queryKey: key })
  })
  const me = account?.id ?? ''
  const recipients = [
    ...(master ? [] : [{ id: MASTER, name: t('log.master') }]),
    ...(members.data?.members ?? [])
      .filter((m) => m.userId !== me && m.role !== 'master')
      .map((m) => ({ id: m.userId, name: m.name }))
  ]
  const entries = [...(log.data?.pages ?? [])].reverse().flatMap((page) => page.entries)
  const last = entries.at(-1)?.id
  // Lo nuevo mientras está minimizada: cuántas han llegado desde que se cerró (o desde que se entró)
  useEffect(() => {
    if (open || !log.data) return
    setSeen((before) => before ?? entries.length)
  }, [open, log.data, entries.length])
  const unread = !open && seen !== null ? Math.max(0, entries.length - seen) : 0
  useEffect(() => {
    const el = list.current
    if (!el || !last) return
    el.scrollTop = el.scrollHeight
  }, [last, open])
  const refresh = () => queryClient.invalidateQueries({ queryKey: key })
  const send = useMutation({
    mutationFn: async (input: ReturnType<typeof parseCommand>) => {
      if (input.kind === 'roll') return api.call('rollDice', { campaignId: campaign.id, formula: input.formula })
      if (input.kind === 'error') return null
      return api.call('sendMessage', {
        campaignId: campaign.id,
        text: input.text,
        style: input.style ?? (master ? 'ooc' : 'ic'),
        ...(input.whisper ? { whisper: input.whisper } : whisper.length > 0 ? { whisper } : {})
      })
    },
    onSuccess: () => {
      setText('')
      // Tras un susurro, otra vez a todos: para no seguir susurrando sin querer
      setWhisper([])
      void refresh()
    }
  })
  const clear = useMutation({
    mutationFn: () => api.call('clearLog', { campaignId: campaign.id }),
    onSuccess: () => {
      setClearing(false)
      void refresh()
    }
  })
  const [clearing, setClearing] = useState(false)
  const remove = useMutation({
    mutationFn: (id: string) => api.call('deleteMessage', { campaignId: campaign.id, id }),
    onSuccess: () => void refresh()
  })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!text.trim() || send.isPending) return
    const parsed = parseCommand(text, recipients)
    if (parsed.kind === 'error') return setProblem(t('log.noRecipient'))
    if (parsed.kind === 'say' && !parsed.text.trim()) return
    if (parsed.kind === 'roll' && !parsed.formula.trim()) return
    setProblem(null)
    send.mutate(parsed)
  }
  const error = problem ?? (send.error ? errorText(send.error) : null)
  return (
    <section
      className={[styles.strip, open ? styles.open : '', edge ? styles.edge : ''].filter(Boolean).join(' ')}
      aria-label={t('log.title')}
    >
      <header className={styles.head}>
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={open}
          onClick={() => {
            if (open) setSeen(entries.length)
            setOpen(!open)
          }}
        >
          <MessageSquare size={14} aria-hidden="true" />
          <span>{t('log.title')}</span>
          {unread > 0 && <b className={styles.unread}>{t('log.unread', { count: unread })}</b>}
          {open ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronUp size={14} aria-hidden="true" />}
        </button>
      </header>
      {open && (
        <div className={styles.tabs} role="tablist" aria-label={t('log.title')}>
          {(['chat', 'rolls', 'all'] as const).map((each) => (
            <button
              key={each}
              type="button"
              role="tab"
              aria-selected={tab === each}
              className={styles.tab}
              onClick={() => pick(each)}
            >
              {t(`log.tabs.${each}`)}
            </button>
          ))}
          {master && tab !== 'rolls' && (
            <button type="button" className={styles.clear} onClick={() => setClearing(true)}>
              <Trash2 size={13} aria-hidden="true" />
              {t('log.clear')}
            </button>
          )}
        </div>
      )}
      {open && clearing && (
        <div className={styles.confirm} role="alert">
          <span>{t('log.clearConfirm')}</span>
          <button type="button" className={styles.danger} disabled={clear.isPending} onClick={() => clear.mutate()}>
            {t('log.clear')}
          </button>
          <button type="button" className={styles.cancel} onClick={() => setClearing(false)}>
            {t('list.cancel')}
          </button>
        </div>
      )}
      {open && tab === 'rolls' && (
        <div className={styles.rolls}>
          <RollLog campaign={campaign} />
        </div>
      )}
      {open && tab !== 'rolls' && log.hasNextPage && (
        <button
          type="button"
          className={styles.older}
          disabled={log.isFetchingNextPage}
          onClick={() => void log.fetchNextPage()}
        >
          {t('log.older')}
        </button>
      )}
      {open && tab !== 'rolls' && (
        <ol ref={list} className={styles.list} role="log" aria-label={t('log.title')}>
          {entries.map((entry) => (
            <Entry
              key={entry.id}
              entry={entry}
              me={me}
              master={master}
              canDelete={(id, at, by) =>
                entry.kind !== 'roll' && (master || (by === me && Date.now() - Date.parse(at) < DELETE_WINDOW_MS))
                  ? () => remove.mutate(id)
                  : null
              }
            />
          ))}
          {entries.length === 0 && !log.isPending && <li className={styles.empty}>{t('log.empty')}</li>}
        </ol>
      )}
      {open && (
        <form className={styles.compose} onSubmit={submit}>
          <Recipients recipients={recipients} chosen={whisper} onChange={setWhisper} />
          <input
            className={styles.input}
            value={text}
            maxLength={2000}
            placeholder={whisper.length > 0 ? t('log.whisperPlaceholder') : t('log.placeholder')}
            aria-label={t('log.write')}
            onChange={(event) => {
              setText(event.currentTarget.value)
              setProblem(null)
            }}
          />
          <button
            type="submit"
            className={styles.send}
            aria-label={t('log.send')}
            disabled={send.isPending || !text.trim()}
          >
            <SendHorizontal size={16} aria-hidden="true" />
          </button>
        </form>
      )}
      {open && text.startsWith('/') && <p className={styles.hint}>{t('log.commands')}</p>}
      {open && error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </section>
  )
}

/** Todos o un susurro: los destinatarios como fichas pulsables */
function Recipients({
  recipients,
  chosen,
  onChange
}: {
  recipients: readonly { id: string; name: string }[]
  chosen: string[]
  onChange: (next: string[]) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(open, close, menu, button)
  const names = recipients.filter((r) => chosen.includes(r.id)).map((r) => r.name)
  return (
    <span className={styles.modeWrap}>
      <button
        ref={button}
        type="button"
        className={chosen.length > 0 ? `${styles.mode} ${styles.whispering}` : styles.mode}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {chosen.length > 0 ? <Lock size={13} aria-hidden="true" /> : null}
        <span>{chosen.length > 0 ? t('log.to', { names: names.join(', ') }) : t('log.all')}</span>
        <ChevronDown size={13} aria-hidden="true" />
      </button>
      {open && (
        <div ref={menu} className={styles.menu} role="menu">
          <button
            type="button"
            role="menuitemradio"
            aria-checked={chosen.length === 0}
            onClick={() => {
              onChange([])
              close()
            }}
          >
            {t('log.all')}
            {chosen.length === 0 && <Check size={14} aria-hidden="true" />}
          </button>
          {recipients.length > 0 ? (
            <p className={styles.menuHead}>{t('log.whisperHead')}</p>
          ) : (
            <p className={styles.menuHint}>{t('log.nobodyToWhisper')}</p>
          )}
          {recipients.map((r) => (
            <button
              key={r.id}
              type="button"
              role="menuitemcheckbox"
              aria-checked={chosen.includes(r.id)}
              onClick={() => onChange(chosen.includes(r.id) ? chosen.filter((id) => id !== r.id) : [...chosen, r.id])}
            >
              <Lock size={13} aria-hidden="true" />
              {r.name}
              {chosen.includes(r.id) && <Check size={14} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </span>
  )
}

function Entry({
  entry,
  me,
  master,
  canDelete
}: {
  entry: LogEntry
  me: string
  master: boolean
  canDelete: (id: string, at: string, by: string) => (() => void) | null
}) {
  const { t } = useTranslation()
  if (entry.kind === 'roll') {
    const roll = entry.roll
    const what = roll.label ?? describeFormula(roll.formula)
    return (
      <li className={roll.visibility === 'all' ? styles.entry : `${styles.entry} ${styles.private}`}>
        <Avatar userId={roll.by.userId} name={roll.by.name} color={roll.by.color} />
        <div className={styles.body}>
          <p className={styles.line}>
            <b>{roll.by.name}</b> <span className={styles.muted}>{what}</span>
          </p>
          <p className={styles.detail} translate="no">
            {roll.detail}
          </p>
        </div>
        <span className={roll.critical ? `${styles.total} ${styles[roll.critical]}` : styles.total}>{roll.total}</span>
      </li>
    )
  }
  const del = canDelete(entry.id, entry.createdAt, entry.by.userId)
  const names = (list: readonly { id: string; name: string }[]) =>
    list.map((w) => (w.id === MASTER ? t('log.master') : w.name)).join(', ')
  // A mí o a los másteres (si lo soy): «Susurro de…»; mío: «Susurro a…»; entre otros (lo ve el máster): «De… a…»
  const toMe = entry.whisper?.some((w) => w.id === me || (master && w.id === MASTER)) ?? false
  const whisperLabel = entry.whisper
    ? entry.by.userId === me
      ? t('log.whisperTo', { names: names(entry.whisper) })
      : toMe
        ? t('log.whisperFrom', { name: entry.by.name })
        : t('log.whisperBetween', { from: entry.by.name, to: names(entry.whisper) })
    : null
  const time = <time dateTime={entry.createdAt}>{clock.format(new Date(entry.createdAt))}</time>
  if (entry.kind === 'shown') {
    return (
      <li className={styles.entry}>
        <Avatar userId={entry.by.userId} name={entry.by.name} color={entry.by.color} />
        <p className={styles.line}>
          <span className={styles.muted}>
            {t('log.shown', { name: entry.by.name, title: entry.shown?.title ?? '' })}
          </span>
        </p>
        {time}
      </li>
    )
  }
  const speaker = entry.speaker.kind === 'user' ? entry.by.name : entry.speaker.name
  return (
    <li className={whisperLabel ? `${styles.entry} ${styles.whisper}` : styles.entry}>
      <Avatar userId={entry.by.userId} name={speaker} color={entry.by.color} />
      <div className={styles.body}>
        {whisperLabel && (
          <p className={styles.whisperLabel}>
            <Lock size={11} aria-hidden="true" />
            {whisperLabel}
          </p>
        )}
        {entry.deleted ? (
          <p className={`${styles.line} ${styles.muted}`}>{t('log.deleted')}</p>
        ) : entry.style === 'emote' ? (
          <p className={`${styles.line} ${styles.emote}`}>
            {speaker} {entry.text}
          </p>
        ) : (
          <p className={styles.line}>
            <b>{speaker}</b>
            {entry.style === 'ic' && entry.speaker.kind !== 'user' && (
              <span className={styles.muted}> · {entry.by.name}</span>
            )}{' '}
            {entry.text}
          </p>
        )}
      </div>
      <span className={styles.side}>
        {time}
        {del && !entry.deleted && (
          <button
            type="button"
            className={styles.delete}
            aria-label={t('log.delete')}
            title={t('log.delete')}
            onClick={del}
          >
            <Trash2 size={12} aria-hidden="true" />
          </button>
        )}
      </span>
    </li>
  )
}

function Avatar({ userId, name, color }: { userId: string; name: string; color: string | null }) {
  return (
    <span className={styles.avatar} style={{ background: colorOf(userId, color) }} aria-hidden="true">
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  )
}

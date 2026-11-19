/**
 * La sala en la Mesa del máster (docs/specs/sala.md, lienzo «Sala de jugadores», tablero B): los retratos de quien
 * está, apilados junto a la escena, y la pausa; al pulsarlos, el panel con quién está en la Mesa, en la campaña o
 * fuera, la pausa, cómo mueven los jugadores y la invitación. Todo lo decide el servidor
 */
import type { TablePresenceEntry } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, LogOut, MoreHorizontal, Pause, Play, RefreshCw, Tv } from 'lucide-react'
import { type ReactNode, useCallback, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useDismiss } from '../components/dismiss.ts'
import { FormError } from '../components/field.tsx'
import segmented from '../components/segmented.module.css'
import { colorOf } from '../dice/rolls.ts'
import styles from './room.module.css'

type Movement = 'free' | 'turn' | 'locked'

export const roomKey = (campaignId: string) => ['tablePresence', campaignId]

/** La sala de una campaña (la presencia, los echados, la pausa y el modo) */
export function useRoom(campaignId: string) {
  const api = useApi()
  return useQuery({ queryKey: roomKey(campaignId), queryFn: () => api.call('getTablePresence', { campaignId }) })
}

const time = (iso: string) => new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })

function Avatar({
  userId,
  name,
  color,
  small
}: {
  userId: string
  name: string
  color?: string | null
  small?: boolean
}) {
  return (
    <span
      className={small ? `${styles.avatar} ${styles.avatarSmall}` : styles.avatar}
      style={{ background: colorOf(userId, color) }}
      aria-hidden="true"
    >
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  )
}

/** En la barra de la escena: los retratos (abren el panel) y la pausa */
export function RoomBar({ campaignId, extra }: { campaignId: string; extra?: ReactNode }) {
  const { t } = useTranslation()
  const room = useRoom(campaignId)
  const controls = useControls(campaignId)
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(open, close, panel, button)
  const present = (room.data?.present ?? []).filter((p) => p.viewer !== 'master')
  const players = present.filter((p) => p.viewer === 'player')
  const screen = present.some((p) => p.viewer === 'screen')
  const paused = room.data?.paused ?? false
  const shown = players.slice(0, 4)
  return (
    <div className={styles.bar}>
      <span className={styles.wrap}>
        <button
          ref={button}
          type="button"
          className={styles.faces}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={t('room.who', { count: players.length })}
          title={t('room.who', { count: players.length })}
          onClick={() => setOpen(!open)}
          data-tour="mesa-sala"
        >
          {shown.map((p) => (
            <span key={p.userId} className={styles.face}>
              <Avatar userId={p.userId} name={p.character?.name ?? p.name} color={p.color} />
              <span className={p.active ? styles.dot : `${styles.dot} ${styles.away}`} />
            </span>
          ))}
          {players.length > shown.length && <span className={styles.more}>+{players.length - shown.length}</span>}
          {screen && (
            <span className={`${styles.face} ${styles.screenFace}`}>
              <Tv size={14} aria-hidden="true" />
            </span>
          )}
          {players.length === 0 && !screen && <span className={styles.nobody}>{t('room.nobody')}</span>}
        </button>
        {open && (
          <div ref={panel} className={styles.panel} role="dialog" aria-label={t('room.title')}>
            <RoomPanel campaignId={campaignId} />
          </div>
        )}
      </span>
      <button
        type="button"
        className={paused ? `${styles.pause} ${styles.on}` : styles.pause}
        aria-pressed={paused}
        aria-label={paused ? t('room.resume') : t('room.pause')}
        title={paused ? t('room.resume') : t('room.pause')}
        disabled={controls.isPending}
        onClick={() => controls.mutate({ paused: !paused })}
      >
        {paused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
      </button>
      {extra}
    </div>
  )
}

/** Cambiar la pausa o el modo, y dejar la sala al día al momento */
function useControls(campaignId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: { paused?: boolean; movement?: Movement }) =>
      api.call('setTableControls', { campaignId, ...patch }),
    onSuccess: (data) => {
      queryClient.setQueryData(roomKey(campaignId), (old: ReturnType<typeof useRoom>['data']) =>
        old ? { ...old, ...data } : old
      )
      void queryClient.invalidateQueries({ queryKey: ['campaignTable', campaignId] })
    }
  })
}

/** La franja de la pausa, para que al máster no se le olvide quitarla */
export function PauseBanner({ campaignId, className }: { campaignId: string; className?: string }) {
  const { t } = useTranslation()
  const room = useRoom(campaignId)
  const controls = useControls(campaignId)
  if (!room.data?.paused) return null
  return (
    <div className={className ? `${styles.banner} ${className}` : styles.banner} role="status">
      <Pause size={14} aria-hidden="true" />
      <span>{t('room.paused')}</span>
      <button type="button" disabled={controls.isPending} onClick={() => controls.mutate({ paused: false })}>
        {t('room.unpause')}
      </button>
    </div>
  )
}

function RoomPanel({ campaignId }: { campaignId: string }) {
  const { t } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const queryClient = useQueryClient()
  const room = useRoom(campaignId)
  const controls = useControls(campaignId)
  const invitationTitle = useId()
  const refresh = () => queryClient.invalidateQueries({ queryKey: roomKey(campaignId) })
  const kick = useMutation({
    mutationFn: (userId: string) => api.call('kickFromTable', { campaignId, userId }),
    onSuccess: refresh
  })
  const back = useMutation({
    mutationFn: (userId: string) => api.call('allowBackToTable', { campaignId, userId }),
    onSuccess: refresh
  })
  const data = room.data
  if (!data) return null
  const atTable = data.present.filter((p) => p.viewer !== 'master')
  const movement = data.movement ?? 'free'
  const modes: { value: Movement; label: string }[] = [
    { value: 'free', label: t('room.free') },
    { value: 'turn', label: t('room.turn') },
    { value: 'locked', label: t('room.locked') }
  ]
  const error = kick.error ?? back.error ?? controls.error
  return (
    <>
      <h3 className={styles.h}>{t('room.atTable')}</h3>
      {atTable.length === 0 ? (
        <p className={styles.quiet}>{t('room.nobody')}</p>
      ) : (
        <ul className={styles.list}>
          {atTable.map((p) => (
            <Person key={`${p.userId}-${p.viewer}`} who={p} onKick={() => kick.mutate(p.userId)} />
          ))}
        </ul>
      )}
      {(data.inCampaign?.length ?? 0) > 0 && (
        <>
          <h3 className={styles.h}>{t('room.inCampaign')}</h3>
          <ul className={styles.list}>
            {data.inCampaign?.map((p) => (
              <li key={p.userId} className={styles.row}>
                <Avatar userId={p.userId} name={p.name} color={p.color} small />
                <span className={styles.who}>
                  <b>{p.name}</b>
                  <span>{t('room.notAtTable')}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {(data.kicked?.length ?? 0) > 0 && (
        <>
          <h3 className={styles.h}>{t('room.out')}</h3>
          <ul className={styles.list}>
            {data.kicked?.map((p) => (
              <li key={p.userId} className={styles.row}>
                <Avatar userId={p.userId} name={p.name} small />
                <span className={styles.who}>
                  <b>{p.name}</b>
                </span>
                <button
                  type="button"
                  className={styles.small}
                  disabled={back.isPending}
                  onClick={() => back.mutate(p.userId)}
                >
                  {t('room.allowBack')}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className={styles.controls}>
        <div className={styles.control}>
          <span id={`${invitationTitle}-moves`}>{t('room.moves')}</span>
          <div className={segmented.group}>
            {modes.map((mode) => (
              <button
                key={mode.value}
                type="button"
                aria-pressed={movement === mode.value}
                disabled={controls.isPending}
                onClick={() => controls.mutate({ movement: mode.value })}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <FormError message={error ? errorText(error) : null} />
      <RoomInvitation campaignId={campaignId} />
    </>
  )
}

function Person({ who, onKick }: { who: TablePresenceEntry; onKick: () => void }) {
  const { t } = useTranslation()
  const [menu, setMenu] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const close = useCallback(() => {
    setMenu(false)
    setConfirm(false)
  }, [])
  useDismiss(menu, close, box, button)
  const screen = who.viewer === 'screen'
  const status = [
    who.active ? t('room.visible') : t('room.away'),
    t('lobby.since', { time: time(who.since) }),
    who.tabs > 1 ? t('lobby.tabs', { count: who.tabs }) : ''
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <li className={styles.row}>
      {screen ? (
        <span className={`${styles.avatar} ${styles.avatarSmall} ${styles.screenFace}`} aria-hidden="true">
          <Tv size={13} />
        </span>
      ) : (
        <Avatar userId={who.userId} name={who.character?.name ?? who.name} color={who.color} small />
      )}
      <span className={styles.who}>
        <b>
          {screen ? t('room.screen') : (who.character?.name ?? who.name)}
          {!screen && who.character && <span className={styles.player}> · {who.name}</span>}
        </b>
        <span>{status}</span>
      </span>
      {!screen && (
        <span className={styles.menuWrap}>
          <button
            ref={button}
            type="button"
            className={styles.dots}
            aria-haspopup="menu"
            aria-expanded={menu}
            aria-label={t('room.actionsOf', { name: who.name })}
            onClick={() => setMenu(!menu)}
          >
            <MoreHorizontal size={16} aria-hidden="true" />
          </button>
          {menu && (
            <div ref={box} className={styles.menu} role="menu">
              {confirm ? (
                <div className={styles.confirm}>
                  <p>{t('room.kickConfirm', { name: who.name })}</p>
                  <button
                    type="button"
                    className={styles.danger}
                    onClick={() => {
                      close()
                      onKick()
                    }}
                  >
                    {t('room.kick')}
                  </button>
                </div>
              ) : (
                <button type="button" role="menuitem" className={styles.dangerItem} onClick={() => setConfirm(true)}>
                  <LogOut size={15} aria-hidden="true" />
                  {t('room.kick')}
                </button>
              )}
            </div>
          )}
        </span>
      )}
    </li>
  )
}

/** La invitación, compacta: el enlace con copiar, si está abierta y un enlace nuevo (con confirmación) */
function RoomInvitation({ campaignId }: { campaignId: string }) {
  const { t } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const queryClient = useQueryClient()
  const key = ['invitation', campaignId]
  const invitation = useQuery({ queryKey: key, queryFn: () => api.call('getInvitation', { campaignId }) })
  const update = (data: Awaited<ReturnType<typeof api.call<'getInvitation'>>>) => queryClient.setQueryData(key, data)
  const [confirming, setConfirming] = useState(false)
  const [copied, setCopied] = useState(false)
  const field = useRef<HTMLInputElement>(null)
  const regenerate = useMutation({
    mutationFn: () => api.call('regenerateInvitation', { campaignId }),
    onSuccess: (data) => {
      update(data)
      setConfirming(false)
    }
  })
  const setOpen = useMutation({
    mutationFn: (open: boolean) => api.call('setInvitationsOpen', { campaignId, open }),
    onSuccess: update
  })
  const data = invitation.data
  if (!data) return <FormError message={invitation.error ? errorText(invitation.error) : null} />
  const copy = async () => {
    if (!data.url) return
    try {
      await navigator.clipboard.writeText(data.url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      field.current?.select()
    }
  }
  const error = regenerate.error ?? setOpen.error
  return (
    <div className={styles.invitation}>
      <label className={styles.control}>
        <span>{t('invitation.title')}</span>
        <input
          type="checkbox"
          role="switch"
          className={`${styles.switch} ${styles.switchOn}`}
          checked={data.open}
          aria-checked={data.open}
          disabled={setOpen.isPending}
          onChange={(event) => setOpen.mutate(event.currentTarget.checked)}
        />
      </label>
      {data.url ? (
        <div className={styles.link}>
          <input
            ref={field}
            readOnly
            value={data.url}
            aria-label={t('invitation.link')}
            onFocus={(e) => e.currentTarget.select()}
          />
          <button
            type="button"
            className={styles.icon}
            aria-label={copied ? t('invitation.copied') : t('invitation.copy')}
            title={copied ? t('invitation.copied') : t('invitation.copy')}
            onClick={() => void copy()}
          >
            {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
          </button>
          <button
            type="button"
            className={styles.small}
            onClick={() => setConfirming(true)}
            disabled={regenerate.isPending}
          >
            <RefreshCw size={14} aria-hidden="true" />
            {t('invitation.regenerate')}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={styles.small}
          onClick={() => regenerate.mutate()}
          disabled={regenerate.isPending}
        >
          {t('invitation.create')}
        </button>
      )}
      {confirming && (
        <div className={styles.confirmRow} role="alert">
          <span>{t('invitation.warning')}</span>
          <button
            type="button"
            className={styles.small}
            onClick={() => regenerate.mutate()}
            disabled={regenerate.isPending}
          >
            {t('invitation.confirm')}
          </button>
          <button type="button" className={styles.small} onClick={() => setConfirming(false)}>
            {t('list.cancel')}
          </button>
        </div>
      )}
      <FormError message={error ? errorText(error) : null} />
    </div>
  )
}

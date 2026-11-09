/**
 * Los ajustes de una campaña, en su pestaña de la Mesa (lienzo «Campaña en la Mesa»): su tarjeta, quién juega en ella
 * (el máster expulsa), el enlace de invitación y, en la zona de peligro, dejarla (quien juega) o borrarla (el máster)
 */
import type { Campaign, Member } from '@crisol/contracts'
import { TRASH_DAYS } from '@crisol/domain'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import { CopyField } from '../components/copy-field.tsx'
import { ConfirmByName, DangerZone } from '../components/danger.tsx'
import { FormError } from '../components/field.tsx'
import { Floating } from '../components/floating.tsx'
import { focusAfterRemoving, focusOnMount, useReturnFocus } from '../components/focus.ts'
import form from '../components/form.module.css'
import styles from '../components/list.module.css'
import { failed } from '../components/load-error.tsx'
import { RemovedMessage, RemoveMemberConfirm, useRemoveMember } from '../components/remove-member.tsx'
import { coverStyle } from '../wiki/cover-look.ts'
import settings from './settings.module.css'

export function MembersPanel({ campaign }: { campaign: Campaign }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const errorText = useErrorText()
  const announce = useAnnounce()
  const campaignId = campaign.id
  const key = ['members', campaignId]
  const members = useQuery({ queryKey: key, queryFn: () => api.call('listMembers', { campaignId }) })
  const [confirmingRemove, setConfirmingRemove] = useState<string | null>(null)
  const [removed, setRemoved] = useState<{ name: string; linkFailed: boolean } | null>(null)
  const [confirmingLeave, setConfirmingLeave] = useState(false)
  const leaveButton = useReturnFocus()
  const leaveWarningId = useId()
  const remove = useRemoveMember(campaignId)
  const leave = useMutation({
    mutationFn: () => api.call('leaveCampaign', { campaignId }),
    // Primero fuera de la campaña: refrescar aquí pediría lo que ya no ve
    onSuccess: async () => {
      await navigate({ to: '/mundos' })
      queryClient.removeQueries({ queryKey: ['members', campaignId] })
      queryClient.removeQueries({ queryKey: ['campaigns', campaign.worldId] })
      await queryClient.invalidateQueries({ queryKey: ['worlds'] })
      await queryClient.invalidateQueries({ queryKey: ['organizations'] })
    }
  })

  if (!members.data) return <FormError message={failed(members) ? errorText(members.error) : null} />
  const canRemove = campaign.role === 'master'
  const error = remove.error ?? leave.error

  return (
    <>
      <section aria-labelledby="miembros" data-tour="campana-miembros">
        <h2 id="miembros">{t('members.title')}</h2>
        <ul className={styles.list} aria-labelledby="miembros">
          {members.data.members.map((member) => (
            <MemberItem
              key={member.userId}
              member={member}
              removable={canRemove && member.role === 'player'}
              confirming={confirmingRemove === member.userId}
              busy={remove.isPending}
              onStart={() => {
                setConfirmingRemove(member.userId)
                setRemoved(null)
              }}
              onCancel={() => setConfirmingRemove(null)}
              onRemove={(newLink, refocus) =>
                remove.mutate(
                  { userId: member.userId, newLink },
                  {
                    onSuccess: ({ linkFailed }) => {
                      setConfirmingRemove(null)
                      setRemoved({ name: member.name, linkFailed })
                      // Si el enlace no cambió, lo dice el aviso (alert)
                      if (!linkFailed) announce(t('members.removed', { name: member.name }))
                      refocus()
                    }
                  }
                )
              }
            />
          ))}
        </ul>
        {removed && (
          <p>
            <RemovedMessage {...removed} />
          </p>
        )}

        <FormError message={error ? errorText(error) : null} />
      </section>
      {/* Dejarla, en su zona de peligro al final (docs/diseno.md) */}
      {campaign.role === 'player' && (
        <DangerZone>
          {confirmingLeave ? (
            <div>
              <p id={leaveWarningId}>{t('members.leaveWarning')}</p>
              <div className={styles.actions}>
                <BusyButton
                  ref={focusOnMount}
                  className={form.button}
                  aria-describedby={leaveWarningId}
                  busy={leave.isPending}
                  onClick={() => leave.mutate()}
                >
                  {t('members.leaveConfirm')}
                </BusyButton>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => {
                    leaveButton.back()
                    setConfirmingLeave(false)
                  }}
                >
                  {t('list.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              ref={leaveButton.ref}
              className={styles.secondary}
              onClick={() => setConfirmingLeave(true)}
            >
              {t('members.leave')}
            </button>
          )}
        </DangerZone>
      )}
    </>
  )
}

/** Un miembro: al abrir la confirmación de expulsar, el foco va a ella; al cancelar, vuelve a «Expulsar» */
function MemberItem(props: {
  member: Member
  removable: boolean
  confirming: boolean
  busy: boolean
  onStart(): void
  onCancel(): void
  /** refocus: con qué dejar el foco en el siguiente cuando ya no esté */
  onRemove(newLink: boolean, refocus: () => void): void
}) {
  const { t } = useTranslation()
  const { member } = props
  const item = useRef<HTMLLIElement>(null)
  const opener = useReturnFocus()
  return (
    <li ref={item} className={styles.item}>
      <span className={`${styles.name} ${styles.entity}`}>{member.name}</span>
      <span className={`${styles.role} ${styles.tag}`}>{t(`roles.${member.role}`)}</span>
      {props.removable && !props.confirming && (
        <button
          type="button"
          ref={opener.ref}
          className={styles.secondary}
          aria-label={t('members.removeButton', { name: member.name })}
          onClick={props.onStart}
        >
          {t('members.remove')}
        </button>
      )}
      {props.confirming && (
        <RemoveMemberConfirm
          name={member.name}
          pending={props.busy}
          onConfirm={(newLink) => props.onRemove(newLink, focusAfterRemoving(item.current))}
          onCancel={() => {
            opener.back()
            props.onCancel()
          }}
        />
      )}
    </li>
  )
}

export function InvitationPanel({ campaignId, titleId }: { campaignId: string; titleId: string }) {
  const { t, i18n } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const [confirming, setConfirming] = useState(false)
  // El botón se queda a la vista mientras se confirma (la confirmación flota): al cerrarla, el foco vuelve a él
  const regenerateButton = useRef<HTMLButtonElement>(null)
  const backToButton = () => regenerateButton.current?.focus()
  const warningId = useId()
  const key = ['invitation', campaignId]
  const invitation = useQuery({ queryKey: key, queryFn: () => api.call('getInvitation', { campaignId }) })
  const update = (data: Awaited<ReturnType<typeof api.call<'getInvitation'>>>) => queryClient.setQueryData(key, data)
  const regenerate = useMutation({
    mutationFn: () => api.call('regenerateInvitation', { campaignId }),
    onSuccess: (data) => {
      update(data)
      // Desde la confirmación: se cierra y el foco vuelve a «Nuevo enlace»
      if (confirming) backToButton()
      setConfirming(false)
    }
  })
  // Optimista: la casilla cambia en el mismo clic (estado local) y vuelve atrás si el servidor falla
  const [pendingOpen, setPendingOpen] = useState<boolean | null>(null)
  const setOpen = useMutation({
    mutationFn: (open: boolean) => api.call('setInvitationsOpen', { campaignId, open }),
    onSuccess: (data) => {
      update(data)
      setPendingOpen(null)
    },
    onError: () => setPendingOpen(null)
  })

  if (!invitation.data) return <FormError message={failed(invitation) ? errorText(invitation.error) : null} />
  const { url, issuedAt, joins } = invitation.data
  const open = pendingOpen ?? invitation.data.open
  const error = regenerate.error ?? setOpen.error

  return (
    <div className={styles.invitation}>
      <h2 id={titleId}>{t('invitation.title')}</h2>
      {url ? (
        <>
          <CopyField label={t('invitation.link')} value={url} />
          {issuedAt && (
            <p className={styles.role}>
              {t('invitation.issued', {
                date: new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long' }).format(new Date(issuedAt))
              })}
            </p>
          )}
          <p className={styles.role}>{t('invitation.joins', { count: joins })}</p>
        </>
      ) : (
        <p>{t('invitation.none')}</p>
      )}

      {/* La confirmación flota bajo el botón, sin empujar la página (docs/diseno.md: los desplegables flotan) */}
      <div className={styles.anchor}>
        <BusyButton
          ref={regenerateButton}
          className={styles.secondary}
          busy={regenerate.isPending && !confirming}
          aria-expanded={url ? confirming : undefined}
          onClick={() => (url ? setConfirming(!confirming) : regenerate.mutate())}
        >
          {url ? t('invitation.regenerate') : t('invitation.create')}
        </BusyButton>
        {confirming && (
          <Floating
            anchor={regenerateButton}
            role="dialog"
            aria-labelledby={warningId}
            className={styles.floating}
            onKeyDown={(event) => {
              if (event.key !== 'Escape') return
              event.stopPropagation()
              backToButton()
              setConfirming(false)
            }}
          >
            <p id={warningId}>{t('invitation.warning')}</p>
            <div className={styles.actions}>
              <BusyButton
                ref={focusOnMount}
                className={form.button}
                aria-describedby={warningId}
                busy={regenerate.isPending}
                onClick={() => regenerate.mutate()}
              >
                {t('invitation.confirm')}
              </BusyButton>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => {
                  backToButton()
                  setConfirming(false)
                }}
              >
                {t('list.cancel')}
              </button>
            </div>
          </Floating>
        )}
      </div>

      {url && (
        <p>
          <label>
            <input
              type="checkbox"
              checked={open}
              onChange={(event) => {
                // Mientras se guarda, se ignora: deshabilitarla sacaría el foco de la casilla
                if (setOpen.isPending) return
                const value = event.currentTarget.checked
                setPendingOpen(value)
                setOpen.mutate(value)
              }}
            />{' '}
            {t('invitation.open')}
          </label>
        </p>
      )}
      {url && !open && <p>{t('invitation.closed')}</p>}
      <FormError message={error ? errorText(error) : null} />
    </div>
  )
}

/**
 * La pestaña Ajustes de la Mesa: la campaña (su portada, de qué mundo y con qué sistema), quién juega, invitar (el
 * enlace, a la vista) y, para el máster, borrarla escribiendo su nombre
 */
export function CampaignSettings({ campaign, worldName }: { campaign: Campaign; worldName: string }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const inviteTitle = useId()
  const remove = async () => {
    await api.call('deleteCampaign', { campaignId: campaign.id })
    await navigate({ to: '/mundos/$worldId', params: { worldId: campaign.worldId } })
    queryClient.removeQueries({ queryKey: ['members', campaign.id] })
    await queryClient.invalidateQueries({ queryKey: ['campaigns'] })
  }
  return (
    <div className={settings.root}>
      <section className={settings.card} aria-label={campaign.name}>
        {campaign.cover ? (
          <img
            className={settings.cover}
            src={`/api/files/${campaign.cover.fileId}`}
            alt=""
            style={coverStyle(campaign.cover)}
          />
        ) : (
          <span className={settings.cover} aria-hidden="true" />
        )}
        <div className={settings.name}>
          <b>{campaign.name}</b>
          <span>{[worldName, campaign.system?.name].filter(Boolean).join(' · ')}</span>
        </div>
      </section>
      <PlayersSummary campaign={campaign} />
      <MembersPanel campaign={campaign} />
      {campaign.role === 'master' && (
        <section className={settings.invite}>
          <InvitationPanel campaignId={campaign.id} titleId={inviteTitle} />
        </section>
      )}
      {campaign.role === 'master' && (
        <DangerZone>
          <ConfirmByName
            name={campaign.name}
            action={t('campaigns.delete')}
            title={t('campaigns.deleteTitle', { name: campaign.name })}
            warning={t('campaigns.deleteWarning', { days: TRASH_DAYS })}
            label={t('campaigns.name')}
            onConfirm={remove}
          />
        </DangerZone>
      )}
    </div>
  )
}

const SMALL = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'a'])

/** El nombre de una cifra, corto: una palabra, tal cual; varias, sus iniciales («Clase de armadura» → «CA») */
export function shortLabel(label: string): string {
  const words = label.split(/\s+/).filter((w) => w && !SMALL.has(w.toLocaleLowerCase('es')))
  if (words.length <= 1) return label
  return words.map((w) => w.charAt(0).toLocaleUpperCase('es')).join('')
}

/**
 * Los jugadores de un vistazo (la pestaña Campaña): cada personaje con quién lo lleva, su clase y sus cifras; y quién
 * aún no tiene personaje
 */
function PlayersSummary({ campaign }: { campaign: Campaign }) {
  const { t } = useTranslation()
  const api = useApi()
  const headingId = useId()
  const characters = useQuery({
    queryKey: ['characters', campaign.id],
    queryFn: () => api.call('listCharacters', { campaignId: campaign.id }),
    enabled: Boolean(campaign.system)
  })
  const members = useQuery({
    queryKey: ['members', campaign.id],
    queryFn: () => api.call('listMembers', { campaignId: campaign.id })
  })
  const all = characters.data?.characters ?? []
  const withCharacter = new Set(all.map((c) => c.owner?.id).filter(Boolean))
  const without = (members.data?.members ?? []).filter((m) => m.role === 'player' && !withCharacter.has(m.userId))
  return (
    // biome-ignore lint/a11y/useSemanticElements: una <section> llevaría el marco de las secciones de la página
    <div role="region" className={settings.players} aria-labelledby={headingId}>
      <h2 id={headingId}>{t('campaignHome.players')}</h2>
      {all.length === 0 && without.length === 0 ? (
        <p className={settings.muted}>{t('campaignHome.noPlayers')}</p>
      ) : (
        <ul className={settings.playerList}>
          {all.map((character) => (
            <li key={character.id} className={settings.player}>
              <span className={settings.initial} aria-hidden="true">
                {character.name.charAt(0).toLocaleUpperCase('es')}
              </span>
              <div className={settings.who}>
                <b>{character.name}</b>
                <span>
                  {[
                    character.summary.line,
                    character.owner?.name,
                    character.status === 'creating' ? t('campaignHome.creating') : null
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                {(character.summary.stats ?? []).length > 0 && (
                  <dl className={settings.stats}>
                    {(character.summary.stats ?? []).slice(0, 3).map((stat) => (
                      <div key={stat.key} title={stat.label}>
                        <dt>
                          <abbr title={stat.label}>{shortLabel(stat.label)}</abbr>
                        </dt>
                        <dd>{stat.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </li>
          ))}
          {without.map((member) => (
            <li key={member.userId} className={settings.player} data-empty="">
              <span className={settings.initial} aria-hidden="true">
                {member.name.charAt(0).toLocaleUpperCase('es')}
              </span>
              <div className={settings.who}>
                <b>{member.name}</b>
                <span>{t('campaignHome.noCharacter')}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

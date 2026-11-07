import type { Campaign, Member } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, Navigate, useNavigate } from '@tanstack/react-router'
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { Banner, type Stat } from '../components/banner.tsx'
import { Loading } from '../components/brand.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import { CopyField } from '../components/copy-field.tsx'
import { FormError } from '../components/field.tsx'
import { focusAfterRemoving, focusOnMount, useReturnFocus } from '../components/focus.ts'
import form from '../components/form.module.css'
import styles from '../components/list.module.css'
import { failed, LoadError } from '../components/load-error.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { RemovedMessage, RemoveMemberConfirm, useRemoveMember } from '../components/remove-member.tsx'
import { Tour } from '../components/tour.tsx'

const route = getRouteApi('/mundos/$worldId/campanas/$campaignId')

/** Una campaña: quién está en ella y, para su máster, el enlace de invitación */
export function CampaignPage() {
  const { t } = useTranslation()
  const { worldId, campaignId } = route.useParams()
  const api = useApi()
  const { account, pending } = useAccounts().useAccount()
  const worlds = useQuery({
    queryKey: ['worlds'],
    queryFn: () => api.call('listWorlds', {}),
    enabled: Boolean(account)
  })
  const world = worlds.data?.worlds.find((w) => w.id === worldId)
  const campaigns = useQuery({
    queryKey: ['campaigns', worldId],
    queryFn: () => api.call('listCampaigns', { worldId }),
    enabled: Boolean(world)
  })
  const campaign = campaigns.data?.campaigns.find((c) => c.id === campaignId)

  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  // Sin las listas no se sabe si existe: mientras llegan, la carga; si fallan, el error (no «no existe»)
  if (!worlds.data)
    return failed(worlds) ? <LoadError error={worlds.error} onRetry={() => worlds.refetch()} /> : <Loading />
  if (world && !campaigns.data) {
    return failed(campaigns) ? <LoadError error={campaigns.error} onRetry={() => campaigns.refetch()} /> : <Loading />
  }
  if (!world || !campaign) {
    return (
      <section>
        <PageTitle>{t('campaign.notFound')}</PageTitle>
        <Link to="/mundos">{t('worlds.title')}</Link>
      </section>
    )
  }

  return (
    <section>
      <CampaignBanner campaign={campaign} worldName={world.name} />
      <MembersPanel campaign={campaign} />
      {campaign.role === 'master' && <InvitationPanel campaignId={campaignId} />}
      <Tour
        id="campana"
        // Un paso por cada botón de la barra de la campaña
        steps={[
          { target: '[data-tour="barra-campana"]', text: t('tour.campaign.home'), placement: 'right' },
          { target: '[data-tour="barra-paginas"]', text: t('tour.campaign.pages'), placement: 'right' },
          { target: '[data-tour="barra-personajes"]', text: t('tour.campaign.characters'), placement: 'right' },
          { target: '[data-tour="barra-compendio"]', text: t('tour.campaign.compendium'), placement: 'right' },
          { target: '[data-tour="barra-grupo"]', text: t('tour.campaign.party'), placement: 'right' },
          ...(campaign.role === 'master'
            ? [
                {
                  target: '[data-tour="barra-en-juego"]',
                  text: t('tour.campaign.inPlay'),
                  placement: 'right' as const
                },
                {
                  target: '[data-tour="barra-mesa"]',
                  text: t('tour.campaign.table'),
                  placement: 'right' as const
                },
                {
                  target: '[data-tour="barra-revelado"]',
                  text: t('tour.campaign.revealed'),
                  placement: 'right' as const
                },
                {
                  target: '[data-tour="barra-biblioteca"]',
                  text: t('tour.campaign.library'),
                  placement: 'right' as const
                }
              ]
            : []),
          { target: '[data-tour="barra-dados"]', text: t('tour.world.dice'), placement: 'right' },
          { target: '[data-tour="barra-llama"]', text: t('tour.world.back'), placement: 'right' },
          { target: '[data-tour="menu-movil"]', text: t('tour.menu') }
        ]}
      />
    </section>
  )
}

/** La franja: de qué mundo es, tu papel, cuántos juegan y, para el máster, cuántos han entrado con el enlace */
function CampaignBanner({ campaign, worldName }: { campaign: Campaign; worldName: string }) {
  const { t } = useTranslation()
  const api = useApi()
  const campaignId = campaign.id
  const master = campaign.role === 'master'
  // Las mismas consultas que los paneles de abajo: comparten caché y se piden una vez
  const members = useQuery({
    queryKey: ['members', campaignId],
    queryFn: () => api.call('listMembers', { campaignId })
  })
  const invitation = useQuery({
    queryKey: ['invitation', campaignId],
    queryFn: () => api.call('getInvitation', { campaignId }),
    enabled: master
  })
  const stats: Stat[] = []
  if (members.data) {
    const players = members.data.members.filter((member) => member.role === 'player').length
    stats.push({ label: t('campaign.players'), value: players })
  }
  if (master && invitation.data) stats.push({ label: t('campaign.joined'), value: invitation.data.joins })
  return (
    <Banner
      crumb={
        <Link to="/mundos/$worldId" params={{ worldId: campaign.worldId }}>
          {worldName}
        </Link>
      }
      title={campaign.name}
      detail={t(master ? 'campaign.asMaster' : 'campaign.asPlayer', { world: worldName })}
      stats={stats}
    />
  )
}

function MembersPanel({ campaign }: { campaign: Campaign }) {
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
    <section aria-labelledby="miembros">
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

      {campaign.role === 'player' &&
        (confirmingLeave ? (
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
        ))}
      <FormError message={error ? errorText(error) : null} />
    </section>
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

function InvitationPanel({ campaignId }: { campaignId: string }) {
  const { t, i18n } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const [confirming, setConfirming] = useState(false)
  const regenerateButton = useReturnFocus()
  const warningId = useId()
  const key = ['invitation', campaignId]
  const invitation = useQuery({ queryKey: key, queryFn: () => api.call('getInvitation', { campaignId }) })
  const update = (data: Awaited<ReturnType<typeof api.call<'getInvitation'>>>) => queryClient.setQueryData(key, data)
  const regenerate = useMutation({
    mutationFn: () => api.call('regenerateInvitation', { campaignId }),
    onSuccess: (data) => {
      update(data)
      // Desde la confirmación: se cierra y el foco vuelve a «Nuevo enlace»
      if (confirming) regenerateButton.back()
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
    <section aria-labelledby="invitacion">
      <h2 id="invitacion">{t('invitation.title')}</h2>
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

      {confirming ? (
        <div>
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
                regenerateButton.back()
                setConfirming(false)
              }}
            >
              {t('list.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <BusyButton
          ref={regenerateButton.ref}
          className={styles.secondary}
          busy={regenerate.isPending}
          onClick={() => (url ? setConfirming(true) : regenerate.mutate())}
        >
          {url ? t('invitation.regenerate') : t('invitation.create')}
        </BusyButton>
      )}

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
    </section>
  )
}

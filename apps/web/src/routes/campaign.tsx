import type { Campaign, Member } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, Navigate, useNavigate } from '@tanstack/react-router'
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { Loading } from '../components/brand.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import { CopyField } from '../components/copy-field.tsx'
import { DangerZone } from '../components/danger.tsx'
import { FormError } from '../components/field.tsx'
import { focusAfterRemoving, focusOnMount, useReturnFocus } from '../components/focus.ts'
import form from '../components/form.module.css'
import styles from '../components/list.module.css'
import { failed, LoadError, SectionError } from '../components/load-error.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { RemovedMessage, RemoveMemberConfirm, useRemoveMember } from '../components/remove-member.tsx'
import screen from '../components/screen.module.css'
import { Screen } from '../components/screen.tsx'
import { Tour } from '../components/tour.tsx'
import { coverStyle } from '../wiki/cover-look.ts'

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
    <Screen title={campaign.name}>
      {/* Su portada (la de su tarjeta), como franja bajo el título: el título no se mueve */}
      {campaign.cover && (
        <div className={screen.cover}>
          <img src={`/api/files/${campaign.cover.fileId}`} alt="" style={coverStyle(campaign.cover)} />
        </div>
      )}
      <CharactersPanel campaign={campaign} />
      <MembersPanel campaign={campaign} />
      {campaign.role === 'master' && <InvitationPanel campaignId={campaignId} />}
      <Tour
        id="campana"
        // Un paso por cada botón de la barra de la campaña
        steps={[
          // En el móvil no hay barra: el paso señala la campaña en la página
          {
            target: '[data-tour="barra-campana"], [data-tour="campana-miembros"]',
            text: t('tour.campaign.home'),
            placement: 'right'
          },
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
          { target: '[data-tour="dados"]', text: t('tour.world.dice'), placement: 'top' },
          { target: '[data-tour="barra-llama"]', text: t('tour.world.back'), placement: 'right' },
          { target: '[data-tour="menu-movil"]', text: t('tour.menu') }
        ]}
      />
    </Screen>
  )
}

/**
 * Los personajes de la campaña: los tuyos (o todos, el máster), que se abren, y los de tus aliados, que se ven pero no
 * se abren (Enrique, 2026-11-08: «puede ver a sus aliados aunque no pueda entrar en ellos»)
 */
function CharactersPanel({ campaign }: { campaign: Campaign }) {
  const { t } = useTranslation()
  const api = useApi()
  const characters = useQuery({
    queryKey: ['characters', campaign.id],
    queryFn: () => api.call('listCharacters', { campaignId: campaign.id }),
    enabled: Boolean(campaign.system)
  })
  if (!campaign.system) return null
  if (!characters.data)
    return failed(characters) ? <SectionError error={characters.error} onRetry={() => characters.refetch()} /> : null
  const own = characters.data.characters
  const allies = characters.data.allies ?? []
  if (own.length === 0 && allies.length === 0) return null
  const who = (owner: { name: string } | null, line?: string) => [line, owner?.name].filter(Boolean).join(' · ')
  return (
    <section aria-labelledby="personajes-campana">
      <h2 id="personajes-campana">{t('characters.title')}</h2>
      <ul className={styles.list} aria-labelledby="personajes-campana">
        {own.map((character) => (
          <li key={character.id} className={styles.item}>
            <Link
              to="/mundos/$worldId/campanas/$campaignId/personajes/$characterId"
              params={{ worldId: campaign.worldId, campaignId: campaign.id, characterId: character.id }}
              className={`${styles.name} ${styles.entity} ${styles.opens}`}
            >
              {character.name}
            </Link>
            <span className={styles.role}>{who(character.owner, character.summary.line)}</span>
          </li>
        ))}
        {allies.map((ally) => (
          <li key={ally.id} className={styles.item}>
            <span className={`${styles.name} ${styles.entity}`}>{ally.name}</span>
            <span className={styles.role}>{who(ally.owner, ally.line)}</span>
          </li>
        ))}
      </ul>
    </section>
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

function InvitationPanel({ campaignId }: { campaignId: string }) {
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
          <div
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
          </div>
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
    </section>
  )
}

import type { Campaign } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, Navigate, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { FormError } from '../components/field.tsx'
import form from '../components/form.module.css'
import styles from '../components/list.module.css'

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
  if (worlds.isPending || (world && campaigns.isPending)) return null
  if (!world || !campaign) {
    return (
      <section>
        <h1>{t('campaign.notFound')}</h1>
        <Link to="/mundos">{t('worlds.title')}</Link>
      </section>
    )
  }

  return (
    <section>
      <p>
        <Link to="/mundos/$worldId" params={{ worldId }}>
          {world.name}
        </Link>
      </p>
      <h1>{campaign.name}</h1>
      <MembersPanel campaign={campaign} />
      {campaign.role === 'master' && <InvitationPanel campaignId={campaignId} />}
    </section>
  )
}

function MembersPanel({ campaign }: { campaign: Campaign }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const errorText = useErrorText()
  const campaignId = campaign.id
  const key = ['members', campaignId]
  const members = useQuery({ queryKey: key, queryFn: () => api.call('listMembers', { campaignId }) })
  const [confirmingRemove, setConfirmingRemove] = useState<string | null>(null)
  const [removedName, setRemovedName] = useState<string | null>(null)
  const [confirmingLeave, setConfirmingLeave] = useState(false)
  const remove = useMutation({
    mutationFn: async ({ userId, newLink }: { userId: string; name: string; newLink: boolean }) => {
      queryClient.setQueryData(key, await api.call('removeMember', { campaignId, userId }))
      if (newLink) {
        queryClient.setQueryData(['invitation', campaignId], await api.call('regenerateInvitation', { campaignId }))
      }
    },
    onSuccess: (_, { name }) => {
      setConfirmingRemove(null)
      setRemovedName(name)
    }
  })
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

  if (!members.data) return null
  const canRemove = campaign.role === 'master'
  const error = remove.error ?? leave.error

  return (
    <section aria-labelledby="miembros">
      <h2 id="miembros">{t('members.title')}</h2>
      <ul className={styles.list} aria-labelledby="miembros">
        {members.data.members.map((member) => (
          <li key={member.userId} className={styles.item}>
            <span className={styles.name}>{member.name}</span>
            <span className={styles.role}>{t(`roles.${member.role}`)}</span>
            {canRemove && member.role === 'player' && confirmingRemove !== member.userId && (
              <button
                type="button"
                className={styles.secondary}
                aria-label={t('members.removeButton', { name: member.name })}
                onClick={() => {
                  setConfirmingRemove(member.userId)
                  setRemovedName(null)
                }}
              >
                {t('members.remove')}
              </button>
            )}
            {confirmingRemove === member.userId && (
              <div className={styles.confirm}>
                <p>{t('members.removeWarning', { name: member.name })}</p>
                <div className={styles.actions}>
                  {[false, true].map((newLink) => (
                    <button
                      key={String(newLink)}
                      type="button"
                      className={newLink ? styles.secondary : form.button}
                      disabled={remove.isPending}
                      onClick={() => remove.mutate({ userId: member.userId, name: member.name, newLink })}
                    >
                      {newLink ? t('members.removeAndRegenerate') : t('members.removeConfirm')}
                    </button>
                  ))}
                  <button type="button" className={styles.secondary} onClick={() => setConfirmingRemove(null)}>
                    {t('list.cancel')}
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {removedName && <p role="status">{t('members.removed', { name: removedName })}</p>}

      {campaign.role === 'player' &&
        (confirmingLeave ? (
          <div>
            <p>{t('members.leaveWarning')}</p>
            <div className={styles.actions}>
              <button type="button" className={form.button} disabled={leave.isPending} onClick={() => leave.mutate()}>
                {t('members.leaveConfirm')}
              </button>
              <button type="button" className={styles.secondary} onClick={() => setConfirmingLeave(false)}>
                {t('list.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className={styles.secondary} onClick={() => setConfirmingLeave(true)}>
            {t('members.leave')}
          </button>
        ))}
      <FormError message={error ? errorText(error) : null} />
    </section>
  )
}

function InvitationPanel({ campaignId }: { campaignId: string }) {
  const { t, i18n } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const [confirming, setConfirming] = useState(false)
  const [copied, setCopied] = useState(false)
  const key = ['invitation', campaignId]
  const invitation = useQuery({ queryKey: key, queryFn: () => api.call('getInvitation', { campaignId }) })
  const update = (data: Awaited<ReturnType<typeof api.call<'getInvitation'>>>) => queryClient.setQueryData(key, data)
  const regenerate = useMutation({
    mutationFn: () => api.call('regenerateInvitation', { campaignId }),
    onSuccess: (data) => {
      update(data)
      setConfirming(false)
      setCopied(false)
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

  if (!invitation.data) return null
  const { url, issuedAt, joins } = invitation.data
  const open = pendingOpen ?? invitation.data.open
  const error = regenerate.error ?? setOpen.error

  return (
    <section aria-labelledby="invitacion">
      <h2 id="invitacion">{t('invitation.title')}</h2>
      {url ? (
        <>
          <div className={styles.actions}>
            <label className={styles.linkField}>
              <span>{t('invitation.link')}</span>
              <input readOnly value={url} onFocus={(event) => event.currentTarget.select()} />
            </label>
            <button
              type="button"
              className={form.button}
              onClick={async () => {
                await navigator.clipboard.writeText(url)
                setCopied(true)
              }}
            >
              {t('invitation.copy')}
            </button>
          </div>
          {copied && <p role="status">{t('invitation.copied')}</p>}
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
          <p>{t('invitation.warning')}</p>
          <div className={styles.actions}>
            <button
              type="button"
              className={form.button}
              disabled={regenerate.isPending}
              onClick={() => regenerate.mutate()}
            >
              {t('invitation.confirm')}
            </button>
            <button type="button" className={styles.secondary} onClick={() => setConfirming(false)}>
              {t('list.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={styles.secondary}
          onClick={() => (url ? setConfirming(true) : regenerate.mutate())}
        >
          {url ? t('invitation.regenerate') : t('invitation.create')}
        </button>
      )}

      {url && (
        <p>
          <label>
            <input
              type="checkbox"
              checked={open}
              disabled={setOpen.isPending}
              onChange={(event) => {
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

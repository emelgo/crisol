import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, Navigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { FormError } from '../components/field.tsx'
import form from '../components/form.module.css'
import styles from '../components/list.module.css'

const route = getRouteApi('/mundos/$worldId/campanas/$campaignId')

/** Una campaña: de momento, su enlace de invitación (para su máster). Los miembros llegan con la tarea 16 */
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
      {campaign.role === 'master' && <InvitationPanel campaignId={campaignId} />}
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

import { useQuery } from '@tanstack/react-query'
import { useLocation } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { Loading } from '../components/brand.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import { FormError } from '../components/field.tsx'
import form from '../components/form.module.css'
import frame from '../components/frame.module.css'
import styles from '../components/list.module.css'
import { PageTitle } from '../components/page-title.tsx'

/**
 * Cómo se presenta la aplicación que pide conectarse. Su nombre lo pone quien publica sus metadatos: si el cliente es
 * una URL (CIMD, como claude.ai), va siempre con su dominio, que no se puede falsear («Claude (claude.ai)»); sin
 * nombre, solo el dominio. Si no es una URL (un cliente que registró el propietario), su nombre o el identificador
 */
export function clientLabel(clientId: string, name: string | null) {
  const host = URL.canParse(clientId) ? new URL(clientId).hostname : null
  if (!host) return name || clientId
  return name && name !== host ? `${name} (${host})` : host
}

/**
 * Consentimiento OAuth: una aplicación (claude.ai) quiere usar la cuenta. Aquí llega desde /api/auth/oauth2/authorize,
 * con la consulta firmada en la URL, que el cliente de cuentas reenvía al permitir o no.
 */
export function Consent() {
  const { t } = useTranslation()
  const accounts = useAccounts()
  const api = useApi()
  const { account, pending } = accounts.useAccount()
  // La consulta tal cual llegó: lleva la firma de Better Auth
  const clientId = new URLSearchParams(useLocation().searchStr).get('client_id') ?? ''
  const name = useQuery({ queryKey: ['oauth-client', clientId], queryFn: () => accounts.oauthClientName(clientId) })
  const organizations = useQuery({
    queryKey: ['organizations'],
    queryFn: () => api.call('listOrganizations', {}),
    enabled: Boolean(account)
  })
  // Quien juega en alguna campaña también puede (su IA solo lee, ADR-0017)
  const worlds = useQuery({
    queryKey: ['worlds', 'campaigns'],
    queryFn: () => api.call('listWorldsWithCampaigns', {}),
    enabled: Boolean(account)
  })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (pending) return null
  if (!account) {
    // Sin sesión aquí: caducó durante la autorización. La consulta firmada no sirve fuera de este flujo
    return (
      <section>
        <PageTitle>{t('consent.expiredTitle')}</PageTitle>
        <p>{t('consent.expiredBody')}</p>
      </section>
    )
  }
  if (name.isPending || organizations.isPending || worlds.isPending) return <Loading />
  const client = clientLabel(clientId, name.data ?? null)
  const isOwner =
    (organizations.data?.organizations.some((o) => o.role === 'owner') ?? false) ||
    (worlds.data?.worlds.some((w) => w.campaigns.length > 0) ?? false)

  const answer = async (accept: boolean) => {
    setBusy(true)
    const result = await accounts.consent(accept)
    setBusy(false)
    if (!result.ok) setError(t(`errors.${result.code}`, { defaultValue: t('errors.UNKNOWN') }))
  }

  return (
    <section>
      <PageTitle>{t('consent.title', { client })}</PageTitle>
      <div className={frame.box}>
        <p>{t('consent.body', { client })}</p>
        <p>{t('consent.history')}</p>
      </div>
      {!isOwner && <FormError message={t('consent.ownerOnly')} />}
      <FormError message={error} />
      <div className={styles.actions}>
        {isOwner && (
          <BusyButton className={form.button} busy={busy} onClick={() => answer(true)}>
            {t('consent.allow')}
          </BusyButton>
        )}
        <BusyButton className={styles.secondary} busy={busy} onClick={() => answer(false)}>
          {t('consent.deny')}
        </BusyButton>
      </div>
    </section>
  )
}

import { useQuery } from '@tanstack/react-query'
import { useLocation } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import { FormError } from '../components/field.tsx'
import form from '../components/form.module.css'
import styles from '../components/list.module.css'
import { PageTitle } from '../components/page-title.tsx'

/** Sin nombre, el dominio del cliente (los clientes CIMD se identifican por una URL) */
function fallbackName(clientId: string) {
  try {
    return new URL(clientId).hostname
  } catch {
    return clientId
  }
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
  if (name.isPending || organizations.isPending) return null
  const client = name.data ?? fallbackName(clientId)
  const isOwner = organizations.data?.organizations.some((o) => o.role === 'owner') ?? false

  const answer = async (accept: boolean) => {
    setBusy(true)
    const result = await accounts.consent(accept)
    setBusy(false)
    if (!result.ok) setError(t(`errors.${result.code}`, { defaultValue: t('errors.UNKNOWN') }))
  }

  return (
    <section>
      <PageTitle>{t('consent.title', { client })}</PageTitle>
      <p>{t('consent.body', { client })}</p>
      <p>{t('consent.history')}</p>
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

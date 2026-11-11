import { useQuery } from '@tanstack/react-query'
import { Navigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { AiSettings } from './ai-settings.tsx'
import styles from './settings.module.css'

/** Ajustes: cómo se ve Crisol y, para el propietario, la IA. Aquí irá lo que venga */
export function Settings() {
  const { t } = useTranslation()
  const api = useApi()
  const { account, pending } = useAccounts().useAccount()
  const organizations = useQuery({
    queryKey: ['organizations'],
    queryFn: () => api.call('listOrganizations', {}),
    enabled: Boolean(account)
  })
  // Quien juega en alguna campaña también conecta su IA, que solo lee lo que sabe su campaña (ADR-0017)
  const worlds = useQuery({
    queryKey: ['worlds', 'campaigns'],
    queryFn: () => api.call('listWorldsWithCampaigns', {}),
    enabled: Boolean(account)
  })
  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  const isOwner = organizations.data?.organizations.some((o) => o.role === 'owner') ?? false
  const plays = worlds.data?.worlds.some((w) => w.campaigns.some((c) => c.role === 'player')) ?? false
  return (
    <section className={styles.page}>
      <PageTitle>{t('settings.title')}</PageTitle>
      {isOwner ? <AiSettings /> : plays && <AiSettings player />}
    </section>
  )
}

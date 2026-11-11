import { useQuery } from '@tanstack/react-query'
import { Navigate } from '@tanstack/react-router'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import form from '../components/form.module.css'
import { PageTitle } from '../components/page-title.tsx'
import { setPlain, usePlain } from '../components/plain.ts'
import { AiSettings } from './ai-settings.tsx'
import styles from './settings.module.css'

/** Ajustes: cómo se ve Crisol en este aparato y, para el propietario, la IA. Aquí irá lo que venga */
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
      <DeviceSettings />
    </section>
  )
}

/** Lo de este aparato (se guarda en el navegador): sin desenfoque, todo opaco, para un ordenador justo de fuerzas */
function DeviceSettings() {
  const { t } = useTranslation()
  const plain = usePlain()
  const id = useId()
  return (
    <section aria-labelledby={id} className={styles.device}>
      <h2 id={id}>{t('settings.device')}</h2>
      <label className={form.check}>
        <input type="checkbox" checked={plain} onChange={(event) => setPlain(event.currentTarget.checked)} />
        {t('settings.plain')}
      </label>
    </section>
  )
}

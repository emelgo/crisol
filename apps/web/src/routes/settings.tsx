import { useQuery } from '@tanstack/react-query'
import { Navigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { currentTheme, setTheme, type Theme } from '../theme.ts'
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
  const [theme, setThemeState] = useState<Theme>(currentTheme)
  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  const isOwner = organizations.data?.organizations.some((o) => o.role === 'owner') ?? false
  const plays = worlds.data?.worlds.some((w) => w.campaigns.some((c) => c.role === 'player')) ?? false
  return (
    <section className={styles.page}>
      <PageTitle>{t('settings.title')}</PageTitle>
      <section aria-labelledby="ajustes-apariencia">
        <h2 id="ajustes-apariencia">{t('settings.appearance')}</h2>
        <fieldset className={styles.themes}>
          <legend>{t('settings.theme')}</legend>
          {(['light', 'dark'] as const).map((option) => (
            <label key={option} className={styles.theme} data-theme-option={option}>
              <input
                type="radio"
                name="tema"
                checked={theme === option}
                onChange={() => {
                  setTheme(option)
                  setThemeState(option)
                }}
              />
              <span aria-hidden="true" className={styles.swatch} />
              {t(option === 'light' ? 'settings.light' : 'settings.dark')}
            </label>
          ))}
        </fieldset>
      </section>
      {isOwner ? <AiSettings embedded /> : plays && <AiSettings embedded player />}
    </section>
  )
}

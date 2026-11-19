import { useQuery } from '@tanstack/react-query'
import { Navigate } from '@tanstack/react-router'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import form from '../components/form.module.css'
import { PageTitle } from '../components/page-title.tsx'
import { setPlain, usePlain } from '../components/plain.ts'
import { DiceColorField } from '../dice/color-field.tsx'
import { AiSettings } from './ai-settings.tsx'
import styles from './settings.module.css'

/** Ajustes: la IA (quien crea mundos o está en una campaña), la jugabilidad (los dados) y el aspecto. Aquí irá lo que venga */
export function Settings() {
  const { t } = useTranslation()
  const api = useApi()
  const { account, pending } = useAccounts().useAccount()
  const organizations = useQuery({
    queryKey: ['organizations'],
    queryFn: () => api.call('listOrganizations', {}),
    enabled: Boolean(account)
  })
  // Quien está en alguna campaña también conecta su IA, con el conector de cada campaña (ADR-0030)
  const worlds = useQuery({
    queryKey: ['worlds', 'campaigns'],
    queryFn: () => api.call('listWorldsWithCampaigns', {}),
    enabled: Boolean(account)
  })
  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  const isOwner = organizations.data?.organizations.some((o) => o.role === 'owner') ?? false
  const all = worlds.data?.worlds ?? []
  // Mundos, para quien crea mundos (o lleva alguno); el modo, para quien dirige algo; las conexiones, para todos
  const creates = isOwner || all.some((w) => w.role === 'master')
  const leads = creates || all.some((w) => w.campaigns.some((c) => c.role === 'master'))
  const inCampaign = all.some((w) => w.campaigns.length > 0)
  return (
    <section className={styles.page}>
      <PageTitle>{t('settings.title')}</PageTitle>
      {(creates || inCampaign) && <AiSettings creates={creates} player={!leads} />}
      <GameplaySettings />
      <DeviceSettings />
    </section>
  )
}

/**
 * La jugabilidad (Enrique, 2026-11-13: «los dados en el perfil no encajan»): el color de tus dados y si ves caer los de
 * los demás; se guarda al momento, en la cuenta. Aquí irá lo que venga del juego
 */
function GameplaySettings() {
  const { t } = useTranslation()
  const accounts = useAccounts()
  const { account } = accounts.useAccount()
  const id = useId()
  if (!account) return null
  return (
    <section aria-labelledby={id} className={styles.device}>
      <h2 id={id}>{t('settings.gameplay')}</h2>
      <DiceColorField
        name="diceColor"
        value={account.diceColor}
        onChange={(color) => void accounts.updateDice({ diceColor: color })}
      />
      <label className={form.check}>
        <input
          type="checkbox"
          checked={account.diceOthers !== false}
          onChange={(event) => void accounts.updateDice({ diceOthers: event.currentTarget.checked })}
        />
        {t('dice.others')}
      </label>
    </section>
  )
}

/** El aspecto en este navegador (se guarda en él): sin el efecto cristal, todo opaco, para un ordenador justo de fuerzas */
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

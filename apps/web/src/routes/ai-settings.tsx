import type { AiMode } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useCodeText, useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { outcomeText, useApprovals } from '../components/approval-queue.tsx'
import { CopyField } from '../components/copy-field.tsx'
import { FormError } from '../components/field.tsx'
import styles from '../components/list.module.css'
import settings from './ai-settings.module.css'

const MODES: AiMode[] = ['readOnly', 'assistant', 'copilot']

/** Los ajustes de IA de la cuenta: la dirección del conector, el modo y cómo acabaron sus últimas peticiones */
export function AiSettings() {
  const { t, i18n } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const codeText = useCodeText()
  const announce = useAnnounce()
  const { account, pending } = useAccounts().useAccount()
  const current = useQuery({
    queryKey: ['aiSettings'],
    queryFn: () => api.call('getAiSettings', {}),
    enabled: Boolean(account)
  })
  const approvals = useApprovals()
  // Optimista: la opción cambia en el mismo clic y vuelve atrás si el servidor falla
  const [pendingMode, setPendingMode] = useState<AiMode | null>(null)
  const setMode = useMutation({
    mutationFn: (mode: AiMode) => api.call('setAiMode', { mode }),
    onSuccess: (data) => {
      queryClient.setQueryData(['aiSettings'], data)
      announce(t('ai.saved'))
    },
    onSettled: () => setPendingMode(null)
  })

  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  const mode = pendingMode ?? current.data?.mode
  const recent = approvals.data?.recent ?? []
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <section>
      <h1>{t('ai.title')}</h1>
      {current.data && (
        <>
          <section aria-labelledby="conector">
            <h2 id="conector">{t('ai.connectorTitle')}</h2>
            <p>{t('ai.connectorHint')}</p>
            <CopyField label={t('ai.connector')} value={current.data.connectorUrl} />
          </section>

          <fieldset className={settings.modes}>
            <legend>{t('ai.modeTitle')}</legend>
            {MODES.map((option) => (
              <label key={option} className={settings.mode}>
                <input
                  type="radio"
                  name="mode"
                  value={option}
                  checked={mode === option}
                  disabled={setMode.isPending}
                  onChange={() => {
                    setPendingMode(option)
                    setMode.mutate(option)
                  }}
                />
                <span>
                  <strong>{t(`ai.modes.${option}`)}</strong>
                  <span className={styles.role}>{t(`ai.modeHints.${option}`)}</span>
                </span>
              </label>
            ))}
          </fieldset>
          {setMode.isSuccess && <p>{t('ai.saved')}</p>}
        </>
      )}
      <FormError message={current.error || setMode.error ? errorText(current.error ?? setMode.error) : null} />

      <section aria-labelledby="ultimas">
        <h2 id="ultimas">{t('ai.recentTitle')}</h2>
        {approvals.data &&
          (recent.length === 0 ? (
            <p>{t('ai.recentEmpty')}</p>
          ) : (
            <ul className={styles.list} aria-label={t('ai.recentTitle')}>
              {recent.map((approval) => (
                <li key={approval.id} className={styles.item}>
                  <span className={styles.name}>{outcomeText(t, codeText, approval)}</span>
                  <span className={styles.role}>
                    <time dateTime={approval.requestedAt}>{date.format(new Date(approval.requestedAt))}</time> ·{' '}
                    {approval.tool}
                  </span>
                </li>
              ))}
            </ul>
          ))}
      </section>
    </section>
  )
}

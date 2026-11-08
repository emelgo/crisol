import type { AiMode } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { aiSettingsQuery } from '../api/queries.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { CopyField } from '../components/copy-field.tsx'
import { FormError } from '../components/field.tsx'
import styles from '../components/list.module.css'
import settings from './ai-settings.module.css'

const MODES: AiMode[] = ['readOnly', 'assistant', 'copilot']

/** Los ajustes de la IA, dentro de «Ajustes» (docs/diseno.md: solo el conector y el modo): sus cajas, al lado de las demás */
export function AiSettings({ player = false }: { player?: boolean }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const announce = useAnnounce()
  const { account, pending } = useAccounts().useAccount()
  const current = useQuery({ ...aiSettingsQuery(api), enabled: Boolean(account) })
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

  const body = (
    <>
      {current.data && (
        <>
          <section aria-labelledby="conector">
            <h2 id="conector">{t('ai.connectorTitle')}</h2>
            <p>{t('ai.connectorHint')}</p>
            <CopyField label={t('ai.connector')} value={current.data.connectorUrl} />
            {/* La jugadora: lo que su IA puede leer, dentro de su recuadro (no suelto debajo) */}
            {player && <p>{t('ai.playerReads')}</p>}
          </section>
          {!player && (
            <fieldset className={settings.modes}>
              <legend>{t('ai.modeTitle')}</legend>
              {MODES.map((option) => (
                <label key={option} className={settings.mode}>
                  <input
                    type="radio"
                    name="mode"
                    value={option}
                    checked={mode === option}
                    onChange={() => {
                      // Mientras se guarda otro, se ignora: deshabilitarlas sacaría el foco y no se podría seguir con flechas
                      if (setMode.isPending) return
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
          )}
          {setMode.isSuccess && <p>{t('ai.saved')}</p>}
        </>
      )}
      <FormError message={current.error || setMode.error ? errorText(current.error ?? setMode.error) : null} />
    </>
  )
  return <div className={settings.embedded}>{body}</div>
}

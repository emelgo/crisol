import type { Approval } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useCodeText, useErrorText } from '../api/errors.ts'
import { requestSummary } from '../summaries.ts'
import { FormError } from './field.tsx'
import form from './form.module.css'
import styles from './list.module.css'
import notices from './notices.module.css'

/** Lo que pidió la IA de la cuenta. El canal avisa de cada cambio (changed approvals) y la consulta se vuelve a pedir */
export function useApprovals() {
  const api = useApi()
  const { account } = useAccounts().useAccount()
  return useQuery({
    queryKey: ['approvals'],
    queryFn: () => api.call('listApprovals', {}),
    enabled: Boolean(account)
  })
}

/** Cómo quedó una petición, en una frase */
export function outcomeText(t: TFunction, codeText: (code: string) => string, approval: Approval) {
  const what = requestSummary(t, approval)
  if (approval.status === 'done') return t('approvals.done', { what })
  if (approval.status === 'rejected') return t('approvals.rejected', { what })
  if (approval.status === 'failed') return t('approvals.failed', { what, error: codeText(approval.error ?? 'UNKNOWN') })
  return `${t('approvals.request', { what })} (${t(`approvals.status.${approval.status}`)})`
}

/** Lo que Claude espera que apruebes: en cualquier página, mientras haya algo pendiente, sin recargar */
export function ApprovalQueue() {
  const { t } = useTranslation()
  const approvals = useApprovals()
  const [outcome, setOutcome] = useState<string | null>(null)
  const pending = approvals.data?.pending ?? []
  return (
    <section aria-label={t('approvals.title')} aria-live="polite" className={notices.region}>
      {pending.length > 0 && (
        <>
          <h2>{t('approvals.title')}</h2>
          <ul className={styles.list} aria-label={t('approvals.listLabel')}>
            {pending.map((approval) => (
              <ApprovalItem key={approval.id} approval={approval} onDecided={setOutcome} />
            ))}
          </ul>
        </>
      )}
      {outcome && <p role="status">{outcome}</p>}
    </section>
  )
}

function ApprovalItem({ approval, onDecided }: { approval: Approval; onDecided: (outcome: string) => void }) {
  const { t, i18n } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const codeText = useCodeText()
  const decide = useMutation({
    mutationFn: (decision: 'approve' | 'reject') => api.call(decision, { approvalId: approval.id }),
    onSuccess: async (decided) => {
      onDecided(outcomeText(t, codeText, decided))
      // Lo aprobado puede tocar cualquier cosa de lo que se ve
      await queryClient.invalidateQueries()
    },
    // Si ya estaba decidida o ha caducado, la cola se pone al día
    onError: () => queryClient.invalidateQueries({ queryKey: ['approvals'] })
  })
  const what = requestSummary(t, approval)
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <li className={styles.item}>
      <span className={styles.name}>{t('approvals.request', { what })}</span>
      <div className={styles.actions}>
        <button
          type="button"
          className={form.button}
          aria-label={t('approvals.approveButton', { what })}
          disabled={decide.isPending}
          onClick={() => decide.mutate('approve')}
        >
          {t('approvals.approve')}
        </button>
        <button
          type="button"
          className={styles.secondary}
          aria-label={t('approvals.rejectButton', { what })}
          disabled={decide.isPending}
          onClick={() => decide.mutate('reject')}
        >
          {t('approvals.reject')}
        </button>
      </div>
      <details className={styles.confirm}>
        <summary>{t('approvals.detail')}</summary>
        <p>{t('approvals.tool', { tool: approval.tool })}</p>
        <p>
          {t('approvals.requestedAt', {
            date: date.format(new Date(approval.requestedAt)),
            expires: date.format(new Date(approval.expiresAt))
          })}
        </p>
        <pre className={styles.detail}>{JSON.stringify(approval.input, null, 2)}</pre>
      </details>
      <FormError message={decide.error ? errorText(decide.error) : null} />
    </li>
  )
}

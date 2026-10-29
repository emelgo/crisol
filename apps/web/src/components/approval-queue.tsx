import type { Approval } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useCodeText, useErrorText } from '../api/errors.ts'
import { requestSummary } from '../summaries.ts'
import { useAnnounce } from './announcer.tsx'
import { BusyButton } from './busy-button.tsx'
import { FormError } from './field.tsx'
import { focusAfterRemoving } from './focus.ts'
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
  const announce = useAnnounce()
  const approvals = useApprovals()
  const [outcome, setOutcome] = useState<string | null>(null)
  const pending = approvals.data?.pending ?? []
  const titleId = useId()

  // Lo que llega nuevo se anuncia (la cola no es una región viva: se leería entera con sus botones)
  const seen = useRef(new Set<string>())
  useEffect(() => {
    const fresh = (approvals.data?.pending ?? []).filter((approval) => !seen.current.has(approval.id))
    for (const approval of fresh) seen.current.add(approval.id)
    if (fresh.length > 0) announce(fresh.map((a) => t('approvals.request', { what: requestSummary(t, a) })).join('. '))
  }, [approvals.data, announce, t])

  const decided = (text: string) => {
    setOutcome(text)
    announce(text)
  }

  return (
    <>
      {pending.length > 0 && (
        <section aria-labelledby={titleId} className={`${notices.region} ${notices.panel}`}>
          <h2 id={titleId}>{t('approvals.title')}</h2>
          <ul className={styles.list} aria-label={t('approvals.listLabel')}>
            {pending.map((approval) => (
              <ApprovalItem key={approval.id} approval={approval} onDecided={decided} />
            ))}
          </ul>
        </section>
      )}
      {outcome && <p className={notices.region}>{outcome}</p>}
    </>
  )
}

function ApprovalItem({ approval, onDecided }: { approval: Approval; onDecided: (outcome: string) => void }) {
  const { t, i18n } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const codeText = useCodeText()
  const item = useRef<HTMLLIElement>(null)
  // Al decidir, la petición desaparece: el foco irá a la siguiente o al título de la página
  const refocus = useRef(() => {})
  const decide = useMutation({
    mutationFn: (decision: 'approve' | 'reject') => api.call(decision, { approvalId: approval.id }),
    onMutate: () => {
      refocus.current = focusAfterRemoving(item.current)
    },
    onSuccess: async (decided) => {
      onDecided(outcomeText(t, codeText, decided))
      // Lo aprobado puede tocar cualquier cosa de lo que se ve
      await queryClient.invalidateQueries()
      refocus.current()
    },
    // Si ya estaba decidida o ha caducado, la cola se pone al día (y, si ya no está, el foco sigue igual que al decidir)
    onError: async () => {
      await queryClient.invalidateQueries({ queryKey: ['approvals'] })
      if (!item.current) refocus.current()
    }
  })
  const what = requestSummary(t, approval)
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <li ref={item} className={styles.item}>
      <span className={styles.name}>{t('approvals.request', { what })}</span>
      <div className={styles.actions}>
        <BusyButton
          className={form.button}
          aria-label={t('approvals.approveButton', { what })}
          busy={decide.isPending}
          onClick={() => decide.mutate('approve')}
        >
          {t('approvals.approve')}
        </BusyButton>
        <BusyButton
          className={styles.secondary}
          aria-label={t('approvals.rejectButton', { what })}
          busy={decide.isPending}
          onClick={() => decide.mutate('reject')}
        >
          {t('approvals.reject')}
        </BusyButton>
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

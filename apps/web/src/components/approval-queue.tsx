import type { Approval } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { Plug } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useCodeText, useErrorText } from '../api/errors.ts'
import { requestSummary } from '../summaries.ts'
import { useAnnounce } from './announcer.tsx'
import floating from './approval-queue.module.css'
import { BusyButton } from './busy-button.tsx'
import { FormError } from './field.tsx'
import { focusAfterRemoving } from './focus.ts'
import styles from './list.module.css'

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

/** Lo que la IA espera que apruebes: tarjetas que flotan en cualquier página, mientras haya algo pendiente */
export function ApprovalQueue() {
  const { t } = useTranslation()
  const announce = useAnnounce()
  const approvals = useApprovals()
  const [outcome, setOutcome] = useState<string | null>(null)
  const pending = approvals.data?.pending ?? []

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
  // Lo decidido se ve un momento y se va
  useEffect(() => {
    if (!outcome) return
    const timer = window.setTimeout(() => setOutcome(null), 5000)
    return () => window.clearTimeout(timer)
  }, [outcome])

  return (
    <>
      {/* Flotan abajo a la derecha, estés donde estés, como en el Crisol antiguo */}
      {pending.length > 0 && (
        // Sin aria-labelledby: no es una caja de la hoja (base.css), son tarjetas sueltas que flotan
        <section aria-label={t('approvals.title')} className={floating.stack}>
          {/* El título, para el lector de pantalla: a la vista lo dice cada tarjeta */}
          <h2 className={floating.hidden}>{t('approvals.title')}</h2>
          <ul className={floating.list} aria-label={t('approvals.listLabel')}>
            {pending.map((approval) => (
              <ApprovalItem key={approval.id} approval={approval} onDecided={decided} />
            ))}
          </ul>
        </section>
      )}
      {outcome && pending.length === 0 && <p className={floating.outcome}>{outcome}</p>}
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
    <li ref={item} className={floating.card}>
      <p className={floating.kicker}>
        <Plug aria-hidden="true" size={14} />
        {t('approvals.title')}
      </p>
      <span className={floating.what}>{t('approvals.request', { what })}</span>
      <div className={floating.actions}>
        <BusyButton
          className={floating.approve}
          aria-label={t('approvals.approveButton', { what })}
          busy={decide.isPending}
          onClick={() => decide.mutate('approve')}
        >
          {t('approvals.approve')}
        </BusyButton>
        <BusyButton
          className={floating.reject}
          aria-label={t('approvals.rejectButton', { what })}
          busy={decide.isPending}
          onClick={() => decide.mutate('reject')}
        >
          {t('approvals.reject')}
        </BusyButton>
      </div>
      <details className={floating.detail}>
        <summary>{t('approvals.detail')}</summary>
        <p>{t('approvals.tool', { tool: approval.tool })}</p>
        <p>
          {t('approvals.requestedAt', {
            date: date.format(new Date(approval.requestedAt)),
            expires: date.format(new Date(approval.expiresAt))
          })}
        </p>
        {/* Se desplaza: con el foco, también con el teclado */}
        {/* biome-ignore lint/a11y/noNoninteractiveTabindex: una zona que se desplaza tiene que poder recibir el foco */}
        <pre className={styles.detail} tabIndex={0}>
          {JSON.stringify(approval.input, null, 2)}
        </pre>
      </details>
      <FormError message={decide.error ? errorText(decide.error) : null} />
    </li>
  )
}

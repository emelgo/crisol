import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { BusyButton } from './busy-button.tsx'
import { focusOnMount } from './focus.ts'
import form from './form.module.css'
import styles from './list.module.css'

/**
 * Expulsar a alguien de una campaña y, si se pide, cambiar el enlace a la vez (el viejo aún le valdría). Si la
 * expulsión sale bien pero el enlace no cambia, no es un fallo: linkFailed lo dice
 */
export function useRemoveMember(campaignId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, newLink }: { userId: string; newLink: boolean }) => {
      queryClient.setQueryData(['members', campaignId], await api.call('removeMember', { campaignId, userId }))
      if (!newLink) return { linkFailed: false }
      try {
        queryClient.setQueryData(['invitation', campaignId], await api.call('regenerateInvitation', { campaignId }))
        return { linkFailed: false }
      } catch {
        await queryClient.invalidateQueries({ queryKey: ['invitation', campaignId] })
        return { linkFailed: true }
      }
    }
  })
}

/** Cómo acabó la expulsión, en una frase (en línea). Con el enlace sin cambiar, es un aviso (alert) */
export function RemovedMessage({ name, linkFailed }: { name: string; linkFailed: boolean }) {
  const { t } = useTranslation()
  if (!linkFailed) return t('members.removed', { name })
  return (
    <span role="alert" className={form.error}>
      {t('members.removedLinkFailed', { name })}
    </span>
  )
}

/** La confirmación de expulsar: avisa de que con el enlace actual podría volver. El foco va a ella al abrirse */
export function RemoveMemberConfirm({
  name,
  pending,
  onConfirm,
  onCancel
}: {
  name: string
  pending: boolean
  onConfirm(newLink: boolean): void
  onCancel(): void
}) {
  const { t } = useTranslation()
  const warningId = useId()
  return (
    <div className={styles.confirm}>
      <p id={warningId}>{t('members.removeWarning', { name })}</p>
      <div className={styles.actions}>
        <BusyButton
          ref={focusOnMount}
          className={form.button}
          aria-describedby={warningId}
          busy={pending}
          onClick={() => onConfirm(false)}
        >
          {t('members.removeConfirm')}
        </BusyButton>
        <BusyButton
          className={styles.secondary}
          aria-describedby={warningId}
          busy={pending}
          onClick={() => onConfirm(true)}
        >
          {t('members.removeAndRegenerate')}
        </BusyButton>
        <button type="button" className={styles.secondary} onClick={onCancel}>
          {t('list.cancel')}
        </button>
      </div>
    </div>
  )
}

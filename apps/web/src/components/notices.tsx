import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useErrorText } from '../api/errors.ts'
import { type JoinNotice, useNotices } from '../realtime/context.tsx'
import { FormError } from './field.tsx'
import styles from './list.module.css'
import notices from './notices.module.css'
import { RemoveMemberConfirm, useRemoveMember } from './remove-member.tsx'

/** Los avisos al máster («Ana ha entrado en La Marca»), con «Expulsar» a mano. Siempre en la página para que se lean */
export function Notices() {
  const { t } = useTranslation()
  const { notices: list } = useNotices()
  return (
    <section aria-label={t('notices.title')} aria-live="polite" className={notices.region}>
      {list.length > 0 && (
        <ul className={styles.list}>
          {list.map((notice) => (
            <NoticeItem key={notice.id} notice={notice} />
          ))}
        </ul>
      )}
    </section>
  )
}

function NoticeItem({ notice }: { notice: JoinNotice }) {
  const { t } = useTranslation()
  const { dismiss } = useNotices()
  const errorText = useErrorText()
  const remove = useRemoveMember(notice.campaignId)
  const [confirming, setConfirming] = useState(false)
  const { name } = notice.member

  return (
    <li className={styles.item}>
      <span className={styles.name}>
        {remove.isSuccess
          ? t('members.removed', { name })
          : t('notices.joined', { member: name, campaign: notice.campaign })}
      </span>
      {!remove.isSuccess && !confirming && (
        <button
          type="button"
          className={styles.secondary}
          aria-label={t('members.removeButton', { name })}
          onClick={() => setConfirming(true)}
        >
          {t('members.remove')}
        </button>
      )}
      <button
        type="button"
        className={styles.secondary}
        aria-label={t('notices.dismiss', { member: name })}
        onClick={() => dismiss(notice.id)}
      >
        {t('notices.dismissShort')}
      </button>
      {confirming && !remove.isSuccess && (
        <RemoveMemberConfirm
          name={name}
          pending={remove.isPending}
          onConfirm={(newLink) => remove.mutate({ userId: notice.member.userId, newLink })}
          onCancel={() => setConfirming(false)}
        />
      )}
      <FormError message={remove.error ? errorText(remove.error) : null} />
    </li>
  )
}

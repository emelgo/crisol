import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useErrorText } from '../api/errors.ts'
import { type JoinNotice, useNotices } from '../realtime/context.tsx'
import { useAnnounce } from './announcer.tsx'
import { FormError } from './field.tsx'
import styles from './list.module.css'
import notices from './notices.module.css'
import { RemoveMemberConfirm, useRemoveMember } from './remove-member.tsx'

/** Los avisos al máster («Ana ha entrado en La Marca»), con «Expulsar» a mano. Se anuncian al llegar */
export function Notices() {
  const { t } = useTranslation()
  const announce = useAnnounce()
  const { notices: list, newVersion } = useNotices()

  // No es una región viva (se leería entera, con sus botones): lo nuevo se anuncia aparte
  const seen = useRef(new Set<string>())
  useEffect(() => {
    const fresh = list.filter((notice) => !seen.current.has(notice.id))
    for (const notice of fresh) seen.current.add(notice.id)
    if (fresh.length > 0) {
      announce(fresh.map((n) => t('notices.joined', { member: n.member.name, campaign: n.campaign })).join(' '))
    }
  }, [list, announce, t])
  useEffect(() => {
    if (newVersion) announce(t('notices.newVersion'))
  }, [newVersion, announce, t])

  if (!newVersion && list.length === 0) return null
  return (
    <section aria-label={t('notices.title')} className={notices.region}>
      {newVersion && (
        <p className={notices.version}>
          {t('notices.newVersion')}{' '}
          <button type="button" className={styles.secondary} onClick={() => window.location.reload()}>
            {t('notices.reload')}
          </button>
        </p>
      )}
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
  const announce = useAnnounce()
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
          onConfirm={(newLink) =>
            remove.mutate(
              { userId: notice.member.userId, newLink },
              { onSuccess: () => announce(t('members.removed', { name })) }
            )
          }
          onCancel={() => setConfirming(false)}
        />
      )}
      <FormError message={remove.error ? errorText(remove.error) : null} />
    </li>
  )
}

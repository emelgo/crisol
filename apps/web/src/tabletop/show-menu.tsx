/**
 * «Enseñar» (docs/specs/ensenar.md): a todos, a unos jugadores o en la vista de jugadores. Lo usan la ventana de una
 * página y el cuadro de enseñar una imagen. Lo comprueba el servidor; aquí solo se elige a quién
 */
import { useMutation, useQuery } from '@tanstack/react-query'
import { ChevronDown, Eye, ImageIcon, Tv, UserCheck, Users } from 'lucide-react'
import { useCallback, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useDismiss } from '../components/dismiss.ts'
import { FormError } from '../components/field.tsx'
import { Modal } from '../components/modal.tsx'
import cards from '../routes/world-card.module.css'
import { useWorldFiles } from '../wiki/cover-look.ts'
import styles from './show-menu.module.css'

export type ShowTarget = { to?: string[]; screen?: boolean }

/** El botón y su menú: «A todos», «A unos…» (con sus casillas) y «En la vista de jugadores» */
export function ShowMenu({
  campaignId,
  busy,
  label,
  className,
  onShow
}: {
  campaignId: string
  busy: boolean
  label?: string
  className?: string
  onShow: (target: ShowTarget) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const [open, setOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  const [chosen, setChosen] = useState<string[]>([])
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const close = useCallback(() => {
    setOpen(false)
    setPicking(false)
  }, [])
  useDismiss(open, close, menu, button)
  const members = useQuery({
    queryKey: ['members', campaignId],
    queryFn: () => api.call('listMembers', { campaignId }),
    enabled: open
  })
  const players = (members.data?.members ?? []).filter((m) => m.role === 'player')
  const pick = (target: ShowTarget) => {
    close()
    onShow(target)
  }
  return (
    <span className={styles.wrap}>
      <button
        ref={button}
        type="button"
        className={className ?? styles.button}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen(!open)}
      >
        <Eye aria-hidden="true" size={15} />
        {label ?? t('show.button')}
        <ChevronDown aria-hidden="true" size={13} />
      </button>
      {open && (
        <div ref={menu} className={styles.menu} role="menu">
          {picking ? (
            <div className={styles.pick}>
              <p className={styles.head}>{t('show.toSome')}</p>
              {players.length === 0 && <p className={styles.muted}>{t('show.noPlayers')}</p>}
              {players.map((player) => (
                <label key={player.userId} className={styles.check}>
                  <input
                    type="checkbox"
                    checked={chosen.includes(player.userId)}
                    onChange={(event) =>
                      setChosen(
                        event.currentTarget.checked
                          ? [...chosen, player.userId]
                          : chosen.filter((id) => id !== player.userId)
                      )
                    }
                  />
                  {player.name}
                </label>
              ))}
              <button
                type="button"
                className={styles.go}
                disabled={chosen.length === 0}
                onClick={() => pick({ to: chosen })}
              >
                {t('show.button')}
              </button>
            </div>
          ) : (
            <>
              <button type="button" role="menuitem" onClick={() => pick({})}>
                <Users aria-hidden="true" size={15} />
                {t('show.toAll')}
              </button>
              <button type="button" role="menuitem" onClick={() => setPicking(true)}>
                <UserCheck aria-hidden="true" size={15} />
                {t('show.toSome')}…
              </button>
              <button type="button" role="menuitem" onClick={() => pick({ screen: true })}>
                <Tv aria-hidden="true" size={15} />
                {t('show.onScreen')}
              </button>
            </>
          )}
        </div>
      )}
    </span>
  )
}

/** En la barra de la Mesa: elegir una imagen del mundo y enseñarla */
export function ShowImage({ worldId, campaignId }: { worldId: string; campaignId: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className={styles.barButton}
        aria-label={t('show.image')}
        title={t('show.image')}
        onClick={() => setOpen(true)}
      >
        <ImageIcon aria-hidden="true" size={16} />
      </button>
      {open && <ShowImageDialog worldId={worldId} campaignId={campaignId} onClose={() => setOpen(false)} />}
    </>
  )
}

function ShowImageDialog({
  worldId,
  campaignId,
  onClose
}: {
  worldId: string
  campaignId: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const titleId = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const files = useWorldFiles(worldId)
  const images = files.data?.files.filter((file) => file.kind === 'image') ?? []
  const [chosen, setChosen] = useState<string | null>(null)
  const show = useMutation({
    mutationFn: (target: ShowTarget) => api.call('showImage', { campaignId, fileId: chosen ?? '', ...target }),
    onSuccess: () => dialog.current?.close()
  })
  return (
    <Modal ref={dialog} aria-labelledby={titleId} className={cards.dialog} onClose={onClose}>
      <div className={cards.form}>
        <h2 id={titleId}>{t('show.image')}</h2>
        {images.length === 0 && files.data ? (
          <p className={styles.muted}>{t('show.noImages')}</p>
        ) : (
          <ul className={styles.thumbs} aria-label={t('show.images')}>
            {images.map((file) => (
              <li key={file.id}>
                <button type="button" aria-pressed={chosen === file.id} onClick={() => setChosen(file.id)}>
                  <img src={file.url} alt="" loading="lazy" />
                  <span>{file.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <FormError message={show.error ? errorText(show.error) : null} />
        <div className={styles.actions}>
          {chosen ? (
            <ShowMenu
              campaignId={campaignId}
              busy={show.isPending}
              className={styles.primary}
              onShow={(target) => show.mutate(target)}
            />
          ) : (
            <span className={styles.muted}>{t('show.pickImage')}</span>
          )}
        </div>
      </div>
    </Modal>
  )
}

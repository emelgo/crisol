/**
 * Las versiones de un personaje, al lado de su ficha: la de cuando se terminó de crear y la de cada nivel confirmado.
 * Restaurar una pide confirmarlo y se deshace desde el historial
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ActionOutput } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { BusyButton } from '../components/busy-button.tsx'
import dialogStyles from '../components/dialog.module.css'
import { FormError } from '../components/field.tsx'
import form from '../components/form.module.css'
import { Modal } from '../components/modal.tsx'
import cards from '../routes/world-card.module.css'
import { characterKey } from './save.ts'
import styles from './sheet.module.css'

type Character = ActionOutput<'getCharacter'>['character']
type Version = ActionOutput<'listCharacterVersions'>['versions'][number]

export function Versions({ character }: { character: Character }) {
  const { t, i18n } = useTranslation()
  const api = useApi()
  const versions = useQuery({
    queryKey: ['characterVersions', character.id],
    queryFn: () => api.call('listCharacterVersions', { characterId: character.id })
  })
  const [restoring, setRestoring] = useState<Version | null>(null)
  const list = versions.data?.versions ?? []
  const date = (iso: string) => new Date(iso).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' })
  const titleOf = (v: Version) =>
    v.kind === 'created'
      ? t('characterVersions.created', { level: v.level })
      : t('characterVersions.level', { level: v.level })
  return (
    <aside className={styles.versions} aria-labelledby="versiones">
      <h2 id="versiones" className={styles.sideTitle}>
        {t('characterVersions.title')}
      </h2>
      {list.length === 0 ? (
        <p className={styles.none}>{t('characterVersions.none')}</p>
      ) : (
        <ul className={styles.versionList}>
          {list.map((v, i) => (
            <li key={v.id} className={styles.version}>
              <span className={styles.versionTitle}>
                {titleOf(v)}
                {i === 0 && <span className={styles.current}>{t('characterVersions.current')}</span>}
              </span>
              <span className={styles.versionMeta}>
                {date(v.createdAt)}
                {v.summary.line ? ` · ${v.summary.line}` : ''}
              </span>
              {i > 0 && (
                <button type="button" className={styles.restore} onClick={() => setRestoring(v)}>
                  {t('characterVersions.restore')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {restoring && (
        <RestoreDialog
          character={character}
          version={restoring}
          title={titleOf(restoring)}
          onClose={() => setRestoring(null)}
        />
      )}
    </aside>
  )
}

function RestoreDialog({
  character,
  version,
  title,
  onClose
}: {
  character: Character
  version: Version
  title: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const restore = useMutation({
    mutationFn: () =>
      api.call('restoreCharacterVersion', {
        characterId: character.id,
        versionId: version.id,
        version: character.version
      }),
    onSuccess: (out) => {
      queryClient.setQueryData(characterKey(character.id), out)
      void queryClient.invalidateQueries({ queryKey: ['characters', character.campaignId] })
      dialog.current?.close()
    }
  })
  return (
    <Modal ref={dialog} aria-labelledby={titleId} className={cards.dialog} onClose={onClose}>
      <div className={cards.form}>
        <h2 id={titleId}>{t('characterVersions.restoreTitle', { version: title })}</h2>
        <p>{t('characterVersions.restoreText', { name: character.name, line: version.summary.line ?? '' })}</p>
        <p className={styles.none}>{t('characterVersions.undoable')}</p>
        <FormError message={restore.error ? errorText(restore.error) : null} />
        <div className={styles.actions}>
          <BusyButton type="button" className={form.button} busy={restore.isPending} onClick={() => restore.mutate()}>
            {t('characterVersions.restore')}
          </BusyButton>
          <button type="button" className={dialogStyles.cancel} onClick={() => dialog.current?.close()}>
            {t('characters.cancel')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

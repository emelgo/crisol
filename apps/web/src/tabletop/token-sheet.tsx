/**
 * La hoja de la ficha, en un panel al lado del mapa (sin salir de la mesa): la de la criatura en juego o la del
 * personaje, las mismas de «En juego» y de «Personajes», con todas sus tiradas
 */
import type { TokenView } from '@crisol/contracts'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { PlaySheet } from '../characters/play-sheet.tsx'
import { characterKey, useCharacterSave } from '../characters/save.ts'
import { Loading } from '../components/brand.tsx'
import { FormError } from '../components/field.tsx'
import { failed, LoadError } from '../components/load-error.tsx'
import { CreatureSheet } from '../creatures/in-play.tsx'
import styles from './fichas.module.css'

export function TokenSheet({
  token,
  campaignId,
  systemId,
  onClose
}: {
  token: TokenView
  campaignId: string
  systemId: string | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const box = useRef<HTMLElement>(null)
  // Escape la cierra y el foco vuelve a la mesa
  useEffect(() => {
    box.current?.focus()
  }, [])
  return (
    <section
      ref={box}
      className={styles.sheet}
      aria-label={t('tokens.sheetOf', { name: token.actor.name })}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose()
      }}
    >
      <button
        type="button"
        className={`${styles.icon} ${styles.sheetClose}`}
        aria-label={t('tokens.closeSheet')}
        onClick={onClose}
      >
        <X aria-hidden="true" size={18} />
      </button>
      {token.actor.kind === 'creature' ? (
        <CreatureSheet creatureId={token.actor.id} campaignId={campaignId} systemId={systemId} onRemoved={onClose} />
      ) : (
        <CharacterSheet characterId={token.actor.id} campaignId={campaignId} />
      )}
    </section>
  )
}

function CharacterSheet({ characterId, campaignId }: { characterId: string; campaignId: string }) {
  const api = useApi()
  const errorText = useErrorText()
  const loaded = useQuery({
    queryKey: characterKey(characterId),
    queryFn: () => api.call('getCharacter', { characterId })
  })
  const { save, error } = useCharacterSave(characterId, campaignId)
  if (!loaded.data)
    return failed(loaded) ? <LoadError error={loaded.error} onRetry={() => loaded.refetch()} /> : <Loading />
  const { character, state } = loaded.data
  return (
    <article className={styles.characterSheet}>
      <h2>{character.name}</h2>
      <FormError message={error ? errorText(error) : null} />
      <PlaySheet
        subject={character}
        state={state}
        save={save}
        rollWith={(input) => api.call('rollForCharacter', { characterId, ...input })}
      />
    </article>
  )
}

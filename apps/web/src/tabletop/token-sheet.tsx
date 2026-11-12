/**
 * La hoja de un personaje o de una criatura en juego, en su ventana sobre la Mesa (lienzo «Campaña en la Mesa»): la
 * misma de «Personajes» y del compendio, con todas sus tiradas. Se abre desde una ficha del mapa o desde Personajes
 */
import { useQuery } from '@tanstack/react-query'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { PlaySheet } from '../characters/play-sheet.tsx'
import { characterKey, useCharacterSave } from '../characters/save.ts'
import { Loading } from '../components/brand.tsx'
import { FormError } from '../components/field.tsx'
import { failed, LoadError } from '../components/load-error.tsx'
import { useWindows, type WindowSpec } from '../components/windows.tsx'
import { CreatureSheet } from '../creatures/in-play.tsx'
import styles from './fichas.module.css'

export interface SheetActor {
  kind: 'character' | 'creature'
  id: string
  name: string
}

/** La hoja de un personaje o una criatura, en su ventana (una por cada uno) */
export function sheetWindow(actor: SheetActor, campaignId: string, systemId: string | null): WindowSpec {
  return {
    id: `sheet:${actor.id}`,
    title: actor.name,
    width: 760,
    height: 680,
    render: () => <ActorSheet actor={actor} campaignId={campaignId} systemId={systemId} />
  }
}

function ActorSheet({
  actor,
  campaignId,
  systemId
}: {
  actor: SheetActor
  campaignId: string
  systemId: string | null
}) {
  const windows = useWindows()
  return (
    <div className={styles.windowSheet}>
      {actor.kind === 'creature' ? (
        <CreatureSheet
          creatureId={actor.id}
          campaignId={campaignId}
          systemId={systemId}
          // Quitada de juego: su ventana se cierra
          onRemoved={() => windows?.close(`sheet:${actor.id}`)}
        />
      ) : (
        <CharacterSheet characterId={actor.id} campaignId={campaignId} />
      )}
    </div>
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

/**
 * Un personaje (docs/specs/personajes.md § creador): su cabecera y, debajo, su ficha o su creador. Lo que está en
 * creación abre en el creador; lo que ya está hecho, en su ficha, con sus versiones al lado
 */
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Navigate } from '@tanstack/react-router'
import { UserRound } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { Loading } from '../components/brand.tsx'
import { FormError } from '../components/field.tsx'
import { failed, LoadError } from '../components/load-error.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { Tour } from '../components/tour.tsx'
import styles from './character.module.css'
import { Creator } from './creator.tsx'
import { PlaySheet } from './play-sheet.tsx'
import { characterKey, useCharacterSave } from './save.ts'
import { Versions } from './versions.tsx'

const route = getRouteApi('/mundos/$worldId/campanas/$campaignId/personajes/$characterId')

export function CharacterScreen() {
  const { t } = useTranslation()
  const { campaignId, characterId } = route.useParams()
  const api = useApi()
  const errorText = useErrorText()
  const { account, pending } = useAccounts().useAccount()
  const loaded = useQuery({
    queryKey: characterKey(characterId),
    queryFn: () => api.call('getCharacter', { characterId }),
    enabled: Boolean(account),
    // Lo que se elige se guarda en orden y su respuesta trae el estado: volver a la pestaña no lo recarga
    refetchOnWindowFocus: false
  })
  const { save, busy, error, saved } = useCharacterSave(characterId, campaignId)
  const [tab, setTab] = useState<'sheet' | 'creator' | null>(null)
  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  if (!loaded.data) {
    return failed(loaded) ? <LoadError error={loaded.error} onRetry={() => loaded.refetch()} /> : <Loading />
  }
  const { character, state } = loaded.data
  const shown = tab ?? (character.status === 'creating' ? 'creator' : 'sheet')
  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <span className={styles.portrait} aria-hidden="true">
          <UserRound size={34} strokeWidth={1.25} />
        </span>
        <div className={styles.titles}>
          <PageTitle className={styles.name}>{character.name}</PageTitle>
          <p className={styles.line}>
            {[state.summary.line || t('characters.noClass'), character.owner?.name].filter(Boolean).join(' · ')}
          </p>
        </div>
        <span className={styles.saved} aria-live="polite">
          {busy ? t('characters.saving') : saved ? t('characters.saved') : ''}
        </span>
        <nav className={styles.tabs} aria-label={t('characters.views')} data-tour="vistas-personaje">
          {(['sheet', 'creator'] as const).map((each) => (
            <button
              key={each}
              type="button"
              className={styles.tab}
              aria-current={shown === each ? 'page' : undefined}
              onClick={() => setTab(each)}
            >
              {t(each === 'sheet' ? 'characters.sheet' : 'characters.creator')}
            </button>
          ))}
        </nav>
      </header>
      <FormError message={error ? errorText(error) : null} />
      {shown === 'creator' ? (
        <Creator character={character} state={state} save={save} busy={busy} campaignId={campaignId} />
      ) : (
        <div className={styles.sheetLayout}>
          <PlaySheet character={character} state={state} save={save} />
          <Versions character={character} />
        </div>
      )}
      <Tour
        id="personaje"
        steps={[
          { target: '[data-tour="vistas-personaje"]', text: t('tour.characters.views') },
          { target: '[data-tour="hoja-tirar"]', text: t('tour.characters.roll') },
          { target: '[data-tour="versiones"]', text: t('tour.characters.versions'), placement: 'left' }
        ]}
      />
    </div>
  )
}

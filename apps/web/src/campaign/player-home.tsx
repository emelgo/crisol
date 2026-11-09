/**
 * Lo que ve quien juega al abrir su campaña (lienzo «Campaña en la Mesa»): la ficha de su personaje, con «Ir a la Mesa»
 * junto a su nombre. Con varios, el último que abrió (y se cambia junto al nombre); sin ninguno, crear el suyo. Abajo,
 * la campaña: quién juega y dejarla
 */
import type { Campaign } from '@crisol/contracts'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Layers, UserPlus } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { CharacterView } from '../characters/character.tsx'
import { Loading } from '../components/brand.tsx'
import { failed, LoadError } from '../components/load-error.tsx'
import { PageTitle } from '../components/page-title.tsx'
import styles from './player-home.module.css'
import { MembersPanel } from './settings.tsx'

const chosenKey = (campaignId: string) => `crisol.ficha.${campaignId}`

function readChosen(campaignId: string) {
  try {
    return localStorage.getItem(chosenKey(campaignId))
  } catch {
    return null
  }
}

function saveChosen(campaignId: string, characterId: string) {
  try {
    localStorage.setItem(chosenKey(campaignId), characterId)
  } catch {
    // Sin almacenamiento: se abre el primero
  }
}

export function PlayerHome({ worldId, campaign }: { worldId: string; campaign: Campaign }) {
  const { t } = useTranslation()
  const api = useApi()
  const pickId = useId()
  const characters = useQuery({
    queryKey: ['characters', campaign.id],
    queryFn: () => api.call('listCharacters', { campaignId: campaign.id })
  })
  const [chosen, setChosen] = useState(() => readChosen(campaign.id))
  const [vista, setVista] = useState<'ficha' | 'creador' | null>(null)
  if (!characters.data)
    return failed(characters) ? (
      <LoadError error={characters.error} onRetry={() => characters.refetch()} />
    ) : (
      <Loading />
    )
  const own = characters.data.characters
  const current = own.find((c) => c.id === chosen) ?? own[0]
  const toMesa = (
    <Link
      to="/mundos/$worldId/campanas/$campaignId/mesa"
      params={{ worldId, campaignId: campaign.id }}
      className={styles.mesa}
    >
      <Layers aria-hidden="true" size={17} />
      {t('playerHome.toMesa')}
    </Link>
  )
  return (
    <div className={styles.home}>
      {current ? (
        <CharacterView
          key={current.id}
          worldId={worldId}
          campaignId={campaign.id}
          characterId={current.id}
          vista={vista}
          onView={setVista}
          actions={
            <span className={styles.actions}>
              {own.length > 1 && (
                <>
                  <label htmlFor={pickId} className={styles.hidden}>
                    {t('playerHome.character')}
                  </label>
                  <select
                    id={pickId}
                    className={styles.pick}
                    value={current.id}
                    onChange={(event) => {
                      const id = event.currentTarget.value
                      saveChosen(campaign.id, id)
                      setChosen(id)
                      setVista(null)
                    }}
                  >
                    {own.map((character) => (
                      <option key={character.id} value={character.id}>
                        {character.name}
                      </option>
                    ))}
                  </select>
                </>
              )}
              {toMesa}
            </span>
          }
        />
      ) : (
        <section className={styles.empty}>
          <PageTitle>{campaign.name}</PageTitle>
          <p>{t('playerHome.noCharacter')}</p>
          <div className={styles.emptyActions}>
            <Link
              to="/mundos/$worldId/campanas/$campaignId/personajes"
              params={{ worldId, campaignId: campaign.id }}
              className={styles.create}
            >
              <UserPlus aria-hidden="true" size={17} />
              {t('playerHome.create')}
            </Link>
            {toMesa}
          </div>
        </section>
      )}
      {/* La campaña: quién juega y, en su zona de peligro, dejarla */}
      <details className={styles.campaign}>
        <summary>{t('playerHome.campaign', { name: campaign.name })}</summary>
        <MembersPanel campaign={campaign} />
      </details>
    </div>
  )
}

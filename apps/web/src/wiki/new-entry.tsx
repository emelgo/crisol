/**
 * «Entrada nueva del compendio» desde el mundo (revisión, tanda 7): con «/» o al final de lo que sugiere `[[@`, en una
 * ventana flotante (las de la Mesa, components/windows.tsx), para seguir escribiendo la página mientras. Va al
 * compendio del mundo, con el sistema de la campaña elegida en los dados (o el de una de sus campañas); al guardarla,
 * su enlace queda donde se pidió
 */

import { type Text, textOf } from '@crisol/systems'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, type ReactNode, useCallback, useContext, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { EntryEditor } from '../campaign/entry-editor.tsx'
import { Loading } from '../components/brand.tsx'
import { useWindows, WindowLayer, WindowsProvider } from '../components/windows.tsx'
import { useOptionalDice } from '../dice/context.tsx'
import styles from './new-entry.module.css'

/** Pide una entrada nueva (con el nombre ya escrito); `done`, con el nombre con que se guardó */
export type NewEntryRequest = (name: string, done: (saved: string) => void) => void

export const NewEntryContext = createContext<NewEntryRequest | null>(null)

export const useNewEntry = () => useContext(NewEntryContext)

const WINDOW = 'entrada-nueva'

/** Las ventanas flotantes del mundo, por encima de todo, y la petición de una entrada nueva */
export function WorldWindows({ worldId, children }: { worldId: string; children: ReactNode }) {
  const layer = useRef<HTMLDivElement>(null)
  return (
    <WindowsProvider area={layer}>
      <NewEntryProvider worldId={worldId}>{children}</NewEntryProvider>
      <div ref={layer} className={styles.layer}>
        <WindowLayer />
      </div>
    </WindowsProvider>
  )
}

function NewEntryProvider({ worldId, children }: { worldId: string; children: ReactNode }) {
  const { t } = useTranslation()
  const windows = useWindows()
  const request = useCallback<NewEntryRequest>(
    (name, done) =>
      windows?.open({
        id: WINDOW,
        title: t('compendium.newTitle'),
        width: 460,
        height: 640,
        render: () => <NewEntryWindow worldId={worldId} name={name} done={done} />
      }),
    [windows, worldId, t]
  )
  return <NewEntryContext.Provider value={request}>{children}</NewEntryContext.Provider>
}

function NewEntryWindow({ worldId, name, done }: { worldId: string; name: string; done: (saved: string) => void }) {
  const { t } = useTranslation()
  const api = useApi()
  const client = useQueryClient()
  const windows = useWindows()
  const dice = useOptionalDice()
  const campaigns = useQuery({
    queryKey: ['campaigns', worldId],
    queryFn: () => api.call('listCampaigns', { worldId })
  })
  const withSystem = (campaigns.data?.campaigns ?? []).filter((c) => c.system)
  const chosen = dice?.campaignFor(worldId)
  const campaign = withSystem.find((c) => c.id === chosen) ?? withSystem[0]
  const compendium = useQuery({
    queryKey: ['compendium', campaign?.id],
    queryFn: () => api.call('getCampaignCompendium', { campaignId: campaign?.id ?? '' }),
    enabled: Boolean(campaign)
  })
  const close = () => windows?.close(WINDOW)
  if (campaigns.data && !campaign) return <p className={styles.note}>{t('compendium.newNeedsCampaign')}</p>
  if (!compendium.data || !campaign) return <Loading />
  const world = compendium.data.world
  if (!world?.writable || world.types.length === 0)
    return <p className={styles.note}>{t('compendium.newNeedsCampaign')}</p>
  return (
    <EntryEditor
      inWindow
      campaignId={campaign.id}
      targets={[{ layer: 'world', worldId: world.worldId, systemId: world.systemId, types: world.types }]}
      language={compendium.data.language}
      item={null}
      initialName={name}
      onSaved={async (key) => {
        // Su nombre, como quedó, para su enlace
        const read = await api.call('getCampaignContent', { campaignId: campaign.id, keys: [key] })
        const saved = read.items[0]
        const label = saved ? textOf(saved.data.name as Text | undefined, compendium.data?.language ?? 'es') : null
        await client.invalidateQueries({ queryKey: ['compendium', 'linked'] })
        done(label || name || key)
      }}
      onClose={close}
    />
  )
}

/**
 * El compendio de la campaña en una ventana sobre la Mesa (lienzo «Campaña en la Mesa»): el mismo que en su ruta, con su
 * lista, lo abierto y sus detalles, sin dejar la Mesa
 */
import { useEffect, useState } from 'react'
import { Compendium } from '../campaign/compendium.tsx'
import type { WindowSpec } from './windows.tsx'

export function compendiumWindow(
  worldId: string,
  campaignId: string,
  title: string,
  ver: string | null = null
): WindowSpec {
  return {
    id: 'compendium',
    title,
    width: 1000,
    height: 680,
    render: () => <CompendiumWindow worldId={worldId} campaignId={campaignId} asked={ver} />
  }
}

function CompendiumWindow({
  worldId,
  campaignId,
  asked
}: {
  worldId: string
  campaignId: string
  asked: string | null
}) {
  const [ver, setVer] = useState(asked)
  // Abierta otra vez con otra entrada: esa
  useEffect(() => {
    if (asked) setVer(asked)
  }, [asked])
  return <Compendium worldId={worldId} campaignId={campaignId} ver={ver} onVer={setVer} embedded />
}

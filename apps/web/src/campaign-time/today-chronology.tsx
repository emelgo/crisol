/** Una cronología vista desde una campaña (la jugadora, o en una ventana de la Mesa): con su «hoy» */
import type { ReactNode } from 'react'
import chronologyStyles from '../chronologies/chronologies.module.css'
import { Chronology } from '../chronologies/screen.tsx'
import type { WindowSpec } from '../components/windows.tsx'
import { useCampaignToday } from './queries.ts'

/** Una cronología del mundo en una ventana de la Mesa, con el «hoy» de la campaña */
export function chronologyWindow(worldId: string, campaignId: string, chronologyId: string, name: string): WindowSpec {
  return {
    id: `chronology:${chronologyId}`,
    title: name,
    width: 760,
    height: 640,
    render: () => (
      <div className={chronologyStyles.inWindow}>
        <CampaignChronology worldId={worldId} campaignId={campaignId} chronologyId={chronologyId} inWindow />
      </div>
    )
  }
}

/** Una cronología vista desde una campaña: con su «hoy» */
export function CampaignChronology({
  worldId,
  campaignId,
  chronologyId,
  editable = false,
  back = null,
  inWindow = false
}: {
  worldId: string
  campaignId: string
  chronologyId: string
  editable?: boolean
  back?: ReactNode
  inWindow?: boolean
}) {
  const today = useCampaignToday(campaignId).data?.today ?? null
  return (
    <Chronology
      worldId={worldId}
      chronologyId={chronologyId}
      organizationId={undefined}
      editable={editable}
      back={back}
      today={today ? { date: today, campaign: null } : null}
      tour={!inWindow}
    />
  )
}

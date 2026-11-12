/**
 * La ficha de una entrada del compendio incrustada (`![[@Nombre]]`, revisión tanda 7): su tipo, su nombre, unas
 * cifras suyas, lo que hace en juego (con sus botones de tirar, en una campaña) y «Abrir». Se busca desde donde se lee
 * (content-scope.tsx): quien juega solo la ve si su campaña ve la entrada; quien escribe ve también la que no está
 */
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import type { Node } from '@tiptap/core'
import { type NodeViewProps, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import { BookOpen, ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { InPlay } from '../campaign/compendium.tsx'
import { useOptionalDice } from '../dice/context.tsx'
import { visibilityIn } from '../dice/visibility.ts'
import styles from './content-embed.module.css'
import { entryHref, useLinkedEntry } from './content-scope.tsx'
import { useReadAs } from './read-as.tsx'

export function withContentEmbedView(node: Node) {
  return node.extend({
    addNodeView() {
      return ReactNodeViewRenderer(ContentEmbedView)
    }
  })
}

function ContentEmbedView({ node, editor, selected }: NodeViewProps) {
  return (
    <NodeViewWrapper className={styles.wrapper} data-selected={selected || undefined} contentEditable={false}>
      <ContentCard
        name={String(node.attrs.name ?? '')}
        system={(node.attrs.system as string | null) ?? null}
        editing={editor.isEditable}
      />
    </NodeViewWrapper>
  )
}

/** La ficha (en el editor y en lo que se lee sin él: la jugadora, la vista previa) */
export function ContentCard({
  name,
  system,
  editing = false
}: {
  name: string
  system: string | null
  editing?: boolean
}) {
  const { t } = useTranslation()
  const api = useApi()
  const titleId = useId()
  const readAs = useReadAs()
  const dice = useOptionalDice()
  const [open, setOpen] = useState(false)
  const { scope, entry, missing } = useLinkedEntry(name, system)
  // Desde el mundo, las campañas que dirige: se tira en la elegida en los dados si es de su sistema
  const worldId = scope?.kind === 'world' ? scope.worldId : null
  const campaigns = useQuery({
    queryKey: ['campaigns', worldId],
    queryFn: () => api.call('listCampaigns', { worldId: worldId ?? '' }),
    enabled: Boolean(worldId && entry)
  })
  const chosenId = worldId ? (dice?.campaignFor(worldId) ?? null) : null
  const chosen = campaigns.data?.campaigns.find((c) => c.id === chosenId && c.system?.id === entry?.systemId)
  // Su campaña, para leerla entera y tirar: la de quien lee; desde el mundo, la elegida en los dados o una con su sistema
  const campaignId = scope?.kind === 'campaign' ? scope.campaignId : (chosen?.id ?? entry?.campaignId ?? null)
  const full = useQuery({
    queryKey: ['compendium', campaignId ?? `sistema:${entry?.systemId}`, 'entry', entry?.key],
    queryFn: () =>
      campaignId
        ? api.call('getCampaignContent', { campaignId, keys: [entry?.key ?? ''] })
        : api.call('readSystemCompendium', { systemId: entry?.systemId ?? '', keys: [entry?.key ?? ''] }),
    enabled: Boolean(entry)
  })
  const compendium = useQuery({
    queryKey: ['compendium', campaignId],
    queryFn: () => api.call('getCampaignCompendium', { campaignId: campaignId ?? '' }),
    enabled: Boolean(campaignId && entry)
  })
  const item = full.data?.items[0]
  if (!entry) {
    // Quien escribe ve la que no está, para arreglarla; quien lee, nada
    if (!missing || !editing) return null
    return (
      <p className={styles.missing}>
        <BookOpen size={14} aria-hidden="true" />
        {t('contentLink.missing', { name })}
      </p>
    )
  }
  const href = entryHref(scope, entry)
  const actor = compendium.data?.types.find((type) => type.key === entry.type)?.document === 'actor'
  const playable = Boolean(item?.play && (item.play.actions.length > 0 || item.play.effects.length > 0))
  return (
    <article className={styles.card} aria-labelledby={titleId} data-content-card="" data-open={open || undefined}>
      <div className={styles.line}>
        <BookOpen size={15} aria-hidden="true" className={styles.icon} />
        {/* Una línea, como una mención: su nombre (que despliega lo que hace en juego), su tipo y sus cifras */}
        {playable ? (
          <button
            type="button"
            id={titleId}
            className={styles.name}
            aria-expanded={open}
            onClick={() => setOpen((now) => !now)}
          >
            {entry.name}
            <ChevronDown size={14} aria-hidden="true" className={styles.chevron} />
          </button>
        ) : (
          <span id={titleId} className={styles.name}>
            {entry.name}
          </span>
        )}
        <span className={styles.kind}>
          {entry.world ? t('contentLink.world', { type: entry.typeLabel }) : entry.typeLabel}
        </span>
        {entry.lines.length > 0 && (
          <span className={styles.lines}>{entry.lines.map((line) => `${line.label} ${line.value}`).join(' · ')}</span>
        )}
        {href && (
          <Link to={href} className={styles.open}>
            {t('contentLink.openShort')}
          </Link>
        )}
      </div>
      {open && item?.play && (
        <div className={styles.more}>
          <InPlay
            play={item.play}
            titleId={titleId}
            {...(campaignId && compendium.data && dice
              ? {
                  rolling: {
                    campaignId,
                    entryKey: entry.key,
                    actor,
                    visibility: visibilityIn(dice?.visibility ?? 'all', readAs ? 'player' : 'master')
                  }
                }
              : {})}
          />
        </div>
      )}
    </article>
  )
}

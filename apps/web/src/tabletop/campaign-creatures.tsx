/**
 * Las criaturas de la campaña, en la pestaña Personajes de la Mesa (como los actores del mundo en Foundry VTT): las que
 * se han puesto en juego, con su hoja (en ventana), si las ven los jugadores y su «+» para ponerlas en el mapa. Lo que
 * se arrastra aquí desde el compendio pasa a la campaña
 */
import type { CampaignTableView } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, Plus } from 'lucide-react'
import { type DragEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { FormError } from '../components/field.tsx'
import { useWindows } from '../components/windows.tsx'
import styles from './compendium-tab.module.css'
import { CONTENT_DRAG, readContentDrag } from './drags.ts'
import { matches, PLACING_TYPE, type Placing } from './panel.tsx'
import { sheetWindow } from './token-sheet.tsx'
import { initialOf } from './tokens.ts'

export function CampaignCreatures({
  campaignId,
  systemId,
  table,
  canPlace,
  onPlace,
  query = '',
  include,
  quiet = false
}: {
  campaignId: string
  systemId: string | null
  table: CampaignTableView | null
  canPlace: boolean
  onPlace: (placing: Placing) => void
  /** Lo que se busca en la pestaña */
  query?: string
  /** Solo estas (las de una carpeta, o las que no están en ninguna) */
  include?: (id: string) => boolean
  /** Sin el aviso de vacía (dentro de una carpeta) */
  quiet?: boolean
}) {
  const { t } = useTranslation()
  const api = useApi()
  const client = useQueryClient()
  const errorText = useErrorText()
  const windows = useWindows()
  const [over, setOver] = useState(false)
  const inPlay = useQuery({
    queryKey: ['creatures', campaignId],
    queryFn: () => api.call('listInPlay', { campaignId })
  })
  const refresh = () => client.invalidateQueries({ queryKey: ['creatures', campaignId] })
  const hiding = useMutation({
    mutationFn: ({ creatureId, hidden }: { creatureId: string; hidden: boolean }) =>
      api.call('setCreatureHidden', { creatureId, hidden }),
    onSuccess: refresh
  })
  const add = useMutation({
    mutationFn: (key: string) => api.call('putInPlay', { campaignId, key }),
    onSuccess: refresh
  })
  const onMap = new Set((table?.tokens ?? []).map((token) => token.actor.id))
  const creatures = (inPlay.data?.creatures ?? []).filter((c) => matches(c.name, query) && (include?.(c.id) ?? true))
  const error = hiding.error ?? add.error
  if (quiet && creatures.length === 0) return null
  const accepts = (event: DragEvent) => event.dataTransfer.types.includes(CONTENT_DRAG)
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: se suelta aquí lo del compendio; con teclado, el compendio pone en el mapa
    <div
      className={styles.drop}
      data-over={over || undefined}
      onDragOver={(event) => {
        if (!accepts(event)) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
        setOver(true)
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false)
      }}
      onDrop={(event) => {
        setOver(false)
        const content = readContentDrag(event.dataTransfer)
        if (!content) return
        event.preventDefault()
        // Solo las criaturas pasan a la campaña; un objeto va a una ficha o al grupo
        if (content.actor) add.mutate(content.key)
      }}
    >
      {creatures.length === 0 ? (
        <p className={styles.muted}>{t('tabletop.campaignCreatures.empty')}</p>
      ) : (
        <ul className={styles.rows} aria-label={t('tabletop.campaignCreatures.title')}>
          {creatures.map((creature) => {
            const placed = onMap.has(creature.id)
            const placing: Placing = { kind: 'creature', id: creature.id }
            return (
              <li
                key={creature.id}
                className={styles.row}
                draggable={canPlace && !placed}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'copy'
                  event.dataTransfer.setData(PLACING_TYPE, JSON.stringify(placing))
                }}
              >
                <span className={styles.avatar} data-actor="" aria-hidden="true">
                  {initialOf(creature.name)}
                </span>
                <button
                  type="button"
                  className={styles.name}
                  onClick={() =>
                    windows?.open(
                      sheetWindow({ kind: 'creature', id: creature.id, name: creature.name }, campaignId, systemId)
                    )
                  }
                >
                  <b>{creature.name}</b>
                  <small>
                    {[
                      placed ? t('tabletop.onMap') : null,
                      creature.hidden ? t('inPlay.hidden') : null,
                      creature.life
                        ? t('tokens.lifeValue', { value: creature.life.value, max: creature.life.max })
                        : null
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </small>
                </button>
                <button
                  type="button"
                  className={styles.icon}
                  aria-pressed={creature.hidden ?? false}
                  aria-label={t('inPlay.hideFor', { name: creature.name })}
                  title={t(creature.hidden ? 'inPlay.hiddenNote' : 'inPlay.visibleNote')}
                  onClick={() => hiding.mutate({ creatureId: creature.id, hidden: !creature.hidden })}
                >
                  {creature.hidden ? <EyeOff aria-hidden="true" size={15} /> : <Eye aria-hidden="true" size={15} />}
                </button>
                {!placed && (
                  <button
                    type="button"
                    className={styles.icon}
                    disabled={!canPlace}
                    aria-label={t('tabletop.place', { name: creature.name })}
                    title={t('tabletop.place', { name: creature.name })}
                    onClick={() => onPlace(placing)}
                  >
                    <Plus aria-hidden="true" size={15} />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <FormError message={error ? errorText(error) : null} />
    </div>
  )
}

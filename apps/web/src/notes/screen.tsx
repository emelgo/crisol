/**
 * La pantalla de las notas en el espacio de la campaña: «Mis notas» de quien juega o, para el máster, las de un
 * jugador (?de=), solo de lectura. En lo ancho, el árbol a la izquierda y la nota en el centro; en el móvil, la lista
 * y la nota a pantalla completa
 */
import type { Campaign } from '@crisol/contracts'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { NotebookPen } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { Screen } from '../components/screen.tsx'
import { Tour } from '../components/tour.tsx'
import { useDice } from '../dice/context.tsx'
import { WithCampaign } from '../routes/campaign.tsx'
import { useNarrow } from '../wiki/panel.tsx'
import styles from './notes.module.css'
import { BackToList, NotePane, NoteTree, useNotes } from './notes.tsx'

const route = getRouteApi('/mundos/$worldId/campanas/$campaignId/notas')

export function NotesScreen() {
  return (
    <WithCampaign>
      {({ worldId, campaign }) => <Notes key={campaign.id} worldId={worldId} campaign={campaign} />}
    </WithCampaign>
  )
}

function Notes({ worldId, campaign }: { worldId: string; campaign: Campaign }) {
  const { t } = useTranslation()
  const api = useApi()
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const narrow = useNarrow()
  const { setCampaign } = useDice()
  useEffect(() => setCampaign(worldId, campaign.id), [setCampaign, worldId, campaign.id])
  const master = campaign.role === 'master'
  // El máster lee las de un jugador; quien juega, las suyas
  const userId = master ? search.de : undefined
  const members = useQuery({
    queryKey: ['members', campaign.id],
    queryFn: () => api.call('listMembers', { campaignId: campaign.id }),
    enabled: master
  })
  const whose = members.data?.members.find((m) => m.userId === userId)
  const notes = useNotes(campaign.id, userId)
  const selected = search.nota ?? null
  // En lo ancho, sin una elegida, la primera
  const first = notes.data?.notes[0]?.id
  useEffect(() => {
    if (!narrow && !selected && first) void navigate({ search: (s) => ({ ...s, nota: first }), replace: true })
  }, [narrow, selected, first, navigate])
  const open = (id: string | null) =>
    void navigate({ search: (s) => ({ ...s, ...(id ? { nota: id } : { nota: undefined }) }) })

  if (master && !userId) return <ChoosePlayer worldId={worldId} campaign={campaign} />
  const title = master ? t('notes.ofPlayer', { name: whose?.name ?? '' }) : t('notes.title')
  const tree = (
    <NoteTree
      campaignId={campaign.id}
      userId={userId}
      selected={selected}
      onOpen={(n) => open(n.id)}
      editable={!master}
    />
  )
  const pane = selected ? (
    <NotePane
      key={selected}
      worldId={worldId}
      campaignId={campaign.id}
      noteId={selected}
      back={narrow ? <BackToList onBack={() => open(null)} label={t('notes.backToList')} /> : undefined}
    />
  ) : (
    notes.data && notes.data.notes.length === 0 && !master && <p className={styles.quiet}>{t('notes.empty')}</p>
  )
  const steps = [
    { target: '[data-tour="notas-lista"]', text: t('tour.notes.list') },
    { target: '[data-tour="notas-texto"]', text: t('tour.notes.text') }
  ]
  // En el móvil: la lista o la nota, a pantalla completa
  if (narrow)
    return (
      <div className={styles.mobile} data-open={selected ? '' : undefined}>
        {selected ? pane : <Screen title={title}>{tree}</Screen>}
        {!master && <Tour id="notas" steps={steps} />}
      </div>
    )
  return (
    <Screen title={title} left={tree} leftLabel={t('notes.list')} className={styles.screen}>
      {pane}
      {!master && <Tour id="notas" steps={steps} />}
    </Screen>
  )
}

/** El máster, sin jugador elegido: los de la campaña, para leer las de uno */
function ChoosePlayer({ worldId, campaign }: { worldId: string; campaign: Campaign }) {
  const { t } = useTranslation()
  const api = useApi()
  const members = useQuery({
    queryKey: ['members', campaign.id],
    queryFn: () => api.call('listMembers', { campaignId: campaign.id })
  })
  const players = (members.data?.members ?? []).filter((m) => m.role === 'player')
  return (
    <Screen title={t('notes.players')}>
      {members.data && players.length === 0 && <p className={styles.quiet}>{t('campaignHome.noPlayers')}</p>}
      <ul className={styles.players}>
        {players.map((player) => (
          <li key={player.userId}>
            <Link
              to="/mundos/$worldId/campanas/$campaignId/notas"
              params={{ worldId, campaignId: campaign.id }}
              search={{ de: player.userId }}
              className={styles.player}
            >
              <NotebookPen aria-hidden="true" size={16} />
              {t('notes.ofPlayer', { name: player.name })}
            </Link>
          </li>
        ))}
      </ul>
    </Screen>
  )
}

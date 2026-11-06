/**
 * «Revelar» en partida (docs/specs/revelar.md): en la cabecera de un secreto («Secreto · Revelar» o «Lo saben: Lía y
 * Bram · Cambiar») y en la de una página. Su desplegable: la campaña (si hay varias), toda o unos personajes y, si no
 * conocen la página donde está, «Revelar también la página». Revelar avisa a quien le aparece; «Ocultar otra vez» se
 * lo quita
 */
import type { Page } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import list from '../components/list.module.css'
import styles from './reveal.module.css'

export const secretsKey = (worldId: string, pageId: string) => ['pages', worldId, 'secrets', pageId]

type Audience = 'none' | 'all' | { id: string; name: string }[]

/** Quién conoce los secretos de la página y qué campañas hay, para las cabeceras */
export function useSecretsKnowledge(worldId: string, pageId: string, enabled = true) {
  const api = useApi()
  return useQuery({
    queryKey: secretsKey(worldId, pageId),
    queryFn: () => api.call('getSecretsKnowledge', { pageId }),
    enabled: enabled && Boolean(worldId && pageId)
  })
}

/** Abre y cierra un desplegable que flota junto a su botón; pulsar fuera lo cierra */
function usePopover() {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const outside = (event: Event) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  return { open, setOpen, wrap }
}

/** La cabecera de un secreto, para quien lleva la wiki: a quién se le ha revelado y «Revelar» o «Cambiar» */
export function SecretReveal({ worldId, pageId, documentId }: { worldId: string; pageId: string; documentId: string }) {
  const { t } = useTranslation()
  const known = useSecretsKnowledge(worldId, pageId)
  const { open, setOpen, wrap } = usePopover()
  if (!known.data || known.data.campaigns.length === 0) return null
  const secret = known.data.secrets.find((s) => s.documentId === documentId)
  const shown = (secret?.campaigns ?? []).filter((c) => c.audience !== 'none')
  const names = shown.flatMap((c) =>
    c.audience === 'all'
      ? [known.data?.campaigns.find((k) => k.campaignId === c.campaignId)?.name ?? '']
      : (c.audience as { name: string }[]).map((ch) => ch.name)
  )
  return (
    <div ref={wrap} className={styles.wrap} contentEditable={false}>
      {names.length > 0 && <span className={styles.who}>{t('reveal.knownBy', { names: names.join(', ') })}</span>}
      <button type="button" className={styles.link} aria-expanded={open} onClick={() => setOpen(!open)}>
        {t(names.length > 0 ? 'reveal.change' : 'reveal.reveal')}
      </button>
      {open && (
        <RevealMenu
          worldId={worldId}
          kind="secret"
          targetId={documentId}
          campaigns={known.data.campaigns}
          current={(campaignId) => secret?.campaigns.find((c) => c.campaignId === campaignId)?.audience ?? 'none'}
          onDone={() => setOpen(false)}
        />
      )}
    </div>
  )
}

/** «Revelar…» de un pin o de una pestaña (en su panel o su menú): con aviso, como un secreto */
export function TargetReveal({
  worldId,
  pageId,
  kind,
  targetId
}: {
  worldId: string
  pageId: string
  kind: 'pin' | 'tab'
  targetId: string
}) {
  const { t } = useTranslation()
  const known = useSecretsKnowledge(worldId, pageId)
  const { open, setOpen, wrap } = usePopover()
  if (!known.data || known.data.campaigns.length === 0) return null
  return (
    <div ref={wrap} className={styles.wrapInline}>
      <button type="button" className={styles.link} aria-expanded={open} onClick={() => setOpen(!open)}>
        {t('reveal.revealMore')}
      </button>
      {open && (
        <RevealMenu
          worldId={worldId}
          kind={kind}
          targetId={targetId}
          campaigns={known.data.campaigns}
          current={() => 'none'}
          onDone={() => setOpen(false)}
          inline
        />
      )}
    </div>
  )
}

/** «Revelar» en la cabecera de una página: la página entera, con aviso */
export function PageRevealButton({ page }: { page: Page }) {
  const { t } = useTranslation()
  const known = useSecretsKnowledge(page.worldId, page.id)
  const { open, setOpen, wrap } = usePopover()
  if (!known.data || known.data.campaigns.length === 0) return null
  return (
    <div ref={wrap} className={styles.wrap} data-action-wrap="">
      <button
        type="button"
        className={list.secondary}
        aria-label={t('reveal.page')}
        title={t('reveal.page')}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Eye aria-hidden="true" size={18} />
      </button>
      {open && (
        <RevealMenu
          worldId={page.worldId}
          kind="page"
          targetId={page.id}
          campaigns={known.data.campaigns}
          current={(campaignId) => known.data?.campaigns.find((c) => c.campaignId === campaignId)?.seesPage ?? 'none'}
          onDone={() => setOpen(false)}
          floating
        />
      )}
    </div>
  )
}

type Campaigns = NonNullable<ReturnType<typeof useSecretsKnowledge>['data']>['campaigns']

function RevealMenu({
  worldId,
  kind,
  targetId,
  campaigns,
  current,
  onDone,
  floating = false,
  inline = false
}: {
  worldId: string
  kind: 'secret' | 'page' | 'pin' | 'tab'
  targetId: string
  campaigns: Campaigns
  /** A quién se le ha revelado ya en esa campaña */
  current: (campaignId: string) => Audience
  onDone: () => void
  floating?: boolean
  /** Dentro de un panel que recorta lo que se sale (el de un pin, el menú de una pestaña): sin flotar */
  inline?: boolean
}) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const announce = useAnnounce()
  const errorText = useErrorText()
  const id = useId()
  const [campaignId, setCampaignId] = useState(campaigns[0]?.campaignId ?? '')
  const campaign = campaigns.find((c) => c.campaignId === campaignId)
  const [picked, setPicked] = useState<string[]>([])
  const [alsoPage, setAlsoPage] = useState(true)
  const already = current(campaignId)
  const pageUnknown = kind !== 'page' && campaign?.seesPage === 'none'
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['pages', worldId] })
  const reveal = useMutation({
    mutationFn: () =>
      api.call('reveal', {
        worldId,
        campaignId,
        kind,
        targetId,
        ...(picked.length > 0 ? { characters: picked } : {}),
        ...(pageUnknown ? { alsoPage } : {})
      }),
    onSuccess: async () => {
      announce(t('reveal.done', { campaign: campaign?.name ?? '' }))
      await refresh()
      onDone()
    },
    onError: (error) => announce(errorText(error))
  })
  const hide = useMutation({
    mutationFn: () => api.call('hide', { campaignId, kind, targetId }),
    onSuccess: async () => {
      announce(t('reveal.hidden', { campaign: campaign?.name ?? '' }))
      await refresh()
      onDone()
    },
    onError: (error) => announce(errorText(error))
  })
  const toggle = (characterId: string) =>
    setPicked((now) => (now.includes(characterId) ? now.filter((c) => c !== characterId) : [...now, characterId]))
  return (
    <div
      role="dialog"
      aria-labelledby={`${id}-title`}
      className={inline ? styles.menuInline : floating ? styles.menuRight : styles.menu}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onDone()
        }
      }}
    >
      <h2 id={`${id}-title`} className={styles.title}>
        {t(`reveal.titles.${kind}`)}
      </h2>
      {campaigns.length > 1 && (
        <label className={styles.field}>
          <span>{t('reveal.campaign')}</span>
          <select value={campaignId} onChange={(event) => setCampaignId(event.currentTarget.value)}>
            {campaigns.map((c) => (
              <option key={c.campaignId} value={c.campaignId}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {/* biome-ignore lint/a11y/useSemanticElements: fichas que se marcan, no un formulario */}
      <div className={styles.chips} role="group" aria-label={t('reveal.to')}>
        <button type="button" className={styles.chip} aria-pressed={picked.length === 0} onClick={() => setPicked([])}>
          {t('reveal.everyone')}
        </button>
        {(campaign?.characters ?? []).map((character) => (
          <button
            key={character.id}
            type="button"
            className={styles.chip}
            aria-pressed={picked.includes(character.id)}
            onClick={() => toggle(character.id)}
          >
            {character.name}
          </button>
        ))}
      </div>
      {pageUnknown && (
        <label className={styles.check}>
          <input type="checkbox" checked={alsoPage} onChange={(event) => setAlsoPage(event.currentTarget.checked)} />
          {t('reveal.alsoPage')}
        </label>
      )}
      <div className={styles.actions}>
        <button type="button" className={styles.primary} disabled={reveal.isPending} onClick={() => reveal.mutate()}>
          {t('reveal.reveal')}
        </button>
        {already !== 'none' && (
          <button type="button" className={styles.secondary} disabled={hide.isPending} onClick={() => hide.mutate()}>
            {t('reveal.hideAgain')}
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * «Revelar» en partida (docs/specs/revelar.md): en la cabecera de un secreto («Secreto · Revelar» o «Lo saben: Lía y
 * Bram · Revelar…») y en la de una página. Su desplegable: la campaña (si hay varias), toda o unos personajes y, si
 * alguno no conoce la página donde está, «Revelar también la página». Revelar solo suma (no le quita nada a nadie) y
 * avisa a quien le aparece; «Ocultar otra vez» se lo quita
 */
import type { Page } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useCurrentCampaign } from '../campaign/current-campaign.ts'
import { useAnnounce } from '../components/announcer.tsx'
import list from '../components/list.module.css'
import styles from './reveal.module.css'

export const secretsKey = (worldId: string, pageId: string) => ['pages', worldId, 'secrets', pageId]

type Audience = 'none' | 'all' | { id: string; name: string }[]

/**
 * Quién conoce los secretos de la página y qué campañas hay, para las cabeceras. Desde la Mesa de una campaña, solo
 * ella: se revela a ella sin elegir y se dice quién lo sabe en ella
 */
export function useSecretsKnowledge(worldId: string, pageId: string, enabled = true) {
  const api = useApi()
  const current = useCurrentCampaign()
  return useQuery({
    queryKey: secretsKey(worldId, pageId),
    queryFn: () => api.call('getSecretsKnowledge', { pageId }),
    enabled: enabled && Boolean(worldId && pageId),
    select: current
      ? (data) => ({
          ...data,
          campaigns: data.campaigns.filter((c) => c.campaignId === current),
          secrets: data.secrets.map((s) => ({ ...s, campaigns: s.campaigns.filter((c) => c.campaignId === current) }))
        })
      : undefined
  })
}

/**
 * Abre y cierra un desplegable que flota junto a su botón: pulsar fuera lo cierra; al cerrarlo desde dentro (Escape,
 * revelar) el foco vuelve a su botón. `toggle` va en el botón, con lo que dice que abre un cuadro
 */
function usePopover() {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  useEffect(() => {
    if (!open) return
    const outside = (event: Event) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  const close = () => {
    setOpen(false)
    trigger.current?.focus()
  }
  const toggle = {
    ref: trigger,
    'aria-expanded': open,
    'aria-haspopup': 'dialog' as const,
    'aria-controls': open ? menuId : undefined,
    onClick: () => setOpen(!open)
  }
  return { open, wrap, toggle, menuId, close }
}

/** La cabecera de un secreto, para quien lleva la wiki: a quién se le ha revelado y «Revelar» (o «Revelar…», a más) */
export function SecretReveal({ worldId, pageId, documentId }: { worldId: string; pageId: string; documentId: string }) {
  const { t } = useTranslation()
  const known = useSecretsKnowledge(worldId, pageId)
  const { open, wrap, toggle, menuId, close } = usePopover()
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
      <button type="button" className={styles.link} {...toggle}>
        {t(names.length > 0 ? 'reveal.revealMore' : 'reveal.reveal')}
      </button>
      {open && (
        <RevealMenu
          worldId={worldId}
          kind="secret"
          targetId={documentId}
          campaigns={known.data.campaigns}
          current={(campaignId) => secret?.campaigns.find((c) => c.campaignId === campaignId)?.audience ?? 'none'}
          id={menuId}
          onDone={close}
        />
      )}
    </div>
  )
}

/** «Revelar…» de un pin, de algo dibujado en un mapa o de una pestaña (en su panel o su menú): con aviso, como un secreto */
export function TargetReveal({
  worldId,
  pageId,
  kind,
  targetId
}: {
  worldId: string
  pageId: string
  kind: 'pin' | 'tab' | 'element'
  targetId: string
}) {
  const { t } = useTranslation()
  const known = useSecretsKnowledge(worldId, pageId)
  const { open, wrap, toggle, menuId, close } = usePopover()
  if (!known.data || known.data.campaigns.length === 0) return null
  return (
    <div ref={wrap} className={styles.wrapInline}>
      <button type="button" className={styles.link} {...toggle}>
        {t('reveal.revealMore')}
      </button>
      {open && (
        <RevealMenu
          worldId={worldId}
          kind={kind}
          targetId={targetId}
          campaigns={known.data.campaigns}
          current={() => 'none'}
          id={menuId}
          onDone={close}
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
  const { open, wrap, toggle, menuId, close } = usePopover()
  if (!known.data || known.data.campaigns.length === 0) return null
  return (
    <div ref={wrap} className={styles.wrap} data-action-wrap="">
      <button
        type="button"
        className={list.secondary}
        aria-label={t('reveal.page')}
        title={t('reveal.page')}
        {...toggle}
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
          id={menuId}
          onDone={close}
          floating
        />
      )}
    </div>
  )
}

type Campaigns = NonNullable<ReturnType<typeof useSecretsKnowledge>['data']>['campaigns']

function RevealMenu({
  id: menuId,
  worldId,
  kind,
  targetId,
  campaigns,
  current,
  onDone,
  floating = false,
  inline = false
}: {
  id: string
  worldId: string
  kind: 'secret' | 'page' | 'pin' | 'tab' | 'element'
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
  // ¿Hay alguien de los elegidos (o de toda la campaña) que no sepa la página donde está?
  const seesPage = campaign?.seesPage ?? 'none'
  const pageUnknown =
    kind !== 'page' &&
    seesPage !== 'all' &&
    (seesPage === 'none' || picked.length === 0 || picked.some((id) => !seesPage.some((c) => c.id === id)))
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
  // Al abrirse, el foco entra en él (lo primero que se elige)
  const menu = useRef<HTMLDivElement>(null)
  useEffect(() => {
    menu.current?.querySelector<HTMLElement>('select, button')?.focus()
  }, [])
  return (
    <div
      ref={menu}
      id={menuId}
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
          <select
            value={campaignId}
            onChange={(event) => {
              // Otra campaña, otros personajes
              setCampaignId(event.currentTarget.value)
              setPicked([])
            }}
          >
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

/**
 * «Quién la conoce» (ADR-0017, docs/specs/conocimiento.md): en la cabecera de una página, lo que ve cada campaña del
 * mundo y por qué, y la marca de cada capa (el mundo y cada campaña). Marcar aquí es preparar: no avisa a nadie (eso es
 * «Revelar»). Al pie, «Ver como…» para leer la página como un personaje
 */
import type { Page, PageKnowledge } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Eye, EyeOff, Shield, Users, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import list from '../components/list.module.css'
import styles from './who-knows.module.css'

export const knowledgeKey = (worldId: string, pageId: string) => ['pages', worldId, 'knowledge', pageId]

type CampaignRow = PageKnowledge['campaigns'][number]
type Choice = 'inherit' | 'all' | 'some' | 'none'

const choiceOf = (row: CampaignRow): Choice =>
  !row.own ? 'inherit' : !row.own.known ? 'none' : row.own.characters ? 'some' : 'all'

export function WhoKnowsButton({ page }: { page: Page }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const close = () => {
    setOpen(false)
    button.current?.focus()
  }
  useEffect(() => {
    if (!open) return
    const outside = (event: Event) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  return (
    <div ref={wrap} className={styles.wrap} data-action-wrap="">
      <button
        ref={button}
        type="button"
        className={list.secondary}
        aria-label={t('whoKnows.title')}
        title={t('whoKnows.title')}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        data-tour="quien-la-conoce"
      >
        <Users aria-hidden="true" size={18} />
      </button>
      {open && <WhoKnows page={page} onClose={close} />}
    </div>
  )
}

function WhoKnows({ page, onClose }: { page: Page; onClose: () => void }) {
  const { t } = useTranslation()
  const api = useApi()
  const id = useId()
  const known = useQuery({
    queryKey: knowledgeKey(page.worldId, page.id),
    queryFn: () => api.call('getPageKnowledge', { pageId: page.id })
  })
  return (
    <div
      role="dialog"
      aria-labelledby={`${id}-title`}
      className={styles.menu}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onClose()
        }
      }}
    >
      <div className={styles.header}>
        <h2 id={`${id}-title`} className={styles.title}>
          {t('whoKnows.title')}
        </h2>
        <button type="button" className={styles.close} aria-label={t('whoKnows.close')} onClick={onClose}>
          <X aria-hidden="true" size={16} />
        </button>
      </div>
      {known.data && (
        <>
          {known.data.campaigns.map((row) => (
            <CampaignLine key={row.campaignId} page={page} row={row} />
          ))}
          {known.data.campaigns.length > 0 && <ViewAs page={page} campaigns={known.data.campaigns} />}
        </>
      )}
    </div>
  )
}

/** Poner o quitar una marca de la página, y volver a pedir lo que ve cada campaña */
function useMark(page: Page) {
  const api = useApi()
  const queryClient = useQueryClient()
  const announce = useAnnounce()
  const errorText = useErrorText()
  return useMutation({
    mutationFn: (input: { campaignId: string | null; known: boolean | null; characters?: string[] | null }) =>
      api.call('setKnowledge', {
        worldId: page.worldId,
        kind: 'page',
        targetId: page.id,
        campaignId: input.campaignId,
        known: input.known,
        ...(input.characters ? { characters: input.characters } : {})
      }),
    onSuccess: (result) => {
      if (result.page) queryClient.setQueryData(knowledgeKey(page.worldId, page.id), result.page)
      void queryClient.invalidateQueries({ queryKey: ['pages', page.worldId, 'known'] })
    },
    onError: (error) => announce(errorText(error))
  })
}

/** De dónde viene lo que se ve: marcada aquí, por una madre o porque lo sabe el mundo */
function Source({ from, pageId }: { from: CampaignRow['from']; pageId: string }) {
  const { t } = useTranslation()
  if (!from) return null
  if (from.pageId === pageId)
    return <span className={styles.why}>{t(from.layer === 'world' ? 'whoKnows.byWorld' : 'whoKnows.here')}</span>
  return (
    <span className={styles.why}>
      {from.layer === 'world' ? t('whoKnows.byWorld') : t('whoKnows.by', { title: from.title })}
    </span>
  )
}

function CampaignLine({ page, row }: { page: Page; row: CampaignRow }) {
  const { t } = useTranslation()
  const mark = useMark(page)
  const [choice, setChoice] = useState<Choice>(choiceOf(row))
  useEffect(() => setChoice(choiceOf(row)), [row])
  const picked = row.own?.characters ?? []
  const toggle = (characterId: string) => {
    const next = picked.includes(characterId) ? picked.filter((c) => c !== characterId) : [...picked, characterId]
    mark.mutate(
      next.length > 0
        ? { campaignId: row.campaignId, known: true, characters: next }
        : { campaignId: row.campaignId, known: null }
    )
  }
  const audience =
    row.audience === 'all'
      ? t('whoKnows.sees.all')
      : row.audience === 'none'
        ? t('whoKnows.sees.none')
        : t('whoKnows.sees.some', { names: row.audience.map((c) => c.name).join(', ') })
  return (
    <section className={styles.row} aria-label={row.name}>
      <div className={styles.rowHead}>
        <Shield aria-hidden="true" size={15} />
        <span className={styles.name}>{row.name}</span>
        <select
          className={styles.select}
          aria-label={t('whoKnows.campaignChoice', { name: row.name })}
          value={choice}
          disabled={mark.isPending}
          onChange={(event) => {
            const next = event.target.value as Choice
            setChoice(next)
            // «Lo saben…»: se eligen los personajes debajo (hasta entonces no cambia nada)
            if (next === 'some') return
            mark.mutate({ campaignId: row.campaignId, known: next === 'inherit' ? null : next === 'all' })
          }}
        >
          {/* Solo por campaña: el mundo entero no se revela (Enrique, 2026-11-16) */}
          <option value="inherit">{t('whoKnows.asParent')}</option>
          <option value="all">{t('whoKnows.campaignAll')}</option>
          <option value="some" disabled={row.characters.length === 0}>
            {t('whoKnows.campaignSome')}
          </option>
          <option value="none">{t('whoKnows.campaignNone')}</option>
        </select>
      </div>
      {choice === 'some' && (
        // biome-ignore lint/a11y/useSemanticElements: un grupo de fichas que se marcan, no un formulario
        <div className={styles.chips} role="group" aria-label={t('whoKnows.characters', { name: row.name })}>
          {row.characters.map((character) => (
            <button
              key={character.id}
              type="button"
              className={styles.chip}
              aria-pressed={picked.includes(character.id)}
              disabled={mark.isPending}
              onClick={() => toggle(character.id)}
            >
              {character.name}
            </button>
          ))}
        </div>
      )}
      <p className={styles.state} data-known={row.audience !== 'none' || undefined}>
        {row.audience === 'none' ? <EyeOff aria-hidden="true" size={13} /> : <Eye aria-hidden="true" size={13} />}
        <span>{audience}</span>
        {!row.knowsWorld && !row.from ? (
          <span className={styles.why}>{t('whoKnows.fromScratch')}</span>
        ) : (
          <Source from={row.from} pageId={page.id} />
        )}
      </p>
      <Editors page={page} row={row} />
    </section>
  )
}

/**
 * Quién de la campaña puede escribir en la página (docs/specs/pagina-de-jugadores.md): nadie, toda o unos personajes.
 * Quien la edita la ve; una página con secretos no se deja (lo dice el servidor)
 */
function Editors({ page, row }: { page: Page; row: CampaignRow }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const announce = useAnnounce()
  const errorText = useErrorText()
  const now: Choice = row.editors === 'none' ? 'none' : row.editors === 'all' ? 'all' : 'some'
  const [choice, setChoice] = useState<Choice>(now)
  useEffect(() => setChoice(now), [now])
  const save = useMutation({
    mutationFn: (editors: 'all' | string[] | null) =>
      api.call('setPageEditors', { worldId: page.worldId, campaignId: row.campaignId, pageId: page.id, editors }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: knowledgeKey(page.worldId, page.id) }),
        queryClient.invalidateQueries({ queryKey: ['pages', page.worldId] })
      ]),
    onError: (error) => {
      setChoice(now)
      announce(errorText(error))
    }
  })
  const picked = Array.isArray(row.editors) ? row.editors.map((c) => c.id) : []
  const toggle = (characterId: string) => {
    const next = picked.includes(characterId) ? picked.filter((c) => c !== characterId) : [...picked, characterId]
    save.mutate(next.length > 0 ? next : null)
  }
  return (
    <div className={styles.editors}>
      <select
        className={styles.select}
        aria-label={t('whoKnows.editors', { name: row.name })}
        value={choice}
        disabled={save.isPending}
        onChange={(event) => {
          const next = event.target.value as Choice
          setChoice(next)
          if (next === 'some') return
          save.mutate(next === 'all' ? 'all' : null)
        }}
      >
        <option value="none">{t('whoKnows.editNobody')}</option>
        <option value="all">{t('whoKnows.editAll')}</option>
        <option value="some" disabled={row.characters.length === 0}>
          {t('whoKnows.editSome')}
        </option>
      </select>
      {choice === 'some' && (
        // biome-ignore lint/a11y/useSemanticElements: un grupo de fichas que se marcan, no un formulario
        <div className={styles.chips} role="group" aria-label={t('whoKnows.editorsOf', { name: row.name })}>
          {row.characters.map((character) => (
            <button
              key={character.id}
              type="button"
              className={styles.chip}
              aria-pressed={picked.includes(character.id)}
              disabled={save.isPending}
              onClick={() => toggle(character.id)}
            >
              {character.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** «Ver como…»: la página como la lee un personaje (o la campaña, sin excepciones) */
function ViewAs({ page, campaigns }: { page: Page; campaigns: CampaignRow[] }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <div className={styles.footer}>
      <label className={styles.viewAs}>
        <span>{t('whoKnows.viewAs')}</span>
        <select
          className={styles.select}
          value=""
          onChange={(event) => {
            const [campaignId, como] = event.target.value.split('|')
            if (!campaignId || !como) return
            void navigate({
              to: '/mundos/$worldId/campanas/$campaignId/paginas/$pageId',
              params: { worldId: page.worldId, campaignId, pageId: page.id },
              search: { como }
            })
          }}
        >
          <option value="">{t('whoKnows.viewAsPick')}</option>
          {campaigns.map((campaign) => (
            <optgroup key={campaign.campaignId} label={campaign.name}>
              <option value={`${campaign.campaignId}|campaign`}>{t('whoKnows.theCampaign')}</option>
              {campaign.characters.map((character) => (
                <option key={character.id} value={`${campaign.campaignId}|${character.id}`}>
                  {character.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
    </div>
  )
}

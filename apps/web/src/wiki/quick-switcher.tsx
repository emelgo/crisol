/**
 * El selector rápido (Ctrl+K o Cmd+K): un diálogo con un campo y una lista (patrón combobox de ARIA). Vacío, las
 * páginas recientes; al escribir, títulos y alias con erratas a los 250 ms, y al final «Ver todos los resultados». Con
 * «>» delante, la paleta de órdenes. Escape lo cierra y el foco vuelve a donde estaba
 */
import { foldName, searchNames } from '@crisol/domain'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { preferencesKey } from './navigation.tsx'
import styles from './quick-switcher.module.css'

type Choice =
  | { kind: 'page'; id: string; title: string; hint: string }
  | { kind: 'all'; query: string }
  | { kind: 'command'; id: string; label: string; run: () => void }

const keyOf = (choice: Choice) =>
  choice.kind === 'page' ? `p:${choice.id}` : choice.kind === 'all' ? 'todos' : `o:${choice.id}`

/** Abre el selector con Ctrl+K (o Cmd+K) desde cualquier pantalla de la wiki */
export function QuickSwitcher({ worldId, onCreatePage }: { worldId: string; onCreatePage: () => void }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const listen = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', listen)
    return () => window.removeEventListener('keydown', listen)
  }, [])
  if (!open) return null
  return <SwitcherDialog worldId={worldId} onCreatePage={onCreatePage} onClose={() => setOpen(false)} />
}

function SwitcherDialog({
  worldId,
  onCreatePage,
  onClose
}: {
  worldId: string
  onCreatePage: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const navigate = useNavigate()
  const dialog = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const listId = useId()
  const [text, setText] = useState('')
  // Lo que se busca, a los 250 ms de dejar de escribir
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<string | null>(null)
  const names = useQuery({
    queryKey: ['pages', worldId, 'names'],
    queryFn: () => api.call('listPageNames', { worldId })
  })
  const preferences = useQuery({
    queryKey: preferencesKey(worldId),
    queryFn: () => api.call('getWikiPreferences', { worldId })
  })

  // Al abrirse, modal y con el foco en el campo; al cerrarse, el foco vuelve a donde estaba
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    dialog.current?.showModal()
    input.current?.focus()
    return () => before?.focus()
  }, [])
  useEffect(() => {
    const timer = setTimeout(() => setQuery(text), text.startsWith('>') ? 0 : 250)
    return () => clearTimeout(timer)
  }, [text])

  const close = () => {
    dialog.current?.close()
    onClose()
  }
  const go = (to: string, params: Record<string, string>, search?: Record<string, string>) => {
    close()
    void navigate({ to, params, ...(search ? { search } : {}) } as never)
  }

  const commands: Choice[] = [
    {
      kind: 'command',
      id: 'new',
      label: t('switcher.commands.newPage'),
      run: () => {
        close()
        onCreatePage()
      }
    },
    {
      kind: 'command',
      id: 'search',
      label: t('switcher.commands.search'),
      run: () => go('/mundos/$worldId/buscar', { worldId })
    },
    {
      kind: 'command',
      id: 'files',
      label: t('switcher.commands.files'),
      run: () => go('/mundos/$worldId/archivos', { worldId })
    },
    {
      kind: 'command',
      id: 'tags',
      label: t('switcher.commands.tags'),
      run: () => go('/etiquetas', {})
    },
    {
      kind: 'command',
      id: 'history',
      label: t('switcher.commands.history'),
      run: () => go('/mundos/$worldId/historial', { worldId })
    },
    {
      kind: 'command',
      id: 'trash',
      label: t('switcher.commands.trash'),
      run: () => go('/mundos/$worldId/papelera', { worldId })
    }
  ]

  const pages = names.data?.pages ?? []
  const byId = new Map(pages.map((page) => [page.id, page]))
  const where = (path: readonly string[]) => path.slice(0, -1).join(' / ')
  /** Lo que se ofrece para un texto: las órdenes con «>», los recientes si está vacío, o las páginas que se llaman así */
  const choicesFor = (value: string): Choice[] => {
    if (value.startsWith('>')) {
      const wanted = foldName(value.slice(1))
      return commands.filter((command) => command.kind === 'command' && foldName(command.label).includes(wanted))
    }
    if (value.trim() === '') {
      // Los recientes: las pestañas abiertas, de la última a la primera
      return [...(preferences.data?.tabs ?? [])]
        .reverse()
        .flatMap((tab) => {
          const page = byId.get(tab.pageId)
          return page ? [{ kind: 'page' as const, id: page.id, title: page.title, hint: where(page.path) }] : []
        })
        .slice(0, 8)
    }
    return [
      ...searchNames(value, pages, 8).map(({ page, name }) => ({
        kind: 'page' as const,
        id: page.id,
        title: page.title,
        hint: name !== page.title ? t('links.aliasOf', { name }) : where(page.path)
      })),
      { kind: 'all', query: value.trim() }
    ]
  }
  // Las órdenes, al momento; las páginas, a los 250 ms de dejar de escribir
  const choices = choicesFor(text.startsWith('>') ? text : query)
  const current = choices.find((choice) => keyOf(choice) === active) ?? choices[0]
  const optionId = (choice: Choice) => `${listId}-${choices.indexOf(choice)}`

  const pick = (choice: Choice) => {
    if (choice.kind === 'page') go('/mundos/$worldId/wiki/$pageId', { worldId, pageId: choice.id })
    else if (choice.kind === 'all') go('/mundos/$worldId/buscar', { worldId }, { q: choice.query })
    else choice.run()
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (choices.length === 0) return
      const index = current ? choices.indexOf(current) : -1
      const next = choices[(index + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length]
      setActive(next ? keyOf(next) : null)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      // Con lo escrito ahora, aunque la lista aún no se haya puesto al día
      const fresh = text === query || text.startsWith('>') ? choices : choicesFor(text)
      const chosen = fresh.find((choice) => keyOf(choice) === active) ?? fresh[0]
      if (chosen) pick(chosen)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      close()
    }
  }

  const commandMode = text.startsWith('>')
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: pulsar el fondo es un atajo; con el teclado, Escape (lo da el diálogo)
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-label={t(commandMode ? 'switcher.commandsTitle' : 'switcher.title')}
      onClose={onClose}
      onClick={(event) => {
        // Pulsar fuera (en el fondo del diálogo) lo cierra
        if (event.target === dialog.current) close()
      }}
    >
      <input
        ref={input}
        className={styles.input}
        role="combobox"
        aria-expanded={choices.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={current ? optionId(current) : undefined}
        aria-label={t('switcher.label')}
        placeholder={t('switcher.placeholder')}
        value={text}
        onChange={(event) => {
          setText(event.currentTarget.value)
          setActive(null)
        }}
        onKeyDown={onKeyDown}
      />
      <div id={listId} role="listbox" aria-label={t(commandMode ? 'switcher.commandsTitle' : 'switcher.results')}>
        {choices.map((choice) => (
          <div
            key={keyOf(choice)}
            id={optionId(choice)}
            role="option"
            aria-selected={choice === current}
            tabIndex={-1}
            className={styles.option}
            onMouseDown={(event) => {
              event.preventDefault()
              pick(choice)
            }}
          >
            {choice.kind === 'page' ? (
              <>
                <span>{choice.title}</span>
                <span className={styles.hint}>{choice.hint}</span>
              </>
            ) : choice.kind === 'all' ? (
              <span>{t('switcher.all', { query: choice.query })}</span>
            ) : (
              <span>{choice.label}</span>
            )}
          </div>
        ))}
      </div>
      {choices.length === 0 && (
        <p className={styles.empty}>
          {commandMode ? t('switcher.noCommand') : query.trim() === '' ? t('switcher.noRecent') : t('switcher.none')}
        </p>
      )}
      <p className={styles.help}>{t('switcher.help')}</p>
    </dialog>
  )
}

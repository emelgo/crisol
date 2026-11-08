/**
 * «Página nueva» (y «Nueva subpágina»): un cuadro como el de «Pestaña nueva», con el tipo (texto, un mapa o desde
 * plantilla; lo demás, pronto) y el título. Sin título, la página se abre para ponérselo en el sitio
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Clock, FileText, LayoutTemplate, Map as MapIcon, Network, PenTool } from 'lucide-react'
import { createContext, useContext, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { BusyButton } from '../components/busy-button.tsx'
import dialogStyles from '../components/dialog.module.css'
import { FormError } from '../components/field.tsx'
import form from '../components/form.module.css'
import { Modal } from '../components/modal.tsx'
import { TemplatePicker } from '../templates/picker.tsx'
import styles from './tabs/page-tabs.module.css'

const KINDS = [
  { kind: 'text', icon: FileText, ready: true },
  { kind: 'map', icon: MapIcon, ready: true },
  { kind: 'template', icon: LayoutTemplate, ready: true },
  { kind: 'board', icon: PenTool, ready: false },
  { kind: 'timeline', icon: Clock, ready: false },
  { kind: 'tree', icon: Network, ready: false }
] as const

type Kind = (typeof KINDS)[number]['kind']

/** Abrir el cuadro: en el primer nivel (null) o dentro de una página */
export type NewPageRequest = (parent: { id: string; title: string } | null) => void

export const NewPageContext = createContext<NewPageRequest>(() => undefined)
export const useNewPage = () => useContext(NewPageContext)

export function NewPageDialog({
  worldId,
  parent,
  onClose
}: {
  worldId: string
  parent: { id: string; title: string } | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const errorText = useErrorText()
  const [kind, setKind] = useState<Kind>('text')
  const [title, setTitle] = useState('')
  const [template, setTemplate] = useState<string | null>(null)
  const titleId = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const create = useMutation({
    mutationFn: async () => {
      const named = title.trim()
      const page = await api.call('createPage', {
        worldId,
        title: named || t('wiki.untitled'),
        parentId: parent?.id ?? null,
        ...(kind === 'template' && template ? { template } : {})
      })
      // Si la pestaña falla, la página ya está: se abre igual (sin mapa) en vez de dejar el cuadro para crear otra
      const tab =
        kind === 'map' ? await api.call('createPageTab', { pageId: page.id, kind: 'map' }).catch(() => null) : null
      return { page, tab, named }
    },
    onSuccess: async ({ page, tab, named }) => {
      await queryClient.invalidateQueries({ queryKey: ['pages', worldId] })
      dialog.current?.close()
      // Cerrado del todo, aunque el cuadro no avise (si no, la próxima vez no se abriría)
      onClose()
      await navigate({
        to: '/mundos/$worldId/wiki/$pageId',
        params: { worldId, pageId: page.id },
        // Sin título, se abre para escribirlo; un mapa, con su pestaña abierta
        search: { ...(named ? {} : { nuevo: true }), ...(tab ? { pestana: tab.id } : {}) }
      })
    }
  })
  return (
    <Modal
      ref={dialog}
      aria-labelledby={titleId}
      className={`${dialogStyles.dialog} ${styles.newDialog}`}
      onClose={onClose}
    >
      <form
        className={styles.newForm}
        onSubmit={(event) => {
          event.preventDefault()
          create.mutate()
        }}
      >
        <h2 id={titleId}>{parent ? t('newPage.subTitle', { parent: parent.title }) : t('newPage.title')}</h2>
        <fieldset className={styles.kinds}>
          <legend className={styles.hidden}>{t('newPage.kind')}</legend>
          {KINDS.map(({ kind: each, icon: Icon, ready }) => (
            <label key={each} className={styles.kindCard} data-ready={ready || undefined}>
              <input
                type="radio"
                name={`${titleId}-kind`}
                disabled={!ready}
                checked={kind === each}
                onChange={() => setKind(each)}
              />
              <Icon aria-hidden="true" size={20} />
              {each === 'text'
                ? t('newPage.text')
                : each === 'template'
                  ? t('newPage.fromTemplate')
                  : t(`pageTabs.kinds.${each}`)}
              {!ready && <span className={styles.soon}>{t('pageTabs.soon')}</span>}
            </label>
          ))}
        </fieldset>
        {kind === 'template' && <TemplatePicker value={template} onChange={setTemplate} />}
        <input
          className={styles.nameInput}
          data-autofocus=""
          value={title}
          maxLength={200}
          placeholder={t('wiki.untitled')}
          aria-label={t('newPage.name')}
          onChange={(event) => setTitle(event.currentTarget.value)}
        />
        <FormError message={create.error ? errorText(create.error) : null} />
        <BusyButton type="submit" className={`${form.button} ${styles.submit}`} busy={create.isPending}>
          {t('newPage.create')}
        </BusyButton>
      </form>
    </Modal>
  )
}

/**
 * «Página nueva» (y «Nueva subpágina»): un cuadro como el de «Pestaña nueva», con el tipo (texto o un mapa; lo demás,
 * pronto) y el título. «Desde plantilla», la última tras una raya con «o», cambia el cuadro a la lista de plantillas: la
 * página nace como una copia de la elegida (ADR-0024). Sin título, se abre para ponérselo en el sitio
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
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
import { KindChoices, StepBack, TAB_KINDS, type TabKind } from './tabs/kinds.tsx'
import styles from './tabs/page-tabs.module.css'

/** Los tipos que se ofrecen al crear una página (las tablas y las escenas, como pestañas) */
const KINDS = TAB_KINDS.filter((each) => each.newPage)

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
  const [kind, setKind] = useState<TabKind>('text')
  // El paso de la plantilla: se elige una de la lista
  const [fromTemplate, setFromTemplate] = useState(false)
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
        ...(fromTemplate && template ? { template } : {})
      })
      // Si la pestaña falla, la página ya está: se abre igual (sin mapa) en vez de dejar el cuadro para crear otra
      const tab =
        !fromTemplate && kind === 'map'
          ? await api.call('createPageTab', { pageId: page.id, kind: 'map' }).catch(() => null)
          : null
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
        {fromTemplate ? (
          <>
            <StepBack onClick={() => setFromTemplate(false)} />
            <TemplatePicker value={template} onChange={setTemplate} />
          </>
        ) : (
          <KindChoices
            name={`${titleId}-kind`}
            legend={t('newPage.kind')}
            kinds={KINDS}
            value={kind}
            labelOf={(each) => (each === 'text' ? t('newPage.text') : t(`pageTabs.kinds.${each}`))}
            onChange={setKind}
            onTemplate={() => setFromTemplate(true)}
          />
        )}
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
        <BusyButton
          type="submit"
          className={`${form.button} ${styles.submit}`}
          busy={create.isPending}
          disabled={fromTemplate && !template}
        >
          {t('newPage.create')}
        </BusyButton>
      </form>
    </Modal>
  )
}

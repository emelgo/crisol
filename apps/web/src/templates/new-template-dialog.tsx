/**
 * «Plantilla nueva» (Enrique, 2026-11-12: «al crear una plantilla me debe aparecer el popup de nueva página»): el mismo
 * cuadro que «Página nueva», con el tipo (texto o un mapa; lo demás, pronto) y el nombre. «Desde plantilla» parte de
 * otra: la duplica. Sin nombre, se abre para ponérselo en el sitio
 */
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BusyButton } from '../components/busy-button.tsx'
import dialogStyles from '../components/dialog.module.css'
import { FormError } from '../components/field.tsx'
import form from '../components/form.module.css'
import { Modal } from '../components/modal.tsx'
import { KindChoices, StepBack, TAB_KINDS, type TabKind } from '../wiki/tabs/kinds.tsx'
import styles from '../wiki/tabs/page-tabs.module.css'
import { useTemplates } from './data.ts'
import { useNewTemplate } from './new-template.ts'
import { TemplatePicker } from './picker.tsx'

/** Los mismos tipos que al crear una página */
const KINDS = TAB_KINDS.filter((each) => each.newPage)

export function NewTemplateDialog({ folderId, onClose }: { folderId: string | null; onClose: () => void }) {
  const { t } = useTranslation()
  const create = useNewTemplate()
  const templates = useTemplates().data?.templates ?? []
  const [kind, setKind] = useState<TabKind>('text')
  const [fromTemplate, setFromTemplate] = useState(false)
  const [back, setBack] = useState(false)
  const [name, setName] = useState('')
  const [source, setSource] = useState<string | null>(null)
  const titleId = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const copyOf = fromTemplate ? templates.find((each) => each.id === source) : undefined
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
          create.mutate(
            {
              folderId,
              name,
              ...(copyOf ? { copyOf } : { kind: kind === 'map' ? 'map' : 'text' })
            },
            {
              onSuccess: () => {
                dialog.current?.close()
                onClose()
              }
            }
          )
        }}
      >
        <h2 id={titleId}>{t('templates.new')}</h2>
        {fromTemplate ? (
          <>
            <StepBack
              onClick={() => {
                setFromTemplate(false)
                setBack(true)
              }}
            />
            <TemplatePicker value={source} onChange={setSource} autoFocus creatable={false} />
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
            focusTemplate={back}
          />
        )}
        <input
          className={styles.nameInput}
          data-autofocus={fromTemplate || back ? undefined : ''}
          value={name}
          maxLength={60}
          placeholder={copyOf ? t('templates.copyName', { name: copyOf.name }) : t('templates.untitled')}
          aria-label={t('templates.name')}
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          data-form-type="other"
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <FormError message={create.errorText} />
        <div className={dialogStyles.actions}>
          <BusyButton type="submit" className={form.button} busy={create.isPending} disabled={fromTemplate && !copyOf}>
            {t('newPage.create')}
          </BusyButton>
          <button type="button" className={dialogStyles.cancel} onClick={() => dialog.current?.close()}>
            {t('newPage.cancel')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

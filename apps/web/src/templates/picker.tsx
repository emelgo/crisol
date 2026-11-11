/**
 * Elegir una plantilla (al crear una página o una pestaña, o desde un enlace sin resolver): por carpetas, con un
 * buscador. Es un grupo de opciones: las flechas pasan de una a otra
 */
import type { TemplateView } from '@crisol/contracts'
import { fieldKey } from '@crisol/domain'
import { Plus, Search } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useTemplates } from './data.ts'
import { TemplateIcon } from './icons.tsx'
import { useNewTemplate } from './new-template.ts'
import styles from './picker.module.css'
import { fieldsLine, templateGroups } from './tree.ts'

export { useTemplates } from './data.ts'

/**
 * La lista de plantillas al crear una página o una pestaña (ADR-0024): un buscador y sus filas por carpetas (con su
 * camino), que se eligen como opciones. La elegida es siempre una de las que se ven (al buscar, la primera). Sin
 * ninguna, «Plantilla nueva» crea una y la abre. only: las que valen aquí (con pestañas, en «Pestaña nueva»); hint:
 * lo que dice cada una debajo de su nombre
 */
export function TemplatePicker({
  value,
  onChange,
  only,
  hint,
  autoFocus = false
}: {
  value: string | null
  onChange: (id: string) => void
  only?: (template: TemplateView) => boolean
  hint?: (template: TemplateView) => string
  autoFocus?: boolean
}) {
  const { t } = useTranslation()
  const name = useId()
  const labels = useId()
  const data = useTemplates().data
  const create = useNewTemplate()
  const [query, setQuery] = useState('')
  const usable = (data?.templates ?? []).filter((template) => !only || only(template))
  const shown = usable.filter((template) => !query.trim() || fieldKey(template.name).includes(fieldKey(query)))
  const groups = templateGroups(data?.folders ?? [], shown)
  // La elegida, siempre a la vista: sin elegir o escondida por el buscador, la primera de lo que se ve
  const first = groups[0]?.templates[0]?.id
  const visible = groups.some((group) => group.templates.some((template) => template.id === value))
  useEffect(() => {
    if (first && !visible) onChange(first)
  }, [first, visible, onChange])
  // Debajo de cada una, lo que la distingue: sus primeros campos (como en la lista)
  const hintOf = hint ?? ((template: TemplateView) => fieldsLine(template) ?? t('templates.noFields'))
  if (data && usable.length === 0) {
    // Ninguna que sirva aquí: crear la primera (se abre para hacerla)
    return (
      <div className={`${styles.picker} ${styles.emptyPicker}`}>
        <p className={styles.none}>
          {only && data.templates.length > 0 ? t('templates.noneWithTabs') : t('templates.empty')}
        </p>
        <button type="button" className={styles.create} disabled={create.isPending} onClick={() => create.mutate()}>
          <Plus aria-hidden="true" size={16} />
          {t('templates.new')}
        </button>
      </div>
    )
  }
  return (
    <div className={styles.picker}>
      <label className={styles.search}>
        <Search size={15} aria-hidden="true" />
        <input
          value={query}
          placeholder={t('templates.search')}
          aria-label={t('templates.search')}
          // Al pasar a este paso, se escribe ya para buscar
          // biome-ignore lint/a11y/noAutofocus: es el paso que se acaba de abrir, dentro de su cuadro
          autoFocus={autoFocus}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      </label>
      <fieldset className={styles.list}>
        <legend className={styles.hidden}>{t('templates.label')}</legend>
        {groups.map((group, index) => {
          const label = group.label ?? (groups.length > 1 ? t('templates.loose') : null)
          return (
            // biome-ignore lint/a11y/useSemanticElements: un grupo de opciones con el nombre de su carpeta
            <div
              key={group.id ?? 'arriba'}
              className={styles.group}
              role="group"
              aria-labelledby={label ? `${labels}-${index}` : undefined}
            >
              {label && (
                <p id={`${labels}-${index}`} className={styles.groupLabel}>
                  {label}
                </p>
              )}
              {group.templates.map((template) => (
                <label key={template.id} className={styles.row}>
                  <input
                    type="radio"
                    name={name}
                    value={template.id}
                    checked={value === template.id}
                    onChange={() => onChange(template.id)}
                  />
                  <span className={styles.icon} aria-hidden="true">
                    <TemplateIcon icon={template.icon} size={16} />
                  </span>
                  <span className={styles.text}>
                    <span className={styles.name}>{template.name}</span>
                    <span className={styles.hint}>{hintOf(template)}</span>
                  </span>
                </label>
              ))}
            </div>
          )
        })}
        {groups.length === 0 && <p className={styles.none}>{t('templates.noneFound')}</p>}
      </fieldset>
    </div>
  )
}

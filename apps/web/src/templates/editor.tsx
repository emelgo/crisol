/**
 * Una plantilla abierta (/plantillas/:id). De momento se lee: sus campos, su panel y su texto se cambian con la tarea 11
 * del módulo 2
 */
import { useParams } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { PageTitle } from '../components/page-title.tsx'
import { useTemplates } from './picker.tsx'

export function TemplateView() {
  const { t } = useTranslation()
  const { templateId } = useParams({ strict: false }) as { templateId: string }
  const template = useTemplates().data?.templates.find((each) => each.id === templateId)
  if (!template) return null
  return (
    <section style={{ padding: 'var(--space-8) var(--space-6)' }}>
      <PageTitle>{template.name}</PageTitle>
      <h2>{t('templates.fields')}</h2>
      <ul>
        {template.fields.map((field) => (
          <li key={field.field ?? field.name}>
            {field.name} · {t(`properties.types.${field.type}`)}
          </li>
        ))}
      </ul>
    </section>
  )
}

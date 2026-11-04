/**
 * Un sistema, en su página (`/sistemas/:id`). Por ahora se ve para leerlo; el editor por secciones llega con la tarea 10
 * (docs/specs/sistemas.md § editor)
 */
import { useQuery } from '@tanstack/react-query'
import { Navigate, useParams } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../../account/context.tsx'
import { useApi } from '../../api/context.tsx'
import { failed, LoadError } from '../../components/load-error.tsx'
import { PageTitle } from '../../components/page-title.tsx'
import screen from '../../templates/screen.module.css'

export function SystemView() {
  const { t } = useTranslation()
  const { systemId } = useParams({ from: '/sistemas/$systemId' })
  const api = useApi()
  const { account, pending } = useAccounts().useAccount()
  const system = useQuery({ queryKey: ['systems', systemId], queryFn: () => api.call('getSystem', { systemId }) })
  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  return (
    <section className={screen.page}>
      <div className={screen.center}>
        {failed(system) && <LoadError error={system.error} onRetry={() => system.refetch()} />}
        {system.data && (
          <>
            <PageTitle>{system.data.name}</PageTitle>
            <p className={screen.meta}>
              {t('systems.version', { version: system.data.builtIn ? system.data.release : system.data.version })}
            </p>
            <h2 className={screen.section}>{t('systems.types')}</h2>
            <ul className={screen.list}>
              {system.data.types.map((type) => (
                <li key={type.key}>
                  {type.label}
                  <span>{t('systems.fields', { count: type.fields })}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  )
}

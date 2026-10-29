import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { CreateForm } from '../components/create-form.tsx'
import styles from '../components/list.module.css'
import { PageTitle } from '../components/page-title.tsx'
import { RenamableItem } from '../components/renamable-item.tsx'

export function Worlds() {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const { account, pending } = useAccounts().useAccount()
  const organizations = useQuery({
    queryKey: ['organizations'],
    queryFn: () => api.call('listOrganizations', {}),
    enabled: Boolean(account)
  })
  const worlds = useQuery({
    queryKey: ['worlds'],
    queryFn: () => api.call('listWorlds', {}),
    enabled: Boolean(account)
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['worlds'] })

  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  const canCreate = organizations.data?.organizations.some((o) => o.role === 'owner') ?? false

  return (
    <section>
      <PageTitle>{t('worlds.title')}</PageTitle>
      {canCreate && (
        <p>
          <Link to="/historial">{t('history.organizationLink')}</Link>
          {' · '}
          <Link to="/papelera">{t('trash.title')}</Link>
        </p>
      )}
      {worlds.data &&
        (worlds.data.worlds.length === 0 ? (
          <p>{t('worlds.empty')}</p>
        ) : (
          <ul className={styles.list} aria-label={t('worlds.listLabel')}>
            {worlds.data.worlds.map((world) => (
              <RenamableItem
                key={world.id}
                name={world.name}
                role={t(`roles.${world.role}`)}
                link={{ to: '/mundos/$worldId', params: { worldId: world.id } }}
                {...(world.role === 'master'
                  ? {
                      onRename: (name: string) => api.call('renameWorld', { worldId: world.id, name }).then(refresh),
                      onDelete: () => api.call('deleteWorld', { worldId: world.id }).then(refresh)
                    }
                  : {})}
              />
            ))}
          </ul>
        ))}
      {canCreate && (
        <CreateForm
          title={t('worlds.newTitle')}
          label={t('worlds.name')}
          submit={t('worlds.create')}
          onCreate={(name) => api.call('createWorld', { name }).then(refresh)}
        />
      )}
    </section>
  )
}

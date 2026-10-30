import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { CreateForm } from '../components/create-form.tsx'
import { FormError } from '../components/field.tsx'
import { failed } from '../components/load-error.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { RenamableItem } from '../components/renamable-item.tsx'
import cards from './world-card.module.css'
import { WorldCardHeader, WorldDescription, WorldSettings } from './world-card.tsx'

export function Worlds() {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
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
      <FormError message={failed(worlds) ? errorText(worlds.error) : null} />
      {worlds.data &&
        (worlds.data.worlds.length === 0 ? (
          <p>{t('worlds.empty')}</p>
        ) : (
          <ul className={cards.list} aria-label={t('worlds.listLabel')}>
            {worlds.data.worlds.map((world) => (
              <RenamableItem
                key={world.id}
                className={cards.card}
                header={<WorldCardHeader world={world} />}
                name={world.name}
                role={t(`roles.${world.role}`)}
                link={{ to: '/mundos/$worldId', params: { worldId: world.id } }}
                {...(world.role === 'master'
                  ? {
                      onRename: (name: string) => api.call('renameWorld', { worldId: world.id, name }).then(refresh),
                      onDelete: () => api.call('deleteWorld', { worldId: world.id }).then(refresh)
                    }
                  : {})}
              >
                <WorldDescription world={world} />
                {world.role === 'master' && <WorldSettings world={world} />}
              </RenamableItem>
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

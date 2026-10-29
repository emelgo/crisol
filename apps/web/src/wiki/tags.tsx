import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import list from '../components/list.module.css'
import { failed, LoadError } from '../components/load-error.tsx'
import { PageTitle } from '../components/page-title.tsx'
import styles from './tags.module.css'
import { WikiLayout } from './wiki.tsx'

const route = getRouteApi('/mundos/$worldId/etiquetas')

/** Las etiquetas de la wiki con cuántas páginas tiene cada una; las hijas («lugar/ciudad»), debajo de su madre */
export function WikiTags() {
  const { t } = useTranslation()
  const api = useApi()
  const { worldId } = route.useParams()
  const tags = useQuery({ queryKey: ['pages', worldId, 'tags'], queryFn: () => api.call('listTags', { worldId }) })
  return (
    <WikiLayout worldId={worldId}>
      {(world) => (
        <section>
          <PageTitle>{t('tags.worldTitle', { world: world.name })}</PageTitle>
          {failed(tags) && <LoadError error={tags.error} onRetry={() => tags.refetch()} />}
          {tags.data &&
            (tags.data.tags.length === 0 ? (
              <p>{t('tags.empty')}</p>
            ) : (
              <ul className={list.list} aria-label={t('tags.title')}>
                {tags.data.tags.map(({ tag, depth, count }) => (
                  <li key={tag} className={styles.tag} style={{ paddingInlineStart: `${depth * 1.5}rem` }}>
                    <span className={styles.name}>{depth > 0 ? tag.split('/').at(-1) : tag}</span>
                    <span className={styles.count}>{t('tags.count', { count })}</span>
                  </li>
                ))}
              </ul>
            ))}
        </section>
      )}
    </WikiLayout>
  )
}

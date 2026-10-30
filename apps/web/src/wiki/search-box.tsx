/** La caja de buscar del lateral de la wiki: lleva a la búsqueda con lo escrito */
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import list from '../components/list.module.css'
import styles from './search.module.css'

export function SearchBox({ worldId, onSearch }: { worldId: string; onSearch?: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <search>
      <form
        className={styles.box}
        onSubmit={(event) => {
          event.preventDefault()
          const q = String(new FormData(event.currentTarget).get('q') ?? '').trim()
          if (!q) return
          onSearch?.()
          void navigate({ to: '/mundos/$worldId/buscar', params: { worldId }, search: { q } })
        }}
      >
        <input type="search" name="q" aria-label={t('search.sidebar')} maxLength={200} className={styles.boxInput} />
        <button type="submit" className={list.secondary}>
          {t('search.sidebarSubmit')}
        </button>
      </form>
    </search>
  )
}

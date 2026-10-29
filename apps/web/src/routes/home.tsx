import { useTranslation } from 'react-i18next'

export function Home() {
  const { t } = useTranslation()
  return (
    <section>
      <h1>{t('app.name')}</h1>
      <p>{t('app.tagline')}</p>
    </section>
  )
}

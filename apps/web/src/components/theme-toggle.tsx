import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { currentTheme, nextTheme, setTheme } from '../theme.ts'
import styles from './theme-toggle.module.css'

export function ThemeToggle() {
  const { t } = useTranslation()
  const [theme, setThemeState] = useState(currentTheme)
  const next = nextTheme(theme)
  return (
    <button
      type="button"
      className={styles.toggle}
      aria-label={next === 'dark' ? t('theme.toDark') : t('theme.toLight')}
      onClick={() => {
        setTheme(next)
        setThemeState(next)
      }}
    >
      <span aria-hidden="true">{next === 'dark' ? '☾' : '☀'}</span>
    </button>
  )
}

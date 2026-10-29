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
      {next === 'dark' ? <MoonIcon /> : <SunIcon />}
    </button>
  )
}

function MoonIcon() {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}

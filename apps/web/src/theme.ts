export type Theme = 'light' | 'dark'

export const THEME_KEY = 'crisol.tema'

/** El tema elegido si lo hay; si no, el del sistema */
export function initialTheme(stored: string | null, prefersDark: boolean): Theme {
  if (stored === 'light' || stored === 'dark') return stored
  return prefersDark ? 'dark' : 'light'
}

export function nextTheme(theme: Theme): Theme {
  return theme === 'light' ? 'dark' : 'light'
}

/** El tema que se está viendo (lo pone index.html antes de cargar la app) */
export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  localStorage.setItem(THEME_KEY, theme)
}

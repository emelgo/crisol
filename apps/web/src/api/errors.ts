import { useTranslation } from 'react-i18next'
import { ApiError } from './client.ts'

/** El texto de error de un fallo de la API, por su código */
export function useErrorText() {
  const { t } = useTranslation()
  return (error: unknown) => {
    const code = error instanceof ApiError ? error.code : 'UNKNOWN'
    return t(`errors.${code}`, { defaultValue: t('errors.UNKNOWN') })
  }
}

/** Las consultas solo se repiten si falla el servidor o la red: un 404 o un 403 no cambian por repetirlos */
export function shouldRetry(failureCount: number, error: unknown) {
  if (error instanceof ApiError && error.status < 500) return false
  return failureCount < 3
}

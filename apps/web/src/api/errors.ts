import { useTranslation } from 'react-i18next'
import { ApiError } from './client.ts'

/** El texto de un código de error de la API (uno que no se conoce, el genérico) */
export function useCodeText() {
  const { t } = useTranslation()
  return (code: string) => t(`errors.${code}`, { defaultValue: t('errors.UNKNOWN') })
}

/** El texto de error de un fallo de la API, por su código */
export function useErrorText() {
  const codeText = useCodeText()
  return (error: unknown) => codeText(error instanceof ApiError ? error.code : 'UNKNOWN')
}

/** Las consultas solo se repiten si falla el servidor o la red: un 404 o un 403 no cambian por repetirlos */
export function shouldRetry(failureCount: number, error: unknown) {
  if (error instanceof ApiError && error.status < 500) return false
  return failureCount < 3
}

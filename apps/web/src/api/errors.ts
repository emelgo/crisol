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

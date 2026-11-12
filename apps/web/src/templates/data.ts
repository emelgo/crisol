/** Las plantillas de la cuenta y sus carpetas (ADR-0024), en la caché de consultas: las usa toda la web */
import { useQuery } from '@tanstack/react-query'
import { useApi } from '../api/context.tsx'

/** Las plantillas que se pueden usar, con sus carpetas */
export function useTemplates() {
  const api = useApi()
  return useQuery({ queryKey: ['templates'], queryFn: () => api.call('listTemplates', {}) })
}

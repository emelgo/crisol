/** El texto de un problema de la definición, por su código y en el idioma de la app (el servidor da el suyo a la IA) */
import { and, type CalendarProblem } from '@crisol/domain'
import { useTranslation } from 'react-i18next'

export function useProblemText() {
  const { t } = useTranslation()
  return (problem: Pick<CalendarProblem, 'code' | 'params' | 'message'>) => {
    const other = typeof problem.params.other === 'string' ? problem.params.other : ''
    return t(`calendars.problem.${problem.code}` as 'calendars.problem.nameMissing', {
      ...problem.params,
      and: and(other),
      defaultValue: problem.message
    })
  }
}

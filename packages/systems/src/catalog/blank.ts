/** «En blanco»: un personaje sin campos y los dados de siempre. Para empezar un sistema desde cero */
import { FORMAT, type System } from '../format.ts'

export const blank: System = {
  format: FORMAT,
  id: 'blank',
  name: { es: 'En blanco', en: 'Blank' },
  summary: {
    es: 'Un personaje sin campos y los dados de siempre.',
    en: 'A character with no fields and the usual dice.'
  },
  version: '1.0',
  languages: ['es', 'en'],
  license: { name: 'Crisol', license: 'Propio', attribution: { es: 'Hecho para Crisol', en: 'Made for Crisol' } },
  types: { personaje: { document: 'actor', label: { es: 'Personaje', en: 'Character' }, icon: 'user', fields: {} } },
  rolls: {},
  dice: { default: '1d20', critical: 'd20' },
  sources: [],
  packs: [],
  settings: {}
}

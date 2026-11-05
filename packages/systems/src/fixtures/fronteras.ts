/** Fronteras: un juego de 2d6 + atributo, hecho para las pruebas (y el de los prototipos del diseño) */
import { FORMAT, type System } from '../format.ts'

export const fronteras: System = {
  format: FORMAT,
  id: 'fronteras',
  name: 'Fronteras',
  summary: 'Juego de exploración en la frontera: se tira 2d6 y se suma un atributo.',
  version: '7',
  languages: ['es'],
  types: {
    personaje: {
      document: 'actor',
      label: 'Personaje',
      icon: 'user',
      fields: {
        vigor: { kind: 'number', label: 'Vigor', min: -1, max: 3, default: 0, integer: true, help: 'De −1 a +3' },
        astucia: { kind: 'number', label: 'Astucia', min: -1, max: 3, default: 0, integer: true },
        presencia: { kind: 'number', label: 'Presencia', min: -1, max: 3, default: 0, integer: true },
        heridas: { kind: 'resource', label: 'Heridas', max: 6, default: 0 },
        experiencia: { kind: 'clock', label: 'Experiencia', segments: 8 },
        defensa: { kind: 'derived', label: 'Defensa', formula: '7 + @vigor' },
        carga: { kind: 'derived', label: 'Carga', formula: '3 + @vigor' },
        lleva: { kind: 'items', label: 'Lleva', of: ['objeto'], play: true }
      }
    },
    objeto: {
      document: 'item',
      label: 'Objeto',
      icon: 'gem',
      fields: {
        equipado: { kind: 'boolean', label: 'Equipado', default: false },
        defensa: { kind: 'number', label: 'Defensa', default: 0, integer: true },
        peso: { kind: 'number', label: 'Peso', default: 1, min: 0 }
      },
      modifiers: [{ target: 'defensa', value: '@defensa', when: '@equipado' }]
    },
    movimiento: {
      document: 'item',
      label: 'Movimiento',
      icon: 'route',
      fields: {
        descripcion: { kind: 'text', label: 'Descripción', lines: 6 },
        atributo: {
          kind: 'choice',
          label: 'Atributo',
          options: [
            { value: 'vigor', label: 'Vigor' },
            { value: 'astucia', label: 'Astucia' },
            { value: 'presencia', label: 'Presencia' }
          ]
        }
      }
    }
  },
  rolls: {
    atributo: {
      label: 'Atributo',
      formula: '2d6 + @este',
      for: { fields: ['vigor', 'astucia', 'presencia'] },
      bands: [
        { if: '@total >= 10', label: 'Éxito total', tone: 'success' },
        { if: '@total >= 7', label: 'Éxito con coste', tone: 'partial' },
        { if: 'true', label: 'Fallo', tone: 'failure' }
      ],
      modes: [
        { key: 'ventaja', label: 'Con ventaja', from: '2d6', to: '3d6kh2' },
        { key: 'desventaja', label: 'Con desventaja', from: '2d6', to: '3d6kl2' }
      ]
    }
  },
  dice: { default: '2d6', critical: 'none' },
  // Su creador: los atributos a mano y dos movimientos; en su tarjeta, la defensa
  card: ['defensa'],
  creation: [
    { key: 'atributos', kind: 'fields', label: 'Atributos', fields: ['vigor', 'astucia', 'presencia'] },
    { key: 'movimientos', kind: 'content', label: 'Movimientos', type: 'movimiento', min: 2, max: 2 },
    { key: 'resumen', kind: 'summary', label: 'Resumen' }
  ],
  settings: { avance: { kind: 'number', label: 'Marcas de experiencia para avanzar', default: 8 } }
}

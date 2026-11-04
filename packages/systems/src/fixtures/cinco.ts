/**
 * Un 5e de prueba, pequeño: características, unas habilidades, la competencia, la CA con un anillo y un escudo, y los
 * PG. Escrito para las pruebas, con términos del SRD 5.1 (CC BY 4.0). El de verdad llega con srd-5e
 */
import { FORMAT, type System } from '../format.ts'

const caracteristicas = [
  ['fue', 'Fuerza', 'Strength', 'FUE', 'STR'],
  ['des', 'Destreza', 'Dexterity', 'DES', 'DEX'],
  ['con', 'Constitución', 'Constitution', 'CON', 'CON'],
  ['int', 'Inteligencia', 'Intelligence', 'INT', 'INT'],
  ['sab', 'Sabiduría', 'Wisdom', 'SAB', 'WIS'],
  ['car', 'Carisma', 'Charisma', 'CAR', 'CHA']
] as const

export const cinco: System = {
  format: FORMAT,
  id: 'cinco',
  name: { es: '5e de prueba', en: '5e test' },
  version: '0.1',
  languages: ['es', 'en'],
  types: {
    personaje: {
      document: 'actor',
      label: { es: 'Personaje', en: 'Character' },
      fields: {
        nivel: { kind: 'number', label: { es: 'Nivel', en: 'Level' }, min: 1, max: 20, default: 1, integer: true },
        caracteristicas: {
          kind: 'set',
          label: { es: 'Características', en: 'Abilities' },
          elements: caracteristicas.map(([key, es, en, abes, aben]) => ({
            key,
            label: { es, en },
            abbr: { es: abes, en: aben }
          })),
          fields: {
            puntuacion: {
              kind: 'number',
              label: { es: 'Puntuación', en: 'Score' },
              min: 1,
              max: 30,
              default: 10,
              integer: true
            },
            mod: {
              kind: 'derived',
              label: { es: 'Modificador', en: 'Modifier' },
              formula: 'floor((@este.puntuacion - 10) / 2)',
              signed: true
            }
          }
        },
        competencia: {
          kind: 'derived',
          label: { es: 'Bonificador por competencia', en: 'Proficiency bonus' },
          formula: 'ceil(@nivel / 4) + 1',
          signed: true
        },
        ca: {
          kind: 'derived',
          label: { es: 'Clase de armadura', en: 'Armor class' },
          formula: '10 + @caracteristicas.des.mod'
        },
        pg: {
          kind: 'resource',
          label: { es: 'Puntos de golpe', en: 'Hit points' },
          max: '@nivel * (6 + @caracteristicas.con.mod)'
        },
        lleva: { kind: 'items', label: { es: 'Inventario', en: 'Inventory' }, of: ['objeto'] }
      }
    },
    objeto: {
      document: 'item',
      label: { es: 'Objeto', en: 'Item' },
      fields: {
        equipado: { kind: 'boolean', label: { es: 'Equipado', en: 'Equipped' } },
        bono_ca: { kind: 'number', label: { es: 'Bono a la CA', en: 'AC bonus' }, default: 0, integer: true },
        peso: { kind: 'number', label: { es: 'Peso', en: 'Weight' }, default: 0, min: 0 }
      },
      modifiers: [{ target: 'ca', value: '@bono_ca', when: '@equipado && @bono_ca != 0' }]
    }
  },
  rolls: {
    caracteristica: {
      label: { es: 'Prueba de característica', en: 'Ability check' },
      formula: '1d20 + @este.mod',
      for: { set: 'caracteristicas' },
      target: 'optional',
      bands: [
        { if: '@objetivo != null && @total >= @objetivo', label: { es: 'Éxito', en: 'Success' }, tone: 'success' },
        { if: '@objetivo != null', label: { es: 'Fallo', en: 'Failure' }, tone: 'failure' }
      ],
      modes: [
        { key: 'ventaja', label: { es: 'Con ventaja', en: 'Advantage' }, from: '1d20', to: '2d20kh1' },
        { key: 'desventaja', label: { es: 'Con desventaja', en: 'Disadvantage' }, from: '1d20', to: '2d20kl1' }
      ]
    },
    ataque: {
      label: { es: 'Ataque', en: 'Attack' },
      formula: '1d20 + @caracteristicas.fue.mod + @competencia',
      target: 'optional',
      bands: [
        { if: '@natural == 20', label: { es: 'Crítico', en: 'Critical hit' }, tone: 'critical' },
        { if: '@natural == 1', label: { es: 'Pifia', en: 'Fumble' }, tone: 'fumble' },
        { if: '@objetivo != null && @total >= @objetivo', label: { es: 'Impacta', en: 'Hit' }, tone: 'success' },
        { if: '@objetivo != null', label: { es: 'Falla', en: 'Miss' }, tone: 'failure' }
      ]
    }
  },
  dice: { default: '1d20', critical: 'd20' },
  sources: [
    {
      key: 'srd51',
      name: 'SRD 5.1',
      license: 'CC BY 4.0',
      attribution: 'Incluye material del SRD 5.1 (Wizards of the Coast), con licencia CC BY 4.0.'
    },
    {
      key: 'srd52',
      name: 'SRD 5.2',
      license: 'CC BY 4.0',
      attribution: 'Incluye material del SRD 5.2 (Wizards of the Coast), con licencia CC BY 4.0.'
    }
  ],
  packs: [{ key: 'objetos', label: { es: 'Objetos', en: 'Items' }, type: 'objeto' }],
  settings: {
    metodos: {
      kind: 'choices',
      label: { es: 'Métodos de características', en: 'Ability score methods' },
      options: [
        { value: 'estandar', label: { es: 'Valores estándar', en: 'Standard array' } },
        { value: 'compra', label: { es: 'Compra por puntos', en: 'Point buy' } },
        { value: 'tiradas', label: { es: 'Tiradas', en: 'Rolling' } },
        { value: 'a_mano', label: { es: 'A mano', en: 'Manual' } }
      ],
      default: ['estandar', 'compra']
    }
  }
}

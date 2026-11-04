/**
 * La mecánica del contenido que no sale de una tabla: escrita a mano (con la ayuda de la IA) por su clave, y comprobada
 * por las pruebas (valida con el 5e y sus tiradas dan lo del SRD). Lo que no lleva, va como texto
 */
const t = (es: string, en: string) => ({ es, en })
const throwIt = t('Lanzar', 'Throw')
const range20 = t('6 m', '20 feet')
/** En 2014, un arma improvisada a distancia (sin competencia); en 2024, una salvación de Destreza */
const attack2014 = '@caracteristicas.des.mod'
const save2024 = { ability: 'des', dc: '8 + @caracteristicas.des.mod + @competencia', success: 'none' }

export const MECHANICS: Record<string, Record<string, unknown>> = {
  pocion_de_curacion_2014: {
    actions: [{ key: 'beber', label: t('Beber', 'Drink'), activation: 'action', heal: '2d4 + 2' }],
    automation: 'full'
  },
  pocion_de_curacion_2024: {
    actions: [{ key: 'beber', label: t('Beber', 'Drink'), activation: 'bonus', heal: '2d4 + 2' }],
    automation: 'full'
  },
  acido_2014: {
    actions: [
      {
        key: 'lanzar',
        label: throwIt,
        activation: 'action',
        range: range20,
        attack: attack2014,
        damage: [{ formula: '2d6', type: 'acido' }]
      }
    ],
    automation: 'full'
  },
  acido_2024: {
    actions: [
      {
        key: 'lanzar',
        label: throwIt,
        activation: 'action',
        range: range20,
        save: save2024,
        damage: [{ formula: '2d6', type: 'acido' }]
      }
    ],
    automation: 'full'
  },
  fuego_de_alquimista_2014: {
    actions: [
      {
        key: 'lanzar',
        label: throwIt,
        activation: 'action',
        range: range20,
        attack: attack2014,
        damage: [{ formula: '1d4', type: 'fuego' }]
      }
    ],
    automation: 'partial',
    manual: t(
      'El daño se repite al principio de cada turno hasta apagarlo (prueba de Destreza CD 10)',
      'The damage repeats at the start of each turn until extinguished (DC 10 Dexterity check)'
    )
  },
  fuego_de_alquimista_2024: {
    actions: [
      {
        key: 'lanzar',
        label: throwIt,
        activation: 'action',
        range: range20,
        save: save2024,
        damage: [{ formula: '1d4', type: 'fuego' }]
      }
    ],
    automation: 'partial',
    manual: t('El objetivo queda en llamas', 'The target starts burning')
  },
  agua_bendita_2014: {
    actions: [
      {
        key: 'lanzar',
        label: throwIt,
        activation: 'action',
        range: range20,
        attack: attack2014,
        damage: [{ formula: '2d6', type: 'radiante' }]
      }
    ],
    automation: 'partial',
    manual: t('Solo daña a infernales y muertos vivientes', 'Only harms fiends and undead')
  },
  agua_bendita_2024: {
    actions: [
      {
        key: 'lanzar',
        label: throwIt,
        activation: 'action',
        range: range20,
        save: save2024,
        damage: [{ formula: '2d8', type: 'radiante' }]
      }
    ],
    automation: 'partial',
    manual: t('Solo daña a infernales y muertos vivientes', 'Only harms fiends and undead')
  },
  utiles_de_sanador_2014: {
    resources: [{ key: 'usos', label: t('Usos', 'Uses'), max: '10' }],
    automation: 'partial',
    manual: t('Estabilizar a una criatura gasta un uso', 'Stabilizing a creature spends a use')
  },
  utiles_de_sanador_2024: {
    resources: [{ key: 'usos', label: t('Usos', 'Uses'), max: '10' }],
    automation: 'partial',
    manual: t('Estabilizar a una criatura gasta un uso', 'Stabilizing a creature spends a use')
  }
}

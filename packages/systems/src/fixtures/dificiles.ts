/**
 * Los casos difíciles del 5e, escritos a mano (punto de control 1 de srd-5e): un 5e pequeño y el contenido que más
 * pide a la mecánica (Defensa sin armadura, las armaduras y el escudo, el Anillo de protección, la Furia, Escudo, Bola
 * de fuego y un dragón rojo adulto). Términos y valores del SRD 5.1 (CC BY 4.0)
 */
import type { ContentItem } from '../file.ts'
import { FORMAT, type System } from '../format.ts'
import type { Mechanics } from '../mechanics.ts'

const abilities = [
  ['fue', 'Fuerza'],
  ['des', 'Destreza'],
  ['con', 'Constitución'],
  ['int', 'Inteligencia'],
  ['sab', 'Sabiduría'],
  ['car', 'Carisma']
] as const

const caracteristicas = {
  kind: 'set',
  label: 'Características',
  elements: abilities.map(([key, label]) => ({ key, label })),
  fields: {
    puntuacion: { kind: 'number', label: 'Puntuación', min: 1, max: 30, default: 10, integer: true },
    mod: { kind: 'derived', label: 'Modificador', formula: 'floor((@este.puntuacion - 10) / 2)', signed: true }
  }
} as const

const modes = [
  { key: 'ventaja', label: 'Con ventaja', from: '1d20', to: '2d20kh1', gives: 'advantage' },
  { key: 'desventaja', label: 'Con desventaja', from: '1d20', to: '2d20kl1', gives: 'disadvantage' }
] as const

export const dificiles = {
  format: FORMAT,
  id: 'dificiles',
  name: 'Los casos difíciles',
  version: '1',
  languages: ['es'],
  dice: { default: '1d20', critical: 'd20' },
  types: {
    personaje: {
      document: 'actor',
      label: 'Personaje',
      fields: {
        nivel: { kind: 'number', label: 'Nivel', min: 1, max: 20, default: 1, integer: true },
        caracteristicas,
        competencia: { kind: 'derived', label: 'Competencia', formula: 'ceil(@nivel / 4) + 1', signed: true },
        // Lo que lleva puesto: Defensa sin armadura lo mira
        con_armadura: { kind: 'derived', label: 'Con armadura', formula: 'count(@armaduras.puesta) > 0' },
        con_escudo: { kind: 'derived', label: 'Con escudo', formula: 'count(@armaduras.embrazado) > 0' },
        ca: { kind: 'derived', label: 'CA', formula: '10 + @caracteristicas.des.mod' },
        // Lo que suman los efectos a las salvaciones y al daño con Fuerza (el anillo, la Furia)
        bono_salvaciones: { kind: 'number', label: 'Bono a las salvaciones', default: 0 },
        bono_dano_fue: { kind: 'number', label: 'Bono al daño con Fuerza', default: 0 },
        cd_conjuros: {
          kind: 'derived',
          label: 'CD de conjuros',
          formula: '8 + @competencia + @caracteristicas.int.mod'
        },
        resistencias: { kind: 'list', label: 'Resistencias' },
        armaduras: { kind: 'items', label: 'Armaduras', of: ['armadura'] },
        lleva: { kind: 'items', label: 'Lleva', of: ['armadura', 'arma', 'objeto_magico', 'rasgo', 'conjuro'] }
      }
    },
    criatura: {
      document: 'actor',
      label: 'Criatura',
      fields: {
        vd: { kind: 'number', label: 'Valor de desafío', min: 0, max: 30, default: 0 },
        caracteristicas,
        competencia: { kind: 'derived', label: 'Competencia', formula: 'max(2, ceil(@vd / 4) + 1)', signed: true },
        ca: { kind: 'number', label: 'CA', default: 10 }
      }
    },
    armadura: {
      document: 'item',
      label: 'Armadura',
      fields: {
        equipado: { kind: 'boolean', label: 'Equipado' },
        escudo: { kind: 'boolean', label: 'Es un escudo' },
        puesta: { kind: 'derived', label: 'Puesta', formula: '@equipado && !@escudo' },
        embrazado: { kind: 'derived', label: 'Embrazado', formula: '@equipado && @escudo' }
      }
    },
    arma: {
      document: 'item',
      label: 'Arma',
      fields: {
        equipado: { kind: 'boolean', label: 'Equipado' },
        dano: { kind: 'dice', label: 'Daño', default: '1d4' }
      }
    },
    objeto_magico: {
      document: 'item',
      label: 'Objeto mágico',
      fields: {
        equipado: { kind: 'boolean', label: 'Equipado' },
        sintonizado: { kind: 'boolean', label: 'Sintonizado' }
      }
    },
    rasgo: { document: 'item', label: 'Rasgo', fields: { activo: { kind: 'boolean', label: 'Activo' } } },
    conjuro: {
      document: 'item',
      label: 'Conjuro',
      fields: {
        nivel: { kind: 'number', label: 'Nivel', min: 0, max: 9, default: 0 },
        activo: { kind: 'boolean', label: 'Activo' }
      }
    }
  },
  rolls: {
    prueba: { label: 'Prueba', formula: '1d20 + @este.mod', for: { set: 'caracteristicas' }, modes },
    salvacion: {
      label: 'Salvación',
      formula: '1d20 + @este.mod + @bono_salvaciones',
      for: { set: 'caracteristicas' },
      modes
    },
    ataque: {
      label: 'Ataque',
      formula: '1d20 + @caracteristicas.fue.mod + @competencia',
      for: { items: ['arma'] },
      modes
    },
    dano: {
      label: 'Daño',
      formula: '@este.dano + @caracteristicas.fue.mod + @bono_dano_fue',
      for: { items: ['arma'] }
    }
  }
} as unknown as System

const item = (type: string, key: string, name: string, mechanics?: Mechanics, data: Record<string, unknown> = {}) =>
  ({ type, key, source: null, data: { name, ...data }, ...(mechanics ? { mechanics } : {}) }) as ContentItem

const unarmored = (other: 'sab' | 'con', when: string) => ({
  target: 'ca',
  op: 'base' as const,
  value: `10 + @caracteristicas.des.mod + @caracteristicas.${other}.mod`,
  when
})

export const dificilesContent: ContentItem[] = [
  item('rasgo', 'defensa_sin_armadura_monje', 'Defensa sin armadura', {
    effects: [unarmored('sab', '!@con_armadura && !@con_escudo')]
  }),
  item('rasgo', 'defensa_sin_armadura_barbaro', 'Defensa sin armadura', {
    effects: [unarmored('con', '!@con_armadura')]
  }),
  item('armadura', 'cota_de_malla', 'Cota de malla', {
    effects: [{ target: 'ca', op: 'base', value: '16', when: '@este.puesta' }]
  }),
  item('armadura', 'cota_de_escamas', 'Cota de escamas', {
    effects: [{ target: 'ca', op: 'base', value: '14 + min(@caracteristicas.des.mod, 2)', when: '@este.puesta' }]
  }),
  item(
    'armadura',
    'escudo',
    'Escudo',
    { effects: [{ target: 'ca', op: 'add', value: '2', when: '@este.embrazado' }] },
    { escudo: true }
  ),
  item('objeto_magico', 'anillo_de_proteccion', 'Anillo de protección', {
    effects: [
      { target: 'ca', op: 'add', value: '1', when: '@este.sintonizado' },
      { target: 'bono_salvaciones', op: 'add', value: '1', when: '@este.sintonizado' }
    ]
  }),
  item('rasgo', 'furia', 'Furia', {
    toggle: { duration: '1 minuto' },
    resources: [
      {
        key: 'usos',
        label: 'Furias',
        max: '@nivel >= 20 ? 99 : @nivel >= 17 ? 6 : @nivel >= 12 ? 5 : @nivel >= 6 ? 4 : @nivel >= 3 ? 3 : 2',
        recovery: 'long'
      }
    ],
    actions: [{ key: 'entrar', label: 'Entrar en furia', activation: 'bonus', uses: 'usos' }],
    effects: [
      ...['contundente', 'perforante', 'cortante'].map((t) => ({
        target: 'resistencias',
        op: 'append' as const,
        value: `"${t}"`,
        when: '@este.activo'
      })),
      { target: 'prueba.fue', op: 'advantage', when: '@este.activo' },
      { target: 'salvacion.fue', op: 'advantage', when: '@este.activo' },
      { target: 'bono_dano_fue', op: 'add', value: '@nivel >= 16 ? 4 : @nivel >= 9 ? 3 : 2', when: '@este.activo' }
    ],
    automation: 'partial',
    manual: 'Solo con ataques cuerpo a cuerpo con Fuerza; sin armadura pesada; termina si no ataca ni recibe daño'
  }),
  item(
    'conjuro',
    'escudo_conjuro',
    'Escudo',
    {
      actions: [{ key: 'lanzar', label: 'Escudo', activation: 'reaction' }],
      toggle: { duration: 'Hasta el inicio de tu siguiente turno' },
      effects: [{ target: 'ca', op: 'add', value: '5', when: '@este.activo' }]
    },
    { nivel: 1 }
  ),
  item(
    'conjuro',
    'bola_de_fuego',
    'Bola de fuego',
    {
      actions: [
        {
          key: 'lanzar',
          label: 'Bola de fuego',
          activation: 'action',
          range: '150 pies',
          save: { ability: 'des', dc: '@cd_conjuros', success: 'half' },
          damage: [{ formula: '8d6', type: 'fuego' }]
        }
      ],
      scaling: { mode: 'slot', base: 3, per: '1d6' }
    },
    { nivel: 3 }
  ),
  item('arma', 'espada_larga', 'Espada larga', undefined, { equipado: true, dano: '1d8' })
]

const fue = '@caracteristicas.fue.mod'
const attack = (key: string, label: string, damage: { formula: string; type: string }[]) => ({
  key,
  label,
  activation: 'action' as const,
  attack: `${fue} + @competencia`,
  damage
})

/** El dragón rojo adulto (SRD 5.1): sus acciones como datos; sus fórmulas dan los valores del SRD */
export const dragonRojoAdulto = {
  data: {
    name: 'Dragón rojo adulto',
    vd: 17,
    ca: 19,
    caracteristicas: {
      fue: { puntuacion: 27 },
      des: { puntuacion: 10 },
      con: { puntuacion: 25 },
      int: { puntuacion: 16 },
      sab: { puntuacion: 13 },
      car: { puntuacion: 21 }
    }
  },
  items: [],
  mechanics: {
    resources: [
      { key: 'legendarias', label: 'Acciones legendarias', max: '3', recovery: 'other' },
      { key: 'resistencia', label: 'Resistencia legendaria', max: '3', recovery: 'dawn' }
    ],
    actions: [
      attack('mordisco', 'Mordisco', [
        { formula: `2d10 + ${fue}`, type: 'perforante' },
        { formula: '2d6', type: 'fuego' }
      ]),
      attack('garra', 'Garra', [{ formula: `2d6 + ${fue}`, type: 'cortante' }]),
      attack('cola', 'Cola', [{ formula: `2d8 + ${fue}`, type: 'contundente' }]),
      {
        key: 'presencia',
        label: 'Presencia terrible',
        activation: 'action',
        save: { ability: 'sab', dc: '8 + @competencia + @caracteristicas.car.mod', success: 'none' }
      },
      {
        key: 'aliento',
        label: 'Aliento de fuego',
        activation: 'action',
        recharge: '5-6',
        save: { ability: 'des', dc: '8 + @competencia + @caracteristicas.con.mod', success: 'half' },
        damage: [{ formula: '18d6', type: 'fuego' }]
      },
      {
        key: 'alas',
        label: 'Ataque con las alas',
        activation: 'legendary',
        cost: 2,
        uses: 'legendarias',
        save: { ability: 'des', dc: `8 + @competencia + ${fue}`, success: 'none' },
        damage: [{ formula: `2d6 + ${fue}`, type: 'contundente' }]
      }
    ],
    automation: 'partial',
    manual: 'Ataque múltiple, Detectar y los efectos de Presencia terrible se llevan a mano'
  } satisfies Mechanics
}

/**
 * El guerrero de los dos SRD: dónde está, sus rasgos (con su nombre oficial en los dos idiomas, revisado a mano), su
 * subclase (el campeón) y la mecánica de cada uno, escrita a mano y comprobada por las pruebas
 */
import type { ClassConfig } from './clases.ts'

const t = (es: string, en: string) => ({ es, en })
const level = (n: number) => `@origen.nivel >= ${n}`

/** Lo de la clase en las dos ediciones: sus salvaciones y sus competencias (de la primera clase, todas) */
const proficiencies = (simpleAlways: boolean) => [
  { target: 'caracteristicas.fue.salvacion_grado', op: 'min', value: '1', when: '@este.inicial' },
  { target: 'caracteristicas.con.salvacion_grado', op: 'min', value: '1', when: '@este.inicial' },
  {
    target: 'competencias_armas',
    op: 'append',
    value: '"sencilla"',
    ...(simpleAlways ? {} : { when: '@este.inicial' })
  },
  { target: 'competencias_armas', op: 'append', value: '"marcial"' },
  { target: 'competencias_armaduras', op: 'append', value: '"ligera"' },
  { target: 'competencias_armaduras', op: 'append', value: '"media"' },
  { target: 'competencias_armaduras', op: 'append', value: '"escudo"' },
  { target: 'competencias_armaduras', op: 'append', value: '"pesada"', when: '@este.inicial' }
]
const skills = (from: string[]) => ({
  choose: {
    key: 'habilidades',
    label: t('Habilidades', 'Skills'),
    count: '2',
    set: 'habilidades',
    from,
    when: '@este.inicial'
  }
})
const subclass = {
  level: 3,
  choose: { key: 'subclase', label: t('Subclase', 'Subclass'), count: '1', type: 'subclase', from: ['campeon'] }
}
const feat = (key: string, label: { es: string; en: string }) => ({ choose: { key, label, count: '1', type: 'dote' } })

const STYLES_2014 = [
  ['Archery', 'Tiro con Arco', 'tiro_con_arco'],
  ['Defense', 'Defensa', 'defensa'],
  ['Dueling', 'Duelo', 'duelo'],
  ['Great Weapon Fighting', 'Combate con Armas a Dos Manos', 'combate_con_armas_a_dos_manos'],
  ['Protection', 'Protección', 'proteccion'],
  ['Two-Weapon Fighting', 'Combate con Dos Armas', 'combate_con_dos_armas']
] as const
const styleKeys = STYLES_2014.map(([, , k]) => `estilo_de_combate_${k}`)
const chooseStyle = {
  choose: { key: 'estilo', label: t('Estilo de combate', 'Fighting Style'), count: '1', type: 'rasgo', from: styleKeys }
}

export const FIGHTER: Record<'2014' | '2024', ClassConfig> = {
  '2014': {
    concept: 'guerrero',
    name: t('Guerrero', 'Fighter'),
    edition: '2014',
    pages: { en: [24, 25], es: [34, 35] },
    shape: {
      en: {
        heading: new Map(),
        subclass: /^(Champion)$/,
        table: /^(The Fighter|Martial Archetypes)$/,
        stop: /^Monk$/
      },
      es: {
        heading: new Map(),
        subclass: /^(Campeón)$/,
        table: /^(El guerrero|Arquetipos marciales)$/,
        stop: /^Monje$/
      }
    },
    data: { dado: 10, dado_golpe: '1d10', lanzamiento: '' },
    features: [
      { en: 'Fighting Style', es: 'Estilo de Combate', key: 'guerrero_estilo_de_combate', level: 1 },
      ...STYLES_2014.map(([en, es, k]) => ({ en, es, key: `estilo_de_combate_${k}`, level: null })),
      { en: 'Second Wind', es: 'Tomar Aliento', key: 'guerrero_tomar_aliento', level: 1 },
      { en: 'Action Surge', es: 'Acción Súbita', key: 'guerrero_accion_subita', level: 2 },
      { en: 'Martial Archetype', es: 'Arquetipo Marcial', key: 'guerrero_arquetipo_marcial', level: 3 },
      {
        en: 'Ability Score Improvement',
        es: 'Mejora de Característica',
        key: 'guerrero_mejora_de_caracteristica',
        level: 4,
        also: [6, 8, 12, 14, 16, 19]
      },
      { en: 'Extra Attack', es: 'Ataque Adicional', key: 'guerrero_ataque_adicional', level: 5 },
      { en: 'Indomitable', es: 'Indómito', key: 'guerrero_indomito', level: 9 }
    ],
    subclass: {
      concept: 'campeon',
      name: t('Campeón', 'Champion'),
      features: [
        { en: 'Improved Critical', es: 'Crítico Mejorado', key: 'campeon_critico_mejorado', level: 3 },
        { en: 'Remarkable Athlete', es: 'Atleta Sobresaliente', key: 'campeon_atleta_sobresaliente', level: 7 },
        {
          en: 'Additional Fighting Style',
          es: 'Estilo de Combate Adicional',
          key: 'campeon_estilo_de_combate_adicional',
          level: 10
        },
        { en: 'Superior Critical', es: 'Crítico Superior', key: 'campeon_critico_superior', level: 15 },
        { en: 'Survivor', es: 'Superviviente', key: 'campeon_superviviente', level: 18 }
      ]
    }
  },
  '2024': {
    concept: 'guerrero',
    name: t('Guerrero', 'Fighter'),
    edition: '2024',
    pages: { en: [47, 48, 49], es: [62, 63, 64] },
    shape: {
      en: {
        heading: /^Level (\d+): (.+)$/,
        subclass: /^Fighter Subclass: (.+)$/,
        table: /^Fighter Features$/,
        stop: /^Monk$/
      },
      es: {
        heading: /^Nivel (\d+): (.+)$/,
        subclass: /^Subclase de guerrero: (.+)$/,
        table: /^Rasgos de guerrero$/,
        stop: /^Hechicero$/
      }
    },
    data: { dado: 10, dado_golpe: '1d10', lanzamiento: '' },
    features: [
      { en: 'Fighting Style', es: 'Estilo de combate', key: 'guerrero_estilo_de_combate', level: 1 },
      { en: 'Second Wind', es: 'Tomar aliento', key: 'guerrero_tomar_aliento', level: 1 },
      { en: 'Weapon Mastery', es: 'Maestría con armas', key: 'guerrero_maestria_con_armas', level: 1 },
      { en: 'Action Surge', es: 'Acción súbita', key: 'guerrero_accion_subita', level: 2 },
      { en: 'Tactical Mind', es: 'Mente táctica', key: 'guerrero_mente_tactica', level: 2 },
      { en: 'Fighter Subclass', es: 'Subclase de guerrero', key: 'guerrero_subclase_de_guerrero', level: 3 },
      {
        en: 'Ability Score Improvement',
        es: 'Mejora de característica',
        key: 'guerrero_mejora_de_caracteristica',
        level: 4,
        also: [6, 8, 12, 14, 16]
      },
      { en: 'Extra Attack', es: 'Ataque adicional', key: 'guerrero_ataque_adicional', level: 5 },
      { en: 'Tactical Shift', es: 'Desplazamiento táctico', key: 'guerrero_desplazamiento_tactico', level: 5 },
      { en: 'Indomitable', es: 'Indómito', key: 'guerrero_indomito', level: 9 },
      { en: 'Tactical Master', es: 'Maestro táctico', key: 'guerrero_maestro_tactico', level: 9 },
      { en: 'Two Extra Attacks', es: 'Dos ataques adicionales', key: 'guerrero_dos_ataques_adicionales', level: 11 },
      { en: 'Studied Attacks', es: 'Ataques estudiados', key: 'guerrero_ataques_estudiados', level: 13 },
      { en: 'Epic Boon', es: 'Don épico', key: 'guerrero_don_epico', level: 19 },
      { en: 'Three Extra Attacks', es: 'Tres ataques adicionales', key: 'guerrero_tres_ataques_adicionales', level: 20 }
    ],
    subclass: {
      concept: 'campeon',
      name: t('Campeón', 'Champion'),
      features: [
        { en: 'Improved Critical', es: 'Crítico mejorado', key: 'campeon_critico_mejorado', level: 3 },
        { en: 'Remarkable Athlete', es: 'Atleta sobresaliente', key: 'campeon_atleta_sobresaliente', level: 3 },
        {
          en: 'Additional Fighting Style',
          es: 'Estilo de combate adicional',
          key: 'campeon_estilo_de_combate_adicional',
          level: 7
        },
        { en: 'Heroic Warrior', es: 'Guerrero heroico', key: 'campeon_guerrero_heroico', level: 10 },
        { en: 'Superior Critical', es: 'Crítico superior', key: 'campeon_critico_superior', level: 15 },
        { en: 'Survivor', es: 'Superviviente', key: 'campeon_superviviente', level: 18 }
      ]
    }
  }
}

// En 2014, los rasgos se reconocen por su nombre, con su nivel
for (const lang of ['en', 'es'] as const) {
  const shape = FIGHTER['2014'].shape[lang]
  const names = shape.heading as Map<string, number | null>
  for (const f of FIGHTER['2014'].features) names.set(f[lang], f.level)
  for (const f of FIGHTER['2014'].subclass.features) names.set(f[lang], f.level)
}

/** Las competencias de la clase y lo que concede, en cada edición */
export const FIGHTER_CLASS: Record<'2014' | '2024', Record<string, unknown>> = {
  '2014': {
    effects: proficiencies(true),
    grants: [
      skills([
        'acrobacias',
        'trato_con_animales',
        'atletismo',
        'historia',
        'perspicacia',
        'intimidacion',
        'percepcion',
        'supervivencia'
      ]),
      subclass
    ],
    automation: 'partial',
    manual: t('El equipo inicial se elige a mano', 'Starting equipment is chosen by hand')
  },
  '2024': {
    effects: proficiencies(false),
    grants: [
      skills([
        'acrobacias',
        'trato_con_animales',
        'atletismo',
        'historia',
        'perspicacia',
        'intimidacion',
        'persuasion',
        'percepcion',
        'supervivencia'
      ]),
      subclass
    ],
    automation: 'partial',
    manual: t('El equipo inicial se elige a mano', 'Starting equipment is chosen by hand')
  }
}

const secondWind = (max: string, amount?: string) => ({
  resources: [{ key: 'usos', label: t('Usos', 'Uses'), max, recovery: 'short', ...(amount ? { amount } : {}) }],
  actions: [
    {
      key: 'usar',
      label: t('Tomar aliento', 'Second Wind'),
      activation: 'bonus',
      heal: '1d10 + @origen.nivel',
      uses: 'usos'
    }
  ],
  automation: 'full'
})
const actionSurge = {
  resources: [{ key: 'usos', label: t('Usos', 'Uses'), max: `${level(17)} ? 2 : 1`, recovery: 'short' }],
  actions: [{ key: 'usar', label: t('Acción súbita', 'Action Surge'), activation: 'free', uses: 'usos' }],
  automation: 'full'
}
const indomitable = (manual: { es: string; en: string }) => ({
  resources: [
    { key: 'usos', label: t('Usos', 'Uses'), max: `${level(17)} ? 3 : ${level(13)} ? 2 : 1`, recovery: 'long' }
  ],
  automation: 'partial',
  manual
})
const attacks = (value: string) => ({ effects: [{ target: 'ataques', op: 'min', value }], automation: 'full' })
const critical = (value: string) => ({ effects: [{ target: 'critico_desde', op: 'max', value }], automation: 'full' })
const text = { automation: 'text' }

/** La mecánica de cada rasgo, por su clave y su edición */
export const FIGHTER_FEATURES: Record<'2014' | '2024', Record<string, Record<string, unknown>>> = {
  '2014': {
    guerrero_estilo_de_combate: { grants: [chooseStyle], automation: 'full' },
    estilo_de_combate_tiro_con_arco: {
      effects: [{ target: 'bono_ataque_distancia', op: 'add', value: '2' }],
      automation: 'full'
    },
    estilo_de_combate_defensa: {
      effects: [{ target: 'ca', op: 'add', value: '1', when: '@con_armadura' }],
      automation: 'full'
    },
    estilo_de_combate_duelo: {
      automation: 'partial',
      manual: t(
        '+2 al daño con un arma cuerpo a cuerpo en una mano y sin otra',
        '+2 damage with a one-handed melee weapon and no other'
      )
    },
    estilo_de_combate_combate_con_armas_a_dos_manos: {
      automation: 'partial',
      manual: t(
        'Repite los 1 y los 2 del daño con armas a dos manos o versátiles',
        'Reroll 1s and 2s on damage with two-handed or versatile weapons'
      )
    },
    estilo_de_combate_proteccion: {
      actions: [{ key: 'proteger', label: t('Proteger', 'Protect'), activation: 'reaction' }],
      automation: 'partial',
      manual: t(
        'Con escudo, da desventaja a un ataque contra otro a 1,5 m',
        'With a shield, impose disadvantage on an attack against another within 5 feet'
      )
    },
    estilo_de_combate_combate_con_dos_armas: {
      automation: 'partial',
      manual: t('Suma el modificador al daño del segundo ataque', 'Add your modifier to the second attack’s damage')
    },
    guerrero_tomar_aliento: secondWind('1'),
    guerrero_accion_subita: actionSurge,
    guerrero_arquetipo_marcial: text,
    guerrero_mejora_de_caracteristica: {
      grants: [
        {
          choose: {
            key: 'mejora',
            label: t('Mejora de característica', 'Ability Score Improvement'),
            count: '2',
            set: 'caracteristicas',
            field: 'puntuacion',
            op: 'add'
          }
        }
      ],
      automation: 'partial',
      manual: t('Como mucho 20 en cada característica', 'At most 20 in each ability')
    },
    guerrero_ataque_adicional: attacks(`${level(20)} ? 4 : ${level(11)} ? 3 : 2`),
    guerrero_indomito: indomitable(t('Repite una salvación fallida', 'Reroll a failed saving throw')),
    campeon_critico_mejorado: critical('19'),
    campeon_atleta_sobresaliente: {
      effects: [
        ...['fue', 'des', 'con'].map((c) => ({ target: `caracteristicas.${c}.prueba_grado`, op: 'min', value: '0.5' })),
        ...['atletismo', 'acrobacias', 'juego_de_manos', 'sigilo'].map((h) => ({
          target: `habilidades.${h}.grado`,
          op: 'min',
          value: '0.5'
        }))
      ],
      automation: 'partial',
      manual: t('El salto largo con carrerilla, más largo', 'Longer running long jump')
    },
    campeon_estilo_de_combate_adicional: { grants: [chooseStyle], automation: 'full' },
    campeon_critico_superior: critical('18'),
    campeon_superviviente: {
      automation: 'partial',
      manual: t(
        'Al empezar tu turno, con la mitad de los PG o menos, recuperas 5 + Con',
        'At the start of your turn, at half HP or less, regain 5 + Con'
      )
    }
  },
  '2024': {
    guerrero_estilo_de_combate: {
      grants: [feat('estilo', t('Estilo de combate', 'Fighting Style'))],
      automation: 'partial',
      manual: t('Una dote de estilo de combate', 'A Fighting Style feat')
    },
    guerrero_tomar_aliento: secondWind(`${level(10)} ? 4 : ${level(4)} ? 3 : 2`, '1'),
    guerrero_maestria_con_armas: {
      grants: [
        {
          choose: {
            key: 'maestrias',
            label: t('Maestrías', 'Masteries'),
            count: `${level(16)} ? 6 : ${level(10)} ? 5 : ${level(4)} ? 4 : 3`,
            type: 'arma'
          }
        }
      ],
      automation: 'partial',
      manual: t(
        'Usas la propiedad de maestría de las armas elegidas',
        'You use the mastery property of the chosen weapons'
      )
    },
    guerrero_accion_subita: actionSurge,
    guerrero_mente_tactica: {
      automation: 'partial',
      manual: t(
        'Gasta un uso de Tomar aliento para sumar 1d10 a una prueba fallida',
        'Spend a Second Wind use to add 1d10 to a failed check'
      )
    },
    guerrero_subclase_de_guerrero: text,
    guerrero_mejora_de_caracteristica: {
      grants: [feat('dote', t('Dote', 'Feat'))],
      automation: 'partial',
      manual: t('La dote Mejora de característica u otra', 'The Ability Score Improvement feat or another')
    },
    guerrero_ataque_adicional: attacks('2'),
    guerrero_desplazamiento_tactico: text,
    guerrero_indomito: indomitable(
      t(
        'Repite una salvación fallida con un bonificador igual a tu nivel de guerrero',
        'Reroll a failed save with a bonus equal to your Fighter level'
      )
    ),
    guerrero_maestro_tactico: text,
    guerrero_dos_ataques_adicionales: attacks('3'),
    guerrero_ataques_estudiados: text,
    guerrero_don_epico: {
      grants: [feat('don', t('Don épico', 'Epic Boon'))],
      automation: 'partial',
      manual: t('Una dote de don épico', 'An Epic Boon feat')
    },
    guerrero_tres_ataques_adicionales: attacks('4'),
    campeon_critico_mejorado: critical('19'),
    campeon_atleta_sobresaliente: {
      effects: [
        { target: 'iniciativa', op: 'advantage' },
        { target: 'habilidad.atletismo', op: 'advantage' }
      ],
      automation: 'partial',
      manual: t('Tras un crítico, te mueves la mitad de tu velocidad', 'After a critical hit, move half your speed')
    },
    campeon_estilo_de_combate_adicional: {
      grants: [feat('estilo', t('Estilo de combate', 'Fighting Style'))],
      automation: 'partial',
      manual: t('Otra dote de estilo de combate', 'Another Fighting Style feat')
    },
    campeon_guerrero_heroico: text,
    campeon_critico_superior: critical('18'),
    campeon_superviviente: {
      effects: [{ target: 'salvacion_muerte', op: 'advantage' }],
      automation: 'partial',
      manual: t(
        'Un 18 a 20 en la salvación contra muerte cuenta como un 20; ensangrentado, recuperas 5 + Con al empezar tu turno',
        'An 18–20 on a death save counts as a 20; while bloodied, regain 5 + Con at the start of your turn'
      )
    }
  }
}

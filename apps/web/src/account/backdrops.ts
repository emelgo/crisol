/**
 * Los fondos de las pantallas de cuenta (Entrar, unirse, el arranque), que van pasando como en LegendKeeper. Son de
 * Crisol: pintados para la app en su estilo (F, docs/imagenes.md), generados por Enrique con ChatGPT (2026-11-12; origen
 * en docs/terceros.md), así que no llevan crédito. tint: su color medio, oscurecido, para teñir el degradado de encima.
 * Los archivos, en public/fondos/
 */
export interface Backdrop {
  file: string
  title: string
  tint: string
}

export const BACKDROPS: readonly Backdrop[] = [
  { file: 'archipielago', title: 'Ruinas flotantes entre nubes y cascadas', tint: '#182027' },
  { file: 'bahia', title: 'Bahía Costera al Anochecer', tint: '#21110d' },
  { file: 'campamento', title: 'Amanecer sobre el mar de nubes', tint: '#261e22' },
  { file: 'ciervo', title: 'Ruinas entre rayos de luz y ciervos', tint: '#181e19' },
  { file: 'ciudad', title: 'Ciudad fantástica al atardecer', tint: '#160e12' },
  { file: 'forja', title: 'Forja en las profundidades enanas', tint: '#0d090c' },
  { file: 'pantano', title: 'Pantano brumoso entre cabaña y barca', tint: '#181b1d' },
  { file: 'puente', title: 'Puente ancestral bajo la tormenta', tint: '#121619' },
  { file: 'cascada', title: 'Valle selvático con templo y cascada', tint: '#1a2125' },
  { file: 'desierto', title: 'Ruinas bajo la luna del desierto', tint: '#160d12' },
  { file: 'aurora', title: 'Torre iluminada bajo la aurora boreal', tint: '#110c15' },
  { file: 'valle', title: 'Valle Dorado al Atardecer', tint: '#1f1517' }
]

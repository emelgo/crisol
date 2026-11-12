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
  { file: 'archipielago', title: 'Archipiélago flotante al atardecer', tint: '#191016' },
  { file: 'bahia', title: 'Bahía Costera al Anochecer', tint: '#21110d' },
  { file: 'campamento', title: 'Campamento al atardecer entre montañas y dragones', tint: '#181013' },
  { file: 'ciervo', title: 'Ciervo en las ruinas del bosque encantado', tint: '#121013' },
  { file: 'ciudad', title: 'Ciudad fantástica al atardecer', tint: '#160e12' },
  { file: 'forja', title: 'Forja en las profundidades enanas', tint: '#0d090c' },
  { file: 'pantano', title: 'Pantano mágico al anochecer', tint: '#1c0f12' },
  { file: 'puente', title: 'Puente antiguo sobre el valle brumoso', tint: '#170e13' },
  { file: 'cascada', title: 'Ruinas ancestrales junto a la cascada', tint: '#1d1415' },
  { file: 'desierto', title: 'Ruinas bajo la luna del desierto', tint: '#160d12' },
  { file: 'aurora', title: 'Torre iluminada bajo la aurora boreal', tint: '#110c15' },
  { file: 'valle', title: 'Valle Dorado al Atardecer', tint: '#1f1517' }
]

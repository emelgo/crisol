/**
 * Los mapas que dibuja la IA en SVG (docs/specs/escenas.md § «Mapas dibujados por la IA»): sus medidas y lo que no
 * puede llevar. El SVG solo se pinta como imagen (sin scripts ni nada de fuera), pero aun así se rechaza lo que podría
 * ejecutar código o cargar algo ajeno
 */

/** Lo más que pesa un mapa dibujado, y lo más que mide de lado */
export const MAX_SVG_BYTES = 4 * 1024 * 1024
export const MAX_SVG_SIDE = 16_384

const FORBIDDEN: Array<[RegExp, string]> = [
  [/<script[\s>/]/i, 'scripts'],
  [/<foreignObject[\s>/]/i, 'foreignObject'],
  [/<(iframe|embed|object|audio|video|image)[\s>/]/i, 'elementos que cargan algo de fuera'],
  [/\son[a-z]+\s*=/i, 'atributos de eventos (on…)'],
  [/javascript:/i, 'enlaces javascript:'],
  [/(?:href|src)\s*=\s*["']\s*(?!#)[^"'\s]/i, 'enlaces que no son de dentro (#id)'],
  [/url\(\s*["']?\s*(?!#)[^)\s]/i, 'url() que no es de dentro (#id)'],
  [/@import/i, '@import'],
  [/<!ENTITY/i, 'entidades XML']
]

/**
 * Las únicas etiquetas que puede llevar (lista blanca): las de dibujar formas, texto, degradados, patrones, recortes y
 * filtros. Ni enlaces, ni animaciones (pueden cambiar un href), ni nada con prefijo (`svg:script`)
 */
const ALLOWED_TAGS = new Set(
  [
    'svg',
    'g',
    'defs',
    'title',
    'desc',
    'metadata',
    'symbol',
    'use',
    'style',
    'path',
    'rect',
    'circle',
    'ellipse',
    'line',
    'polyline',
    'polygon',
    'text',
    'tspan',
    'textPath',
    'linearGradient',
    'radialGradient',
    'stop',
    'pattern',
    'clipPath',
    'mask',
    'marker',
    'filter',
    'feBlend',
    'feColorMatrix',
    'feComponentTransfer',
    'feComposite',
    'feConvolveMatrix',
    'feDiffuseLighting',
    'feDisplacementMap',
    'feDistantLight',
    'feDropShadow',
    'feFlood',
    'feFuncA',
    'feFuncB',
    'feFuncG',
    'feFuncR',
    'feGaussianBlur',
    'feMerge',
    'feMergeNode',
    'feMorphology',
    'feOffset',
    'fePointLight',
    'feSpecularLighting',
    'feSpotLight',
    'feTile',
    'feTurbulence'
  ].map((tag) => tag.toLowerCase())
)

/** Lo que el SVG no puede llevar; null si vale */
export function svgProblem(text: string): string | null {
  if (new TextEncoder().encode(text).length > MAX_SVG_BYTES) return 'pasa de 4 MB'
  if (!/^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(text)) return 'no empieza por <svg>'
  for (const [pattern, what] of FORBIDDEN) if (pattern.test(text)) return `no puede llevar ${what}`
  // Cada etiqueta que abre (las de cierre, los comentarios y CDATA no cuentan)
  for (const [, tag] of text.matchAll(/<([^\s/>!?][^\s/>]*)/g))
    if (tag && !ALLOWED_TAGS.has(tag.toLowerCase())) return `no puede llevar <${tag}>`
  return null
}

const number = (value: string | undefined) => {
  const match = value?.trim().match(/^(\d+(?:\.\d+)?)(px)?$/)
  return match ? Number(match[1]) : null
}

/** Sus medidas en píxeles: width y height de la etiqueta svg o, si no, su viewBox. null si no se saben */
export function svgSize(text: string): { width: number; height: number } | null {
  const tag = text.match(/<svg\b[^>]*>/i)?.[0]
  if (!tag) return null
  const attr = (name: string) => tag.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1]
  let width = number(attr('width'))
  let height = number(attr('height'))
  if (width === null || height === null) {
    const box = attr('viewBox')
      ?.trim()
      .split(/[\s,]+/)
      .map(Number)
    if (box?.length === 4 && box.every(Number.isFinite)) {
      width ??= box[2] as number
      height ??= box[3] as number
    }
  }
  if (!width || !height || width > MAX_SVG_SIDE || height > MAX_SVG_SIDE) return null
  return { width: Math.round(width), height: Math.round(height) }
}

/**
 * Lo dibujado en un mapa (módulo 9): regiones, rutas y textos por capas, en un SVG del tamaño de la imagen que va dentro
 * del escenario (se mueve y se acerca con él). Los trazos guardan su grosor en pantalla; los textos crecen con el
 * mapa, como en uno impreso. Lo de las capas apagadas en esta pantalla no se pinta
 */
import '@fontsource/alegreya/400.css'
import '@fontsource/alegreya/400-italic.css'
import type { MapElementView, MapLayerView, MapStyle } from '@crisol/contracts'
import { type MouseEvent, memo, type PointerEvent } from 'react'
import { colorHex } from '../../routes/world-look.ts'
import { arcPath, fontPixels, paintOrder, pathOf, regionLabelAt, type Size, toPixels } from './geometry.ts'
import styles from './map.module.css'

const DASHES = { solid: undefined, dashed: '10 6', dotted: '2 5' } as const

/** Lo de serie de cada clase: el nombre de una región y el de una ruta, siempre; el texto es su propio nombre */
const DEFAULTS: Record<MapElementView['kind'], Required<Pick<MapStyle, 'width' | 'size' | 'display'>>> = {
  region: { width: 2, size: 26, display: 1 },
  path: { width: 3, size: 14, display: 1 },
  label: { width: 1, size: 20, display: 1 }
}

export const elementName = (element: Pick<MapElementView, 'label' | 'pageTitle'>) =>
  element.label ?? element.pageTitle ?? ''

/** El color de un elemento en hexadecimal (sin decir, el vino de la app) */
const hexOf = (style: MapStyle) => colorHex(style.color ?? 'wine') ?? '#9c2b26'

export const MapDrawing = memo(function MapDrawing({
  id,
  image,
  layers,
  elements,
  hiddenHere,
  selected,
  live,
  onOpen,
  onElementPointerDown,
  onElementClick
}: {
  /** Para los ids de sus patrones (hay más de un mapa en la página) */
  id: string
  image: Size
  layers: readonly MapLayerView[]
  elements: readonly MapElementView[]
  /** Las capas apagadas en esta pantalla */
  hiddenHere: ReadonlySet<string>
  selected?: string | null
  /** Lo que se está retocando, con su forma de ahora (aún sin guardar) */
  live?: { id: string; geometry: MapElementView['geometry'] } | null
  /** Doble clic en algo que lleva a una página */
  onOpen?: (pageId: string) => void
  onElementPointerDown?: (event: PointerEvent<SVGGElement>, element: MapElementView) => void
  onElementClick?: (event: MouseEvent<SVGGElement>, element: MapElementView) => void
}) {
  // Lo de antes de las capas (sin capa) cuenta como de la primera
  const first = layers[0]?.id
  const shown = paintOrder(elements, layers)
    .filter((element) => {
      const layer = element.layerId ?? first
      return !(layer && hiddenHere.has(layer))
    })
    .map((element) => (live && element.id === live.id ? { ...element, geometry: live.geometry } : element))
  // Un patrón de rayas por color que se use rayado
  const hatches = [
    ...new Set(shown.filter((e) => e.kind === 'region' && e.style.fill === 'hatch').map((e) => hexOf(e.style)))
  ]
  const open = (element: MapElementView) => (event: MouseEvent) => {
    if (!element.pageId || !onOpen) return
    event.stopPropagation()
    onOpen(element.pageId)
  }
  return (
    <svg
      className={styles.drawing}
      viewBox={`0 0 ${image.width} ${image.height}`}
      width={image.width}
      height={image.height}
      aria-hidden="true"
    >
      <defs>
        {hatches.map((hex) => (
          <pattern
            key={hex}
            id={`${id}-hatch-${hex.slice(1)}`}
            width="10"
            height="10"
            patternUnits="userSpaceOnUse"
            patternTransform={`rotate(45) scale(${Math.max(1, image.width / 1000)})`}
          >
            <path d="M0 0v10" stroke={hex} strokeWidth="3" />
          </pattern>
        ))}
        {shown
          .filter((e) => e.kind === 'path' && 'points' in e.geometry)
          .map((e) => (
            <path
              key={e.id}
              id={`${id}-route-${e.id}`}
              d={pathOf((e.geometry as { points: number[][] }).points, image, false)}
            />
          ))}
      </defs>
      {shown.map((element) => (
        <Element
          key={element.id}
          id={id}
          element={element}
          image={image}
          selected={element.id === selected}
          onDoubleClick={open(element)}
          onPointerDown={onElementPointerDown ? (event) => onElementPointerDown(event, element) : undefined}
          onClick={onElementClick ? (event) => onElementClick(event, element) : undefined}
        />
      ))}
    </svg>
  )
})

function Element({
  id,
  element,
  image,
  selected,
  onDoubleClick,
  onPointerDown,
  onClick
}: {
  id: string
  element: MapElementView
  image: Size
  selected: boolean
  onDoubleClick: (event: MouseEvent) => void
  onPointerDown?: (event: PointerEvent<SVGGElement>) => void
  onClick?: (event: MouseEvent<SVGGElement>) => void
}) {
  const { style, geometry } = element
  const base = DEFAULTS[element.kind]
  const hex = hexOf(style)
  const name = elementName(element)
  const display = style.display ?? base.display
  const fontSize = fontPixels(style.size, image, base.size)
  const stroke = {
    stroke: hex,
    strokeWidth: style.width ?? base.width,
    strokeDasharray: DASHES[style.stroke ?? 'solid'],
    vectorEffect: 'non-scaling-stroke' as const
  }
  const common = {
    className: styles.element,
    'data-kind': element.kind,
    'data-display': display,
    'data-selected': selected || undefined,
    'data-hidden': element.hidden || undefined,
    'data-link': element.pageId ? true : undefined,
    'data-id': element.id,
    onDoubleClick,
    onPointerDown,
    onClick
  }
  if (element.kind === 'region' && 'pieces' in geometry) {
    const d = geometry.pieces.map((piece) => pathOf(piece, image, true)).join(' ')
    const fill = style.fill === 'none' ? 'none' : style.fill === 'hatch' ? `url(#${id}-hatch-${hex.slice(1)})` : hex
    const [lx, ly] = regionLabelAt(geometry.pieces, image)
    return (
      <g {...common}>
        <path
          d={d}
          fill={fill}
          fillOpacity={style.fill === 'hatch' ? 1 : (style.opacity ?? 0.25)}
          fillRule="evenodd"
          {...stroke}
        />
        {name && display !== 2 && (
          <text
            className={styles.elementName}
            x={lx}
            y={ly}
            fontSize={fontSize}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {name}
          </text>
        )}
      </g>
    )
  }
  if (element.kind === 'path' && 'points' in geometry) {
    return (
      <g {...common}>
        {/* Un trazo ancho y transparente debajo, para poder pulsarla */}
        <path
          d={pathOf(geometry.points, image, false)}
          fill="none"
          stroke="transparent"
          strokeWidth={14}
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={pathOf(geometry.points, image, false)}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          {...stroke}
        />
        {name && display !== 2 && (
          <text className={styles.elementName} fontSize={fontSize} dy={-fontSize * 0.4}>
            <textPath href={`#${id}-route-${element.id}`} startOffset="50%" textAnchor="middle">
              {name}
            </textPath>
          </text>
        )}
      </g>
    )
  }
  if (element.kind === 'label' && 'at' in geometry) {
    const at = toPixels(geometry.at, image)
    const rotate = geometry.rotate ?? 0
    const arc = geometry.arc ?? 0
    const transform = rotate ? `rotate(${rotate} ${at[0]} ${at[1]})` : undefined
    return (
      <g {...common} transform={transform}>
        {arc ? (
          <>
            <path id={`${id}-arc-${element.id}`} d={arcPath(at, name, fontSize, arc)} fill="none" />
            <text className={styles.mapText} fontSize={fontSize} fill={hex}>
              <textPath href={`#${id}-arc-${element.id}`} startOffset="50%" textAnchor="middle">
                {name}
              </textPath>
            </text>
          </>
        ) : (
          <text
            className={styles.mapText}
            x={at[0]}
            y={at[1]}
            fontSize={fontSize}
            fill={hex}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {name}
          </text>
        )}
      </g>
    )
  }
  return null
}

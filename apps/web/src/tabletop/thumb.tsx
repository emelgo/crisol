/** La miniatura de una escena: las teselas de su nivel más pequeño (unas pocas), juntas y recortadas a la caja */
import type { SceneView } from '@crisol/contracts'
import { tilesInRect, tileWorldRect } from '@crisol/tabletop'
import styles from './mesa.module.css'
import { masterTileUrl } from './queries.ts'
import { pyramidOf } from './view.ts'

export function SceneThumb({ scene }: { scene: SceneView }) {
  const image = scene.image
  const pyramid = image ? pyramidOf(image) : null
  if (!image?.tiles || !pyramid) return <span className={styles.thumb} aria-hidden="true" />
  const top = pyramid.levels.length - 1
  const url = masterTileUrl(scene.id, image.tiles.version)
  return (
    <span className={styles.thumb} aria-hidden="true">
      <span className={styles.thumbImage} style={{ aspectRatio: `${image.width} / ${image.height}` }}>
        {tilesInRect(pyramid, top, { x: 0, y: 0, width: image.width, height: image.height }).map((ref) => {
          const rect = tileWorldRect(pyramid, ref)
          return (
            <img
              key={`${ref.x}/${ref.y}`}
              src={url(ref.level, ref.x, ref.y)}
              alt=""
              loading="lazy"
              style={{
                left: `${(rect.x / image.width) * 100}%`,
                top: `${(rect.y / image.height) * 100}%`,
                width: `${(rect.width / image.width) * 100}%`,
                height: `${(rect.height / image.height) * 100}%`
              }}
            />
          )
        })}
      </span>
    </span>
  )
}

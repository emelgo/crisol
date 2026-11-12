/**
 * La escena en una ventana de la Mesa (ADR-0020): la suelta, con su editor (el mapa, la rejilla y sus ajustes, como en
 * la pestaña «Escena» de una página); la de una página, su página
 */
import type { SceneView } from '@crisol/contracts'
import type { WindowSpec } from '../components/windows.tsx'
import { SceneMain, SceneProvider, SceneSide } from '../wiki/scene/scene-tab.tsx'
import { pageWindow } from './page-window.tsx'
import styles from './scene-window.module.css'

export function sceneWindow(
  worldId: string,
  scene: Pick<SceneView, 'id' | 'name' | 'tabId' | 'pageId' | 'pageTitle'>
): WindowSpec {
  if (scene.pageId) return pageWindow(worldId, scene.pageId, scene.pageTitle ?? scene.name)
  return {
    id: `scene:${scene.id}`,
    title: scene.name,
    width: 1040,
    height: 680,
    render: () => (
      <SceneProvider worldId={worldId} tabId={null} sceneId={scene.id} name={scene.name} editable inPage={false}>
        <div className={styles.editor}>
          <div className={styles.main}>
            <SceneMain />
          </div>
          <aside className={styles.side}>
            <SceneSide />
          </aside>
        </div>
      </SceneProvider>
    )
  }
}

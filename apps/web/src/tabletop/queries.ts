/**
 * Las consultas de las escenas, bajo las de las páginas del mundo: cuando algo cambia en la wiki (la IA, otra pestaña)
 * el aviso en tiempo real de las páginas las refresca también
 */
export const sceneListKey = (worldId: string) => ['pages', worldId, 'scenes']
export const sceneTabKey = (worldId: string, tabId: string) => ['pages', worldId, 'scenes', 'tab', tabId]

/** La dirección de una tesela para quien prepara el mundo (la tele usa la suya, la de su campaña) */
export const masterTileUrl = (sceneId: string, version: string) => (level: number, x: number, y: number) =>
  `/api/scenes/${sceneId}/tiles/${version}/${level}/${x}/${y}`

export const screenTileUrl = (campaignId: string, version: string) => (level: number, x: number, y: number) =>
  `/api/campaigns/${campaignId}/screen/tiles/${version}/${level}/${x}/${y}`

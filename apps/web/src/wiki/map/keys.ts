/** La clave del mapa de una pestaña en la caché (la piden el visor y sus paneles) */
export const mapKey = (worldId: string, tabId: string) => ['pages', worldId, 'map', tabId]

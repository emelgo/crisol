/**
 * Cuántos documentos de cada tipo trae el SRD de cada edición, contados a mano en los PDF (srd-5e): lo sacado tiene que
 * dar esto. Crece con cada categoría
 */
export const MEASURED: Record<string, Record<'2014' | '2024', number>> = {
  arma: { '2014': 37, '2024': 38 },
  armadura: { '2014': 13, '2024': 13 },
  // El equipo de aventurero y las herramientas: en 2014, 99 y 35; en 2024, 78 de su tabla, 16 de munición,
  // canalizadores y símbolos sagrados, y 37 herramientas (con las variantes de los juegos y los instrumentos)
  // Y las monturas, los arreos y los vehículos (y las mercancías de 2014): 40 y 25
  equipo: { '2014': 174, '2024': 156 },
  // Por ahora, el guerrero: la clase, el campeón y sus rasgos (en 2014, con los seis estilos de combate)
  clase: { '2014': 1, '2024': 1 },
  subclase: { '2014': 1, '2024': 1 },
  rasgo: { '2014': 18, '2024': 21 },
  estado: { '2014': 15, '2024': 15 },
  // El texto de las reglas: cada sección de los capítulos de reglas (y su introducción) y, en 2024, las 140 entradas del
  // glosario que no son estados. Sin las listas de objetos (ya son contenido); la introducción de los monstruos de 2014,
  // larga, en sus 19 apartados
  regla: { '2014': 72, '2024': 188 },
  conjuro: { '2014': 319, '2024': 339 }
}

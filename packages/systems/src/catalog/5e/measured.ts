/**
 * Cuántos documentos de cada tipo trae el SRD de cada edición, contados a mano en los PDF (srd-5e): lo sacado tiene que
 * dar esto. Crece con cada categoría
 */
export const MEASURED: Record<string, Record<'2014' | '2024', number>> = {
  arma: { '2014': 37, '2024': 38 },
  armadura: { '2014': 13, '2024': 13 },
  // 2014: el equipo de aventurero (99) y las herramientas (35); 2024, por ahora, la tabla de equipo de aventurero
  equipo: { '2014': 134, '2024': 78 },
  // Por ahora, el guerrero: la clase, el campeón y sus rasgos (en 2014, con los seis estilos de combate)
  clase: { '2014': 1, '2024': 1 },
  subclase: { '2014': 1, '2024': 1 },
  rasgo: { '2014': 18, '2024': 21 }
}

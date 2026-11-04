/**
 * Cuántos documentos de cada tipo trae el SRD de cada edición, contados a mano en los PDF (srd-5e): lo sacado tiene que
 * dar esto. Crece con cada categoría
 */
export const MEASURED: Record<string, Record<'2014' | '2024', number>> = {
  arma: { '2014': 37, '2024': 38 },
  armadura: { '2014': 13, '2024': 13 }
}

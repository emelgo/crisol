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
  // Las 12 clases con su subclase del SRD
  clase: { '2014': 12, '2024': 12 },
  subclase: { '2014': 12, '2024': 12 },
  // Los de las clases y sus subclases (el guerrero, 18 y 21, con los estilos de combate de 2014; las otras once, 170 y
  // 221, con las listas de conjuros y las opciones de 2024) y los de las especies y subrazas (92 y 33)
  rasgo: { '2014': 280, '2024': 275 },
  estado: { '2014': 15, '2024': 15 },
  // El texto de las reglas: cada sección de los capítulos de reglas (y su introducción) y, en 2024, las 140 entradas del
  // glosario que no son estados. Sin las listas de objetos (ya son contenido); la introducción de los monstruos de 2014,
  // larga, en sus 19 apartados
  regla: { '2014': 72, '2024': 188 },
  conjuro: { '2014': 319, '2024': 339 },
  objeto_magico: { '2014': 238, '2024': 258 },
  // Los monstruos y, en 2014, las criaturas diversas y los PNJ de sus apéndices; en 2024, los animales
  criatura: { '2014': 317, '2024': 330 },
  // En 2014, las 9 razas y 4 subrazas, el acólito y Apresador; en 2024, las 9 especies, 4 trasfondos y 17 dotes
  especie: { '2014': 13, '2024': 9 },
  trasfondo: { '2014': 1, '2024': 4 },
  dote: { '2014': 1, '2024': 17 }
}

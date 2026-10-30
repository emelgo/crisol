/** «A lo ancho»: en la vista de hoja, el bloque ocupa las dos columnas. En la sencilla no cambia nada */

/** Lo que se lee de un elemento (sin depender de los tipos del DOM, que este paquete no carga) */
type Element = { hasAttribute(name: string): boolean }

export const wideAttribute = {
  wide: {
    default: false,
    parseHTML: (element: Element) => element.hasAttribute('data-wide'),
    renderHTML: (attributes: Record<string, unknown>) => (attributes.wide ? { 'data-wide': '' } : {})
  }
}

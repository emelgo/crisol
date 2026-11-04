/** Lo que tiene el propio objeto, no lo que hereda (constructor, toString…): un nombre que se escribe no llega ahí */
export const own = <T>(record: Readonly<Record<string, T>>, key: string): T | undefined =>
  Object.hasOwn(record, key) ? record[key] : undefined

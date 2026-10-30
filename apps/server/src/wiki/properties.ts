import { pageProperty } from '@crisol/contracts'

/** Las propiedades guardadas, tal como las da la API (lo que no encaje en el contrato no sale) */
export function propertiesOf(stored: unknown[]) {
  return stored.flatMap((item) => {
    const parsed = pageProperty.safeParse(item)
    return parsed.success ? [parsed.data] : []
  })
}

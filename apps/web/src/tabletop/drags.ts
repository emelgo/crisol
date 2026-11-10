/**
 * Lo que se arrastra desde el compendio de la Mesa: una entrada (su clave, su tipo y si es una criatura). Lo recogen la
 * pestaña Personajes (una criatura pasa a la campaña), «Lo mío» de una ficha y «Del grupo» (un objeto). Al mapa va,
 * además, como lo que se pone en él (PLACING_TYPE)
 */
export const CONTENT_DRAG = 'application/x-crisol-compendio'

export interface ContentDrag {
  key: string
  type: string
  name: string
  actor: boolean
}

export function readContentDrag(data: DataTransfer): ContentDrag | null {
  try {
    const raw = data.getData(CONTENT_DRAG)
    return raw ? (JSON.parse(raw) as ContentDrag) : null
  } catch {
    return null
  }
}

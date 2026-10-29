/** Los cursores de otras cuentas en el editor: su color y cómo se pintan */

/** Colores de los cursores ajenos: con contraste sobre los dos temas, distintos también en luminosidad */
const CARET_COLORS = ['#b8282a', '#1f6e99', '#6b5494', '#2f6b3a', '#8a5a00', '#a3366f']

/**
 * El cursor de otra cuenta con su nombre, como lo pinta CollaborationCaret pero oculto a los lectores de pantalla: va
 * dentro del texto y, si no, lo leerían como parte de él
 */
export function renderCaret(user: Record<string, string>) {
  const caret = document.createElement('span')
  caret.classList.add('collaboration-carets__caret')
  caret.setAttribute('style', `border-color: ${user.color}`)
  caret.setAttribute('aria-hidden', 'true')
  const label = document.createElement('div')
  label.classList.add('collaboration-carets__label')
  label.setAttribute('style', `background-color: ${user.color}`)
  label.append(document.createTextNode(user.name ?? ''))
  caret.append(label)
  return caret
}

export function caretColor(name: string) {
  let hash = 0
  for (const char of name) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0
  return CARET_COLORS[hash % CARET_COLORS.length] ?? '#b8282a'
}

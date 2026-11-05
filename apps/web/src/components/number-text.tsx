/**
 * Campos de número que se escriben a mano (los ajustes de la campaña): lo escrito se ve tal cual mientras se escribe
 */
import { type ComponentProps, useState } from 'react'

/**
 * Un número que se escribe: lo escrito se ve tal cual (vacío o a medias, como «-») y solo pasa cuando es un número;
 * al salir, vuelve al de verdad
 */
export function NumberText({
  value,
  onValue,
  ...props
}: Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type'> & { value: number; onValue: (value: number) => void }) {
  const [text, setText] = useState(String(value))
  const [seen, setSeen] = useState(value)
  if (seen !== value) {
    setSeen(value)
    if (Number(text) !== value) setText(String(value))
  }
  return (
    <input
      {...props}
      type="number"
      value={text}
      onChange={(event) => {
        const raw = event.currentTarget.value
        setText(raw)
        const n = Number(raw)
        if (raw.trim() !== '' && Number.isFinite(n)) onValue(n)
      }}
      onBlur={() => setText(String(value))}
    />
  )
}

/** Un valor que cambia cuando deja de cambiar (lo escrito en un buscador, al dejar de escribir) */
import { useEffect, useState } from 'react'

export function useSettled<T>(value: T, delay = 250): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return settled
}

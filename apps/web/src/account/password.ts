/** Lo seguras que son las contraseñas, de 0 (muy débil) a 4 (muy buena) */
export type Strength = 0 | 1 | 2 | 3 | 4

// Las que más se prueban; con una de estas dentro, no vale aunque sea larga
const COMMON = [
  'contraseña',
  'password',
  '123456',
  'qwerty',
  'abc123',
  '111111',
  'iloveyou',
  'admin',
  'crisol',
  'dragon'
]

/**
 * Una estimación sencilla, sin enviar nada fuera: cuenta la longitud y la variedad, y baja si lleva algo que se
 * adivina (una de las comunes, el nombre o el email de la cuenta, o un carácter repetido)
 */
export function passwordStrength(password: string, personal: readonly string[] = []): Strength {
  if (password.length === 0) return 0
  const lower = password.toLocaleLowerCase('es')
  const guessable =
    COMMON.some((word) => lower.includes(word)) ||
    personal.some((part) => part.length >= 3 && lower.includes(part.toLocaleLowerCase('es'))) ||
    /^(.)\1+$/.test(password)
  const kinds = [/[a-zñ]/, /[A-ZÑ]/, /\d/, /[^\p{L}\d]/u].filter((pattern) => pattern.test(password)).length
  let score = 0
  if (password.length >= 10) score++
  if (password.length >= 14) score++
  if (password.length >= 18) score++
  if (kinds >= 3) score++
  if (guessable) score = Math.min(score, 1)
  return Math.min(score, 4) as Strength
}

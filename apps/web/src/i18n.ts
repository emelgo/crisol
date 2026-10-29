import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'

// Español: idioma fuente. Textos cortos y sin sobreexplicar
export const es = {
  app: {
    name: 'Crisol',
    tagline: 'Mundos de rol y mesa virtual',
    accountNav: 'Cuenta'
  },
  account: {
    signIn: 'Entrar',
    signOut: 'Salir',
    name: 'Nombre',
    email: 'Email',
    password: 'Contraseña',
    passwordHint: 'Al menos 10 caracteres',
    hello: 'Hola, {{name}}'
  },
  bootstrap: {
    title: 'Cuenta del propietario',
    organization: 'Organización:',
    create: 'Crear la cuenta',
    invalidTitle: 'Este enlace no vale',
    invalidBody: 'Puede que ya se haya usado o que haya caducado.'
  },
  profile: {
    title: 'Perfil',
    save: 'Guardar',
    saved: 'Guardado'
  },
  errors: {
    INVALID_CREDENTIALS: 'Email o contraseña incorrectos',
    TOO_MANY_REQUESTS: 'Demasiados intentos. Espera un minuto.',
    EMAIL_TAKEN: 'Ese email ya tiene cuenta',
    INVALID_LINK: 'Este enlace no vale',
    INVALID_INPUT: 'Revisa los datos',
    UNKNOWN: 'Algo ha fallado. Vuelve a intentarlo.'
  },
  theme: {
    toDark: 'Cambiar a tema oscuro',
    toLight: 'Cambiar a tema claro'
  },
  notFound: {
    title: 'Página no encontrada',
    back: 'Volver al inicio'
  }
}

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: { translation: typeof es }
  }
}

await i18next.use(initReactI18next).init({
  lng: 'es',
  resources: { es: { translation: es } },
  interpolation: { escapeValue: false }
})

export { i18next }

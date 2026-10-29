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
  worlds: {
    title: 'Mis mundos',
    empty: 'Aún no tienes mundos',
    listLabel: 'Mundos',
    newTitle: 'Nuevo mundo',
    name: 'Nombre del mundo',
    create: 'Crear el mundo'
  },
  world: {
    notFound: 'Este mundo no existe'
  },
  campaigns: {
    title: 'Campañas',
    empty: 'Aún no hay campañas',
    listLabel: 'Campañas',
    newTitle: 'Nueva campaña',
    name: 'Nombre de la campaña',
    create: 'Crear la campaña'
  },
  campaign: {
    notFound: 'Esta campaña no existe'
  },
  join: {
    title: 'Te invitan a {{campaign}}',
    byMaster: '{{world}} · máster: {{master}}',
    confirm: 'Entrar en {{campaign}} como jugador',
    isMaster: 'Ya eres el máster de esta campaña.',
    signUpTitle: 'Crea tu cuenta',
    signUp: 'Crear la cuenta y entrar',
    hasAccount: 'Ya tengo cuenta',
    signInTitle: 'Entra con tu cuenta',
    invalidTitle: 'Este enlace no vale',
    invalidBody: 'Puede que lo hayan cambiado o que las invitaciones estén cerradas. Pide otro al máster.',
    errors: {
      EMAIL_TAKEN: 'Ese email ya tiene cuenta: entra con ella más abajo',
      INVALID_LINK: 'Este enlace ya no vale. Pide otro al máster.'
    }
  },
  invitation: {
    title: 'Invitación',
    link: 'Enlace de invitación',
    copy: 'Copiar',
    copied: 'Copiado',
    issued: 'Enlace del {{date}}.',
    joins_one: 'Ha entrado {{count}} con este enlace',
    joins_other: 'Han entrado {{count}} con este enlace',
    none: 'Aún no hay enlace.',
    create: 'Generar enlace',
    regenerate: 'Nuevo enlace',
    warning: 'Quien aún no haya entrado necesitará el nuevo.',
    confirm: 'Generar el nuevo',
    open: 'Invitaciones abiertas',
    closed: 'Ahora nadie puede entrar con el enlace.'
  },
  list: {
    rename: 'Renombrar',
    renameButton: 'Renombrar {{name}}',
    renameLabel: 'Nuevo nombre de {{name}}',
    save: 'Guardar',
    cancel: 'Cancelar'
  },
  consent: {
    title: 'Conectar {{client}}',
    body: '{{client}} quiere usar tu cuenta de Crisol: ver y cambiar tus mundos en tu nombre.',
    history: 'Lo que haga quedará en el historial y podrás deshacerlo.',
    ownerOnly: 'De momento solo el propietario puede conectar Claude.',
    allow: 'Permitir',
    deny: 'No permitir',
    expiredTitle: 'Tu sesión ha caducado',
    expiredBody: 'Vuelve a conectar desde la aplicación que lo pedía.'
  },
  roles: {
    master: 'Máster',
    player: 'Jugador',
    owner: 'Propietario',
    member: 'Miembro'
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
    FORBIDDEN: 'No tienes permiso',
    NOT_FOUND: 'Ya no existe',
    ORGANIZATION_REQUIRED: 'Necesitas ser propietario de una organización',
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

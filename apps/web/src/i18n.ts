import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'

// Español: idioma fuente. Textos cortos y sin sobreexplicar
export const es = {
  app: {
    name: 'Crisol',
    tagline: 'Mundos de rol y mesa virtual',
    accountNav: 'Cuenta',
    sectionsNav: 'Secciones',
    skipToContent: 'Saltar al contenido',
    pageTitle: '{{page}} · Crisol'
  },
  account: {
    signIn: 'Entrar',
    signOut: 'Cerrar sesión',
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
    notFound: 'Este mundo no existe',
    asMaster: 'Eres su máster.',
    asPlayer: 'Juegas en una de sus campañas.'
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
    notFound: 'Esta campaña no existe',
    asMaster: 'Campaña de {{world}}. Eres su máster.',
    asPlayer: 'Campaña de {{world}}. Juegas en ella.',
    players: 'Jugadores',
    joined: 'Han entrado'
  },
  join: {
    title: 'Te invitan a {{campaign}}',
    byMaster: 'Máster: {{master}}',
    confirm: 'Entrar en {{campaign}} como jugador',
    isMaster: 'Ya eres el máster de esta campaña.',
    signedInAs: 'Entras como {{name}} ({{email}}).',
    otherAccount: 'Usar otra cuenta',
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
    copyManually: 'No se ha podido copiar: está seleccionado, cópialo a mano.',
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
  members: {
    title: 'Miembros',
    remove: 'Expulsar',
    removeButton: 'Expulsar a {{name}}',
    removeWarning: 'Con el enlace actual, {{name}} podría volver a entrar.',
    removeConfirm: 'Expulsar',
    removeAndRegenerate: 'Expulsar y cambiar el enlace',
    removed: '{{name}} ya no está en la campaña.',
    removedLinkFailed: '{{name}} ya no está en la campaña, pero el enlace no ha cambiado. Genera uno nuevo.',
    leave: 'Dejar la campaña',
    leaveWarning: 'Para volver, el máster tendrá que pasarte el enlace.',
    leaveConfirm: 'Dejarla'
  },
  wiki: {
    title: 'Wiki de {{world}}',
    link: 'Wiki de {{world}}',
    pick: 'Elige una página en el árbol o crea una nueva.',
    pages: 'Páginas',
    newPage: 'Página nueva',
    newSubpage: 'Nueva subpágina',
    closePages: 'Cerrar',
    untitled: 'Sin título',
    empty: 'Aún no hay páginas.',
    moveHint: 'Arrastra para recolocar, o usa Alt y las flechas.',
    movedInto: '«{{title}}» va ahora dentro de «{{parent}}»',
    movedToTop: '«{{title}}» va ahora en el primer nivel',
    breadcrumbs: 'Migas de pan',
    rename: 'Renombrar',
    titleLabel: 'Título de la página',
    subpages: 'Subpáginas',
    noSubpages: 'No tiene subpáginas.',
    notFound: 'Esta wiki no existe',
    pageNotFound: 'Esta página no existe',
    more: 'Más de la wiki',
    delete: 'Borrar',
    deleteWarning: '¿Borrar «{{title}}»? Irá a la papelera y se puede restaurar durante 30 días.',
    deleteWarningWithSubpages:
      '¿Borrar «{{title}}» y sus subpáginas? Irán a la papelera y se pueden restaurar durante 30 días.',
    deleted: '«{{title}}» está en la papelera'
  },
  properties: {
    title: 'Propiedades',
    add: 'Añadir propiedades',
    edit: 'Editar propiedades',
    none: 'Sin propiedades.',
    addOne: 'Añadir propiedad',
    numbered: 'propiedad {{n}}',
    name: 'Nombre de la propiedad {{n}}',
    type: 'Tipo de la propiedad {{n}}',
    value: 'Valor de la propiedad {{n}}',
    up: 'Subir',
    down: 'Bajar',
    removeShort: 'Quitar',
    moveUp: 'Subir {{name}}',
    moveDown: 'Bajar {{name}}',
    remove: 'Quitar {{name}}',
    removePage: 'Quitar {{title}}',
    listHint: 'Separa con comas',
    pagesHint: 'Escribe el título y elige la página',
    unknownPage: 'Página',
    badNumber: '«{{name}}» tiene que ser un número',
    yes: 'Sí',
    no: 'No',
    types: { text: 'Texto', number: 'Número', boolean: 'Sí o no', list: 'Lista', pages: 'Páginas' },
    reserved: { alias: 'Alias', etiquetas: 'Etiquetas', resumen: 'Resumen' }
  },
  icon: {
    add: 'Añadir icono',
    change: 'Icono {{icon}}: cambiarlo',
    common: 'Iconos',
    use: 'Usar {{icon}}',
    other: 'Otro emoji',
    useOther: 'Usar',
    remove: 'Quitar el icono'
  },
  editor: {
    body: 'Texto de la página',
    label: 'Texto de la página',
    offline: 'Sin conexión: se guardará al volver.',
    toolbar: 'Insertar en el texto',
    task: 'Por hacer: {{text}}',
    taskDone: 'Hecho: {{text}}',
    lock: 'Poner en lectura',
    unlock: 'Quitar el candado',
    locked: 'En lectura: quita el candado para editar.'
  },
  blocks: {
    menu: 'Bloques',
    groups: { text: 'Texto', boxes: 'Recuadros', master: 'Del máster' },
    paragraph: 'Texto',
    paragraphHint: 'Un párrafo',
    heading1: 'Título 1',
    heading2: 'Título 2',
    heading3: 'Título 3',
    bulletList: 'Lista con viñetas',
    orderedList: 'Lista numerada',
    taskList: 'Casillas',
    taskListHint: 'Para marcar',
    blockquote: 'Cita',
    codeBlock: 'Código',
    table: 'Tabla',
    tableHint: 'Con cabecera',
    horizontalRule: 'Separador',
    calloutNote: 'Nota',
    calloutTip: 'Consejo',
    calloutWarning: 'Aviso',
    calloutDanger: 'Peligro',
    calloutHint: 'Recuadro',
    calloutReadAloud: 'Leer en voz alta',
    calloutReadAloudHint: 'Para la mesa',
    box: 'Caja',
    boxHint: 'Con marco',
    secret: 'Secreto',
    secretHint: 'Se guarda aparte',
    note: 'Nota oculta',
    noteHint: 'Solo al editar',
    none: 'Ningún bloque se llama así.',
    help: '↑↓ para moverte · Intro para elegir · Esc para cerrar',
    inserted: 'Bloque insertado: {{block}}.'
  },
  callout: {
    note: 'Nota',
    tip: 'Consejo',
    warning: 'Aviso',
    danger: 'Peligro',
    'read-aloud': 'Leer en voz alta'
  },
  format: {
    toolbar: 'Formato',
    bold: 'Negrita',
    italic: 'Cursiva',
    underline: 'Subrayado',
    strike: 'Tachado',
    code: 'Código',
    link: 'Enlace',
    linkUrl: 'Dirección',
    linkApply: 'Enlazar',
    linkRemove: 'Quitar el enlace',
    linkInvalid: 'Solo direcciones que empiecen por http, https o mailto.'
  },
  table: {
    toolbar: 'Tabla',
    addRow: 'Fila debajo',
    addColumn: 'Columna a la derecha',
    deleteRow: 'Quitar la fila',
    deleteColumn: 'Quitar la columna',
    headerRow: 'Fila de cabecera',
    delete: 'Quitar la tabla'
  },
  blockMenu: {
    open: 'Mover o cambiar el bloque',
    button: 'Bloque',
    title: 'Bloque',
    convert: 'Convertir en',
    actions: 'Acciones',
    duplicate: 'Duplicar',
    up: 'Subir',
    down: 'Bajar',
    delete: 'Borrar',
    converted: 'Bloque convertido en {{block}}.',
    duplicated: 'Bloque duplicado.',
    moved: 'Bloque movido.',
    deleted: 'Bloque borrado.'
  },
  separate: {
    secret: 'Secreto',
    note: 'Nota oculta',
    secretHint: 'Secreto · solo lo ves tú',
    noteHint: 'Nota oculta · para ti',
    secretText: 'Texto del secreto',
    noteText: 'Texto de la nota oculta',
    unwrap: 'Convertir en texto normal',
    copying: 'Copiando…',
    makeSecret: 'Secreto',
    makeNote: 'Nota oculta'
  },
  tabs: {
    title: 'Páginas abiertas',
    recent: 'Abiertas',
    pin: 'Fijar {{title}}',
    close: 'Cerrar {{title}}'
  },
  bookmarks: {
    title: 'Marcadores',
    defaultGroup: 'Marcadores',
    add: 'Marcar',
    remove: 'Quitar el marcador',
    chooseGroup: 'En qué grupo',
    newGroup: 'O en un grupo nuevo',
    save: 'Marcar',
    added: '«{{title}}» está en {{group}}',
    removed: '«{{title}}» ya no está en los marcadores'
  },
  siblings: {
    title: 'Páginas hermanas',
    previous: 'Anterior',
    next: 'Siguiente'
  },
  tags: {
    title: 'Etiquetas',
    worldTitle: 'Etiquetas de {{world}}',
    empty: 'Aún no hay etiquetas: se ponen en las propiedades de cada página.',
    count_one: '{{count}} página',
    count_other: '{{count}} páginas'
  },
  history: {
    title: 'Historial',
    worldTitle: 'Historial de {{world}}',
    listLabel: 'Operaciones',
    empty: 'Aún no hay nada en el historial',
    more: 'Ver más',
    undo: 'Deshacer',
    undoButton: 'Deshacer: {{what}}',
    redo: 'Rehacer',
    redoButton: 'Rehacer: {{what}}',
    undone: 'deshecho',
    conflict: 'No se puede deshacer: después, {{actor}} {{what}}. Deshaz eso antes.',
    conflictUnknown: 'No se puede deshacer: algo de lo que cambió se ha cambiado después.',
    redoConflict: 'No se puede rehacer: después, {{actor}} {{what}}. Deshaz eso antes.',
    redoConflictUnknown: 'No se puede rehacer: algo de lo que cambió se ha cambiado después.',
    system: 'Crisol',
    deletedAccount: 'Una cuenta borrada',
    via: { ui: 'web', ai: 'Claude', aiTool: 'Claude ({{tool}})', system: 'Crisol' },
    actions: {
      createOrganization: 'creó la organización «{{name}}»',
      bootstrapOwner: 'entró como propietario',
      createWorld: 'creó el mundo «{{name}}»',
      renameWorld: 'renombró el mundo «{{from}}» a «{{to}}»',
      createCampaign: 'creó la campaña «{{name}}» en {{world}}',
      renameCampaign: 'renombró la campaña «{{from}}» a «{{to}}»',
      regenerateInvitation: 'generó un enlace nuevo para {{campaign}}',
      openInvitations: 'abrió las invitaciones de {{campaign}}',
      closeInvitations: 'cerró las invitaciones de {{campaign}}',
      joinCampaign: 'entró en {{campaign}}',
      removeMember: 'expulsó a {{member}} de {{campaign}}',
      leaveCampaign: 'dejó {{campaign}}',
      undoOperation: 'deshizo: {{what}}',
      redoOperation: 'rehízo: {{what}}',
      deleteWorld: 'borró el mundo «{{name}}»',
      deleteCampaign: 'borró la campaña «{{name}}» de {{world}}',
      restoreWorld: 'restauró el mundo «{{name}}»',
      restoreCampaign: 'restauró la campaña «{{name}}» de {{world}}',
      createPage: 'creó la página «{{title}}»',
      createSubpage: 'creó la página «{{title}}» dentro de «{{parent}}»',
      updatePage: 'renombró la página «{{from}}» a «{{to}}»',
      movePage: 'movió «{{title}}» dentro de «{{parent}}»',
      movePageToTop: 'movió «{{title}}» al primer nivel',
      setPageIcon: 'cambió el icono de «{{title}}»',
      removePageIcon: 'quitó el icono de «{{title}}»',
      lockPage: 'puso «{{title}}» en lectura',
      unlockPage: 'quitó el candado de «{{title}}»',
      setPageProperties: 'cambió las propiedades de «{{title}}»',
      deletePage: 'borró la página «{{title}}»',
      restorePage: 'restauró la página «{{title}}»',
      unknown: 'hizo un cambio ({{action}})'
    }
  },
  approvals: {
    title: 'Claude espera tu aprobación',
    listLabel: 'Peticiones de Claude',
    request: 'Claude quiere {{what}}',
    detail: 'Detalle',
    tool: 'Herramienta: {{tool}}',
    requestedAt: 'Lo pidió el {{date}}. Caduca el {{expires}}.',
    approve: 'Aprobar',
    approveButton: 'Aprobar: {{what}}',
    reject: 'Rechazar',
    rejectButton: 'Rechazar: {{what}}',
    done: 'Hecho: {{what}}',
    rejected: 'Rechazado: {{what}}',
    failed: 'No se pudo {{what}}: {{error}}',
    status: {
      pending: 'esperando',
      approved: 'aprobado',
      done: 'hecho',
      failed: 'no se pudo',
      rejected: 'rechazado',
      expired: 'caducado'
    },
    // Lo mismo que history.actions, por hacer
    actions: {
      createOrganization: 'crear la organización «{{name}}»',
      bootstrapOwner: 'entrar como propietario',
      createWorld: 'crear el mundo «{{name}}»',
      renameWorld: 'renombrar el mundo «{{from}}» a «{{to}}»',
      createCampaign: 'crear la campaña «{{name}}» en {{world}}',
      renameCampaign: 'renombrar la campaña «{{from}}» a «{{to}}»',
      regenerateInvitation: 'generar un enlace nuevo para {{campaign}}',
      openInvitations: 'abrir las invitaciones de {{campaign}}',
      closeInvitations: 'cerrar las invitaciones de {{campaign}}',
      joinCampaign: 'entrar en {{campaign}}',
      removeMember: 'expulsar a {{member}} de {{campaign}}',
      leaveCampaign: 'dejar {{campaign}}',
      undoOperation: 'deshacer: {{what}}',
      redoOperation: 'rehacer: {{what}}',
      deleteWorld: 'borrar el mundo «{{name}}»',
      deleteCampaign: 'borrar la campaña «{{name}}» de {{world}}',
      restoreWorld: 'restaurar el mundo «{{name}}»',
      restoreCampaign: 'restaurar la campaña «{{name}}» de {{world}}',
      createPage: 'crear la página «{{title}}»',
      createSubpage: 'crear la página «{{title}}» dentro de «{{parent}}»',
      updatePage: 'renombrar la página «{{from}}» a «{{to}}»',
      movePage: 'mover «{{title}}» dentro de «{{parent}}»',
      movePageToTop: 'mover «{{title}}» al primer nivel',
      setPageIcon: 'cambiar el icono de «{{title}}»',
      removePageIcon: 'quitar el icono de «{{title}}»',
      lockPage: 'poner «{{title}}» en lectura',
      unlockPage: 'quitar el candado de «{{title}}»',
      setPageProperties: 'cambiar las propiedades de «{{title}}»',
      deletePage: 'borrar la página «{{title}}»',
      restorePage: 'restaurar la página «{{title}}»',
      unknown: 'hacer un cambio ({{action}})'
    }
  },
  ai: {
    link: 'IA',
    title: 'Ajustes de IA',
    connectorTitle: 'Conectar Claude',
    connector: 'Dirección del conector',
    connectorHint: 'En claude.ai, añade un conector con esta dirección.',
    modeTitle: 'Modo',
    modes: {
      readOnly: 'Solo lectura',
      assistant: 'Asistente',
      copilot: 'Copiloto'
    },
    modeHints: {
      readOnly: 'Consulta, pero no cambia nada.',
      assistant: 'Consulta; lo demás espera tu aprobación.',
      copilot: 'Hace cambios; borrar y lo que afecta a los jugadores espera tu aprobación.'
    },
    saved: 'Guardado',
    recentTitle: 'Últimas peticiones',
    recentEmpty: 'Aún no ha pedido nada que esperase tu aprobación.'
  },
  notices: {
    title: 'Avisos',
    joined: '{{member}} ha entrado en {{campaign}}.',
    dismissShort: 'Cerrar',
    dismiss: 'Cerrar el aviso de {{member}}',
    newVersion: 'Hay una versión nueva de Crisol.',
    reload: 'Recargar'
  },
  list: {
    rename: 'Renombrar',
    renameButton: 'Renombrar {{name}}',
    renameLabel: 'Nuevo nombre de {{name}}',
    save: 'Guardar',
    cancel: 'Cancelar',
    delete: 'Borrar',
    deleteButton: 'Borrar {{name}}',
    deleteWarning: '¿Borrar {{name}}? Irá a la papelera: se puede restaurar durante 30 días.'
  },
  trash: {
    title: 'Papelera',
    worldTitle: 'Papelera de {{world}}',
    listLabel: 'En la papelera',
    empty: 'La papelera está vacía',
    world: 'Mundo',
    campaignOf: 'Campaña de {{world}}',
    pageOf_zero: 'Página de {{world}}',
    pageOf_one: 'Página de {{world}}, con {{count}} subpágina',
    pageOf_other: 'Página de {{world}}, con {{count}} subpáginas',
    purgeAt: 'Se borra del todo el {{date}}',
    restore: 'Restaurar',
    restoreButton: 'Restaurar {{name}}'
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
    CYCLE: 'Una página no puede ir dentro de sí misma ni de sus subpáginas',
    TOO_DEEP: 'No caben más niveles de subpáginas',
    BAD_PLACEMENT: 'Ahí no se puede poner',
    DUPLICATE_PROPERTY: 'Hay dos propiedades con el mismo nombre',
    RESERVED_PROPERTY_TYPE: 'Alias y etiquetas son listas, y resumen es texto',
    BAD_TAG: 'Una etiqueta no lleva espacios; para la jerarquía, «/»',
    BAD_PROPERTY: 'Alguna página de las propiedades ya no está en la wiki',
    PARENT_IN_TRASH: 'Su página madre también está en la papelera: restáurala antes',
    INVALID_CREDENTIALS: 'Email o contraseña incorrectos',
    TOO_MANY_REQUESTS: 'Demasiados intentos. Espera un minuto.',
    EMAIL_TAKEN: 'Ese email ya tiene cuenta',
    INVALID_LINK: 'Este enlace no vale',
    INVALID_INPUT: 'Revisa los datos',
    FORBIDDEN: 'No tienes permiso',
    NOT_FOUND: 'Ya no existe',
    ORGANIZATION_REQUIRED: 'Necesitas ser propietario de una organización',
    ALREADY_UNDONE: 'Ya está deshecho',
    NOT_UNDOABLE: 'Esto no se puede deshacer',
    WORLD_IN_TRASH: 'Restaura antes su mundo',
    MASTER_NOT_REMOVABLE: 'Al máster no se le puede expulsar',
    APPROVAL_EXPIRED: 'Ya ha caducado',
    ALREADY_DECIDED: 'Ya está decidido',
    INTERRUPTED: 'Se cortó mientras se hacía: vuelve a pedirlo',
    TOO_MANY_PENDING: 'Hay demasiadas peticiones esperando',
    UNAUTHENTICATED: 'Tu sesión ha acabado. Vuelve a entrar.',
    UNKNOWN: 'Algo ha fallado. Vuelve a intentarlo.'
  },
  load: {
    title: 'No se ha podido cargar',
    retry: 'Reintentar'
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

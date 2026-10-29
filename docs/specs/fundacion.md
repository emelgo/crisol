# Spec: Módulo 0 — Fundación

Estado: aprobada por Enrique · Fecha: 2026-10-29 · Decisiones de partida: `docs/modulos.md` § «0.
Fundación» · Arquitectura: `docs/adr/0001-arquitectura.md` · REA: `research/foundry/usuarios-y-permisos.md`,
`research/foundry/sincronizacion-e-historial.md`, `research/dndbeyond/campanas-e-invitaciones.md`

## Objetivo

Dejar en marcha la base del Crisol en la nube para que Enrique pueda **crear su mundo y sus campañas, meter a sus
jugadores con un enlace y gestionarlo también desde Claude**, con todo cambio apuntado y deshacible. Sobre esto se
construye la wiki con el importador de Eana (módulo 1).

Usuarios del módulo: Enrique (único máster y propietario) y sus jugadores de Fateforge. Nadie más hasta los pagos
(módulo 11).

### Historias

1. Como máster, entro con mi cuenta, creo el mundo «Eana» y dentro las campañas que quiera.
2. Como máster, copio el enlace de invitación de una campaña, lo mando por WhatsApp o Discord, y puedo anularlo y
   generar otro cuando quiera.
3. Como jugador, abro el enlace, entro con Google, Discord o email y contraseña, y quedo dentro de esa campaña (y solo
   de esa).
4. Como máster, veo quién está en cada campaña y puedo expulsar a alguien; como jugador, puedo salir de una campaña.
5. Como máster, conecto Claude a mi cuenta desde claude.ai y le pido ver, crear o invitar; según el modo de IA, lo
   delicado espera a que yo lo apruebe en Crisol.
6. Como máster, veo el historial de lo que ha cambiado (quién, cuándo, desde dónde) y deshago una operación entera;
   lo borrado pasa por la papelera y lo puedo recuperar.

## Mapa de capacidades

El módulo agrupa cinco capacidades que se prueban por separado. Cada una lleva su API, su interfaz y (si toca) sus
herramientas MCP; se construyen en este orden.

| Id | Qué hace | Depende de |
|---|---|---|
| `plataforma` | Monorepo, CI con el listón de `CONSTRAINTS.md`, Docker Compose, despliegue en staging | — |
| `cuentas` | Identidad: email + contraseña, Google, Discord, sesiones; alta solo por invitación; arranque del propietario | `plataforma` |
| `inquilinos` | Organizaciones, mundos, campañas, pertenencias con rol, enlaces de invitación, capa de políticas | `cuentas` |
| `historial` | Operaciones y cambios, deshacer, papelera, retención | `inquilinos` |
| `ia` | MCP en `/mcp` con OAuth, herramientas del módulo, modos de IA, cola de aprobación | `inquilinos`, `historial` |

Orden: `plataforma` → `cuentas` → `inquilinos` → `historial` → `ia`.

## Requisitos

### `plataforma`

- Monorepo pnpm + Turborepo con la pila del ADR-0001. Biome, `tsc`, Vitest y Playwright desde el primer commit.
- CI en GitHub Actions con **todas** las comprobaciones de `CONSTRAINTS.md` (las que bloquean y las que avisan hasta
  el 2026-11-12). Cada PR a `main` la pasa antes del merge.
- Docker Compose: Postgres 17, Valkey y Mailpit para desarrollo; la app (servidor que sirve también la web) en
  producción. Todo escucha solo en loopback.
- Staging en `neo.crisol.144-91-122-245.sslip.io` detrás de Caddy (**requiere permiso de Enrique**), desplegado con
  un script que construye, migra la base de datos y reinicia.
- `.env.example` documenta todas las variables; los secretos solo en `.env`.

### `cuentas`

- Better Auth con email + contraseña, Google y Discord. Cada proveedor social se activa solo si sus credenciales están
  en `.env`.
- **No hay registro abierto.** Solo se crea cuenta desde un enlace de invitación válido (o con el arranque del
  propietario). Quien ya tiene cuenta entra siempre.
- **Arranque**: un comando en el servidor crea la organización y un enlace de un solo uso para que Enrique cree su
  cuenta de propietario. Sin comando, nadie puede crear la primera cuenta.
- Sesión por cookie (`HttpOnly`, `Secure`, `SameSite=Lax`) de 30 días que se renueva con el uso; cerrar sesión.
  Límite de intentos de entrada.
- Recuperar contraseña por email (SMTP; Mailpit en desarrollo). Ver «Preguntas abiertas».
- Perfil mínimo: nombre visible editable.

### `inquilinos`

Modelo:

| Entidad | Lo esencial |
|---|---|
| Organización | Nombre. Dueña de los mundos. |
| Miembro de organización | Usuario + rol: `propietario` o `miembro` (los jugadores son `miembro`). |
| Mundo | Nombre; pertenece a una organización. |
| Miembro de mundo | Usuario + rol: `master` (en el módulo 0, quien lo crea). Reservado: `comaster`. |
| Campaña | Nombre; pertenece a un mundo. |
| Miembro de campaña | Usuario + rol: `master` o `jugador`. Reservado: `espectador`. |
| Enlace de invitación | Campaña, rol que da (`jugador`), quién lo creó, cuándo, anulado o no. El secreto solo se guarda como hash. |

- Toda fila de datos de un mundo lleva su `world_id` (y su `organization_id`), según el ADR-0001.
- **Capa de políticas única**: toda acción (API, MCP, trabajos internos) pasa por una función que decide si el usuario
  puede hacerla sobre ese recurso. Nada se comprueba fuera de ella. Las reglas del módulo 0:
  - El propietario de la organización crea mundos y es su `master`.
  - El `master` de un mundo crea, renombra y borra el mundo y sus campañas, ve sus miembros, gestiona los enlaces y
    expulsa.
  - El `jugador` ve el mundo (solo su nombre en este módulo) y las campañas en las que está, con la lista de
    compañeros. No ve campañas ajenas, ni enlaces, ni historial.
  - Nadie ve nada de otra organización.
- **Proyección por usuario en el servidor**: las respuestas, los eventos en tiempo real y las herramientas MCP solo
  llevan lo que ese usuario puede ver. El cliente no recibe datos para ocultarlos después: Foundry manda el mundo
  entero a cada jugador y oculta en la interfaz (`research/foundry/sincronizacion-e-historial.md`), y eso es justo lo
  que evitamos.
- **Ningún canal lateral**: API, WebSocket y MCP pasan por la misma capa de políticas, y la identidad sale siempre de
  la sesión, nunca del mensaje.
- **Revocar es inmediato**: cada petición vuelve a evaluar la pertenencia. Al expulsar, al salir o al cambiar un rol,
  se cierran las suscripciones en tiempo real de esa cuenta en ese ámbito.
- **Autoría la pone el servidor**: cada recurso lleva quién lo creó, quién lo cambió por última vez y cuándo, tomado
  de la sesión, nunca del cliente.
- **Enlace de invitación** (lo aprendido de los fallos de D&D Beyond, en `research/dndbeyond/`):
  - **Forma**:
    - `/unirse/<secreto>`: distinta de la URL de la campaña, para que no se confundan.
    - Secreto aleatorio de 256 bits sin relación con la campaña; en la base de datos solo se guarda su hash.
    - Uno activo por campaña.
    - Sin caducidad ni límite de usos en el módulo 0: si se filtra, se regenera o se cierra.
  - **Gestión**:
    - El máster ve la fecha del enlace y cuántos han entrado con él.
    - **«Nuevo enlace»** anula el anterior al momento y avisa de que quien aún no haya entrado necesitará el nuevo.
    - **«Invitaciones cerradas»** deja de admitir gente sin cambiar el enlace.
  - **Abrirlo nunca une a nadie**:
    - Los bots de vista previa de WhatsApp y Discord abren los enlaces. Unirse es una confirmación aparte, con un clic
      («Entrar en <campaña> como jugador»).
    - La vista previa del enlace es genérica («Invitación a una campaña de Crisol») y la página lleva `noindex`.
  - **Sin sesión**:
    - Se ven el nombre de la campaña, el del mundo y el del máster, y los botones de Google, Discord y email.
    - Tras crear la cuenta o entrar (también por Google o Discord), se vuelve solo a la confirmación, sin reabrir el
      enlace.
    - Si se abre en el navegador integrado de una app (Discord, WhatsApp…), donde Google no deja entrar, se avisa con
      «Abrir en el navegador» y un botón de copiar; el email sigue funcionando ahí.
  - **Resultado**:
    - Quien se une queda como `jugador` de la campaña y `miembro` de la organización.
    - Si ya era miembro, se le lleva a la campaña. Si es el máster, se le avisa en vez de unirlo.
    - El máster ve la entrada en el historial y como aviso en la interfaz, con «Expulsar» a mano.
  - **Errores**:
    - Enlace desconocido, anulado o cerrado: el mismo mensaje claro, que no confirma si la campaña existe.
    - Límite de intentos por IP y por cuenta.
  - El enlace guarda el rol que da (siempre `jugador`), para que más adelante haya enlaces de espectador. Nunca habrá
    uno de máster.
- **Cuentas duplicadas**: entrar con Google, Discord o email con el mismo email verificado lleva a la misma cuenta.
- Expulsar y salir quitan la pertenencia a la campaña. Si a alguien ya no le queda ninguna campaña en la organización,
  deja de ser miembro de ella.
- Borrar un mundo o una campaña lo manda a la papelera (ver `historial`).

### `historial`

- Toda escritura de datos de dominio queda en una **operación**: quién la pidió (usuario), por dónde (interfaz o IA,
  con la herramienta), cuándo, un resumen en una frase y sus **cambios** (entidad, id, antes y después).
  - Los cambios de una misma petición forman una sola operación, aunque toquen varias filas, y la operación es una
    sola transacción de Postgres: o se aplica entera o no se aplica.
  - No entran las sesiones, las entradas a la cuenta ni las contraseñas.
- **Deshacer una operación** aplica los cambios inversos como una operación nueva, que a su vez se puede deshacer.
  - Si alguna entidad se cambió después, no deshace nada y dice qué operación posterior la tocó. Nunca pisa trabajo
    ajeno.
- **Papelera**: borrar marca la entidad como borrada, que desaparece de las vistas. Desde la papelera se restaura
  durante 30 días; luego se purga. Deshacer un borrado es restaurar la misma fila, con el mismo id.
- **Retención**: las operaciones de más de 90 días se purgan con un trabajo diario. Purgar no se puede deshacer.
- Quién lo ve: el `master` ve el historial y la papelera de sus mundos, y el propietario los de toda la organización.

### `ia`

- **Servidor MCP** dentro del servidor, en `/mcp` (Streamable HTTP). Las herramientas llaman a la misma capa de
  servicios y políticas que la API.
- **OAuth** con Better Auth como servidor de autorización. Los clientes se registran con CIMD, que es lo que prefiere
  claude.ai, y DCR solo si hiciera falta. Claude actúa con los permisos del usuario que lo autorizó. En el módulo 0
  solo puede autorizarlo el propietario de la organización.
- **Herramientas** (nombres en español, como en el Crisol actual):

  | Herramienta | Tipo | Qué hace |
  |---|---|---|
  | `listar_mundos` | leer | Mundos y campañas del usuario |
  | `ver_campana` | leer | Campaña con sus miembros y su rol |
  | `crear_mundo` | escribir | Crea un mundo |
  | `crear_campana` | escribir | Crea una campaña en un mundo |
  | `enlace_invitacion` | leer / jugadores | Devuelve el enlace activo (leer); regenerarlo o abrir y cerrar las invitaciones es `jugadores` |
  | `ver_historial` | leer | Últimas operaciones de un mundo o de la organización |
  | `deshacer` | borrar | Deshace una operación |
  | `pendientes` | leer | Acciones esperando aprobación y cómo acabaron las últimas |

- **Modos**, por usuario; por defecto, copiloto, como hoy:
  - **Solo lectura**: solo consulta.
  - **Asistente**: consulta libre; el resto espera aprobación.
  - **Copiloto**: escribe libre; `borrar` y `jugadores` esperan aprobación.
- **Cola de aprobación**:
  - La acción que requiere aprobación espera hasta 15 s. Si nadie la aprueba, la herramienta contesta «esperando la
    aprobación» y la acción sigue en la cola. Caduca a las 24 h.
  - En la interfaz aparece sin recargar (en menos de 2 s), con el resumen y el detalle, para aprobarla o rechazarla.
  - Lo aprobado se ejecuta y queda en el historial como hecho por la IA.
- Lo que hace la IA queda en el historial igual que lo de una persona, con la herramienta usada.

### Interfaz

- SPA en español (i18n desde el primer texto), tema claro y oscuro, usable en móvil. WCAG 2.1 AA.
- Un canal WebSocket por sesión avisa de lo que cambia (aprobaciones, entradas a campañas, expulsiones), ya proyectado
  para ese usuario. Es la base del tiempo real de los módulos siguientes.
- Pantallas:
  - Entrar.
  - Invitación.
  - Mis mundos y campañas.
  - Mundo: campañas y papelera.
  - Campaña: miembros, enlace y expulsar.
  - Historial.
  - Ajustes de IA: modo y dirección del conector.
  - Cola de aprobación, siempre a mano cuando hay algo pendiente.
- El jugador ve sus campañas. Dentro, de momento, solo los compañeros: el contenido llega con la wiki.

## Pila

La del ADR-0001. Del módulo 0: Node 24, pnpm 12, Turborepo, TypeScript, Fastify + zod, Drizzle + Postgres 17, Valkey
+ BullMQ (trabajos de purga), Better Auth 1.7 (con `@better-auth/oauth-provider`/MCP y `@better-auth/cimd`, MIT),
`@modelcontextprotocol/sdk`, React 19 + Vite, TanStack Router/Query, i18next, Biome, Vitest, Playwright. Antes de
añadir cada dependencia se comprueba su licencia.

**Decisión (ADR-0002):** Better Auth se usa para la **identidad** (cuentas, sesiones, proveedores,
OAuth/MCP), pero **no** su plugin de organizaciones. Sus invitaciones van atadas a un email y sus roles son de
organización, y nosotros queremos enlaces por campaña y una sola capa de políticas. Organizaciones, mundos, campañas,
pertenencias e invitaciones van en tablas propias.

## Comandos

```
pnpm install                      # dependencias
pnpm dev                          # Compose (Postgres, Valkey, Mailpit) + servidor y web en modo desarrollo
pnpm db:migrate                   # aplica las migraciones de Drizzle
pnpm lint                         # biome check
pnpm typecheck                    # tsc --noEmit en cada paquete (Turborepo)
pnpm test                         # vitest run en cada paquete
pnpm test:coverage                # vitest run --coverage
pnpm e2e                          # Playwright (con axe) contra el Compose
pnpm build                        # compila todo
pnpm crisol arranque --org "…"    # crea la organización y el enlace del propietario (una vez)
./scripts/desplegar-staging.sh    # construye, migra y reinicia staging
```

## Estructura

```
apps/server         Fastify: API, Better Auth, MCP (/mcp), WebSocket de eventos, trabajos; sirve la web
apps/web            React + Vite (SPA/PWA)
packages/contracts  Esquemas zod de cada acción: de ellos salen la API, el cliente y las herramientas MCP
packages/domain     Reglas puras: políticas, historial y deshacer, modos de IA (sin Fastify ni React)
packages/db         Esquema Drizzle, migraciones y repositorios
e2e/                Pruebas Playwright
scripts/            Despliegue y utilidades
docs/  research/    Como hasta ahora (nada de apps/ ni packages/ importa research/)
```

## Estilo

Biome aplica el estilo: sin punto y coma, comillas simples y líneas largas. Identificadores en inglés y comentarios
breves en español. Cada acción se declara una vez en `contracts` y se implementa como servicio que pasa por la
política y el historial:

```ts
// Una acción: el contrato sirve a la API, al cliente y al MCP
export const createCampaign = defineAction({
  name: 'createCampaign',
  kind: 'escribir',
  input: z.object({ worldId: z.uuid(), name: z.string().trim().min(1).max(120) }),
  output: campaignSchema
})

export const createCampaignService: Service<typeof createCampaign> = async (ctx, input) => {
  await ctx.policy.require('campaign.create', { worldId: input.worldId })
  return ctx.history.operation('Crear la campaña', (tx) => tx.campaigns.insert(input))
}
```

## Pruebas

- **Dominio** (Vitest, sin base de datos): la matriz de políticas completa (rol × acción × recurso propio o ajeno), el
  deshacer (conflictos incluidos) y la decisión de los modos de IA. Es lo más crítico y se prueba de forma exhaustiva.
- **Integración** (Vitest contra Postgres real del Compose): servicios, migraciones, aislamiento entre organizaciones
  (un usuario de la organización A nunca lee ni escribe nada de la B, para cada ruta y herramienta), purgas.
- **MCP**: cliente del SDK contra el servidor en proceso: OAuth, cada herramienta, cada modo, aprobación y caducidad.
- **Fugas**: un jugador conectado captura todo lo que le llega (API, WebSocket, MCP) mientras el máster crea campañas,
  regenera enlaces y deshace. No debe aparecer nada de campañas ajenas, ni secretos de enlace, ni el historial.
- **Revocación**: un jugador expulsado con el WebSocket abierto deja de recibir y de poder escribir al momento.
- **E2E** (Playwright + axe): arranque del propietario, crear mundo y campañas, entrar con enlace, expulsar, deshacer
  y papelera, aprobar desde la cola.
- Cobertura ≥ 80 % de las líneas nuevas o cambiadas. TDD en cada porción.

## Límites

- **Siempre**: pasar por la capa de políticas y el historial; validar en el borde con zod; textos por i18n; pruebas
  antes de cada commit; CI verde antes del merge.
- **Preguntar antes**: el sitio de Caddy y cualquier puerto o servicio del sistema; añadir dependencias que no estén
  en el ADR; cambiar `CONSTRAINTS.md`; automatizar el despliegue desde GitHub (necesita una clave de acceso al VPS).
- **Nunca**: registro abierto; consultas a la base de datos que se salten la política; secretos en el repo; nada de
  `research/` en el código; copiar nada de Foundry ni de D&D Beyond; tocar el Crisol actual.

## Criterios de éxito

1. En staging, Enrique arranca el propietario, crea «Eana» y dos campañas.
2. Un jugador abre el enlace de la campaña A, crea su cuenta y ve la campaña A, pero no la B. Lo comprueban la e2e y
   la prueba de aislamiento.
3. Tras regenerar el enlace, el anterior deja de funcionar al momento; con las invitaciones cerradas nadie entra.
   Abrir el enlace sin confirmar (como hace un bot de vista previa) no une a nadie. Un jugador sin cuenta que entra
   con Discord vuelve sola a la confirmación.
4. Desde claude.ai, con el conector y en modo copiloto, Claude crea una campaña sin preguntar, y la petición de
   regenerar el enlace aparece en la cola en menos de 2 s; al aprobarla se hace.
5. Enrique deshace la creación de esa campaña desde el historial. Si alguien la cambió después, el deshacer se niega
   y explica por qué.
6. Una campaña borrada se restaura desde la papelera. La purga de los 30 y 90 días está probada con el reloj simulado.
7. La CI está en verde con todas las comprobaciones de `CONSTRAINTS.md`, sin supresiones nuevas.
8. axe no da fallos críticos ni graves en ninguna pantalla. La entrada carga en menos de 2,5 s (LCP) en staging.

## Fuera del módulo 0

- Registro abierto.
- Co-máster, espectador y acceso de invitado.
- Invitación por email.
- Varias organizaciones en la interfaz.
- Pagos y planes.
- Borrar la cuenta y exportar los datos personales (llegan antes de abrir a otros másteres, con el módulo 11).
- Versiones de página y Ctrl+Z del editor (módulo 1).
- Que los jugadores conecten su propio Claude.
- Prompts, recursos y skills del MCP.
- Visibilidad de contenido (módulo 5).

## Preguntas abiertas

1. **Correo en staging** (recuperar contraseña): ¿un SMTP de un proveedor transaccional con plan gratuito, o Gmail
   con contraseña de aplicación? Sin correo, quien use email y contraseña no puede recuperarla ni
   verificar su email, y sin email verificado no se le puede vincular con seguridad otra forma de entrar (ADR-0002).
2. **Google y Discord**: hay que crear una aplicación OAuth en cada uno con la dirección de staging. Discord acepta
   cualquier HTTPS. Google podría no aceptar un dominio `sslip.io`; si no lo acepta, Google se queda para cuando haya
   dominio propio.
3. ~~Despliegue~~: decidido, script manual en el VPS por ahora.
4. ~~Prueba de fugas en `CONSTRAINTS.md`~~: decidido, añadida como comprobación que bloquea.

Las preguntas 1 y 2 se deciden antes de la porción de despliegue con cuentas sociales; no bloquean lo anterior.

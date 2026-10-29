# ADR-0002: Identidad con Better Auth; inquilinos, invitaciones y permisos propios

Estado: aceptada · Fecha: 2026-10-29 · Spec: `docs/specs/fundacion.md`

## Contexto

El ADR-0001 eligió Better Auth para las cuentas. Al especificar el módulo 0 aparecen dos piezas suyas que podrían
cubrir más de lo que queremos que cubran:

- Su **plugin de organizaciones** trae organizaciones, miembros, equipos, roles e invitaciones. Pero sus invitaciones
  van atadas a un email (aceptarlas exige una sesión con ese mismo email) y sus roles son de organización. Nosotros
  queremos un **enlace por campaña** que se manda por WhatsApp o Discord, roles en cada pertenencia (mundo y campaña)
  y **una sola capa de políticas** por la que pasa todo, con cada escritura apuntada en el historial.
- Su **plugin MCP** lo convierte en servidor de autorización OAuth 2.1 para clientes MCP: protege el recurso y admite
  el registro de clientes por CIMD (`@better-auth/cimd`), que es lo que prefiere claude.ai. El DCR solo se activa si se
  pide. Así el conector deja de necesitar Dex y la pasarela del Crisol actual.

## Decisión

- **Better Auth (1.7, MIT) se encarga de la identidad**:
  - usuarios y sesiones en Postgres;
  - email y contraseña, Google y Discord;
  - vinculación de cuentas por email verificado;
  - límite de intentos;
  - servidor OAuth del MCP (plugins `mcp`, `jwt` y `cimd`), con el DCR apagado salvo que haga falta.
- **No se usa su plugin de organizaciones** (ni equipos ni administración). Organizaciones, mundos, campañas, sus
  pertenencias con rol y los enlaces de invitación son **tablas propias**. Toda escritura sobre ellas pasa por la capa
  de servicios: política, luego operación registrada en el historial.
- **El alta se controla en Better Auth** con un gancho previo a crear el usuario: solo pasa con un enlace de
  invitación válido o con el enlace de arranque del propietario. Vale para email y para Google o Discord.
- Las tablas de Better Auth (sesiones, cuentas vinculadas, verificaciones, claves, clientes OAuth) **no** entran en el
  historial de deshacer: no son datos del mundo.

## Alternativas descartadas

- **Plugin de organizaciones de Better Auth**: invitaciones por email, roles solo de organización y un segundo sitio
  donde se decide quién puede qué. Lo que nos ahorraría (unas pocas tablas y rutas) no compensa partir los permisos en
  dos.
- **Dex y una pasarela OAuth como en el Crisol actual**: más piezas que desplegar, y la identidad del conector quedaría
  separada de las cuentas de Crisol.

## Consecuencias

- Invitaciones, pertenencias y expulsiones las escribimos nosotros, con las pruebas de la capa de políticas.
- El cierre del registro depende de un gancho de Better Auth. Lo cubre una prueba por cada vía de alta (email, Google,
  Discord, OAuth del MCP).
- La versión de Better Auth y de sus plugins va fijada. Subirla (por ejemplo a 1.8, que cambia el MCP) se hace en un
  PR propio que pasa las pruebas de OAuth y del alta.
- Vincular cuentas por email solo es seguro si el email de la cuenta que ya existe está verificado. Las cuentas con
  email y contraseña necesitan, por tanto, correo saliente para verificar su email antes de poder unirse a otras.

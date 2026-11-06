# Spec: compendio-mundo (módulo 4)

Estado: **en marcha** (2026-11-06). Primera capacidad del módulo 4 (`docs/specs/modulo-4.md`). Entrevista:
`docs/modulos.md` § «### 4. Compendio, criaturas y biblioteca». Estudio: `research/foundry/criaturas-y-capas.md` § 1
y propuestas 1, 2 y 9.

## Objetivo

Que cada mundo tenga **su propio compendio**, como los compendios de mundo de Foundry: criaturas, objetos, conjuros
y lo demás hecho para ese mundo. Cada entrada se hace **para un sistema** y sale en las campañas del mundo que lo usan,
junto a las del sistema. Lo del sistema no se cambia desde una campaña: **se copia al mundo** y se cambia la copia,
que recuerda de dónde viene y avisa si su original cambia. Lo del mundo se puede llevar al sistema para usarlo en
otros mundos.

Para quién: el máster (y quien puede cambiar el mundo), en el compendio de su campaña; y la IA, por el MCP.

## Las capas

| Capa | Dónde vive | Quién la cambia | Quién la ve |
|---|---|---|---|
| Del sistema | El contenido del sistema de la cuenta (hoy) | Quien puede cambiar los sistemas de la cuenta | Las campañas con ese sistema, con sus fuentes elegidas |
| **Del mundo** | Nueva: contenido de un sistema dentro de un mundo | Quien puede cambiar el mundo (el máster) | Las campañas de ese mundo con ese sistema; hasta el módulo 5, solo el máster |

Crisol viene vacío (ADR-0015): el sistema de una campaña es siempre uno de la cuenta, así que «la capa de la cuenta»
de la entrevista es la del sistema. Si un día hay sistemas compartidos que no son tuyos, la de la cuenta se separa.

## Requisitos

- **El contenido del mundo** es un documento de un tipo del sistema, igual que el del sistema (sus campos, su texto,
  su mecánica, su concepto), con su mundo y su sistema. Se valida contra el sistema al guardarlo.
- **En la campaña**, el compendio enseña juntas las dos capas, con lo del mundo marcado («Del mundo») y un filtro para
  ver solo lo del mundo. Buscar, filtrar, las carpetas, las tablas del texto y lo que se lleva en la hoja funcionan
  igual con las dos. Lo del mundo no depende de las fuentes elegidas en la campaña: sale siempre.
- **Claves**: cada entrada del mundo tiene la suya, única en su mundo y su sistema. Si un día coincide con una del
  sistema, en la campaña manda la del mundo.
- **Copiar al mundo** una entrada del sistema: una entrada nueva del mundo, con otra clave, todo lo suyo (texto,
  campos y mecánica) y **su origen**: de qué sistema y qué clave sale, y cómo era el original al copiarla. Se abre para
  cambiarla (el nombre ya dice «(copia)» si se copia sin cambiar el nombre).
- **El original ha cambiado**: si la entrada del sistema de la que salió cambia, la copia lo dice y deja ver qué
  campos cambiaron y traerlos (todos o los que se elijan). Si el original desaparece, lo dice y la copia sigue.
- **Llevar al sistema** una entrada del mundo, para quien puede cambiar el sistema: se copia al sistema con su origen
  (el mundo del que sale) y la del mundo se queda o se quita, a elegir.
- **Crear, cambiar y borrar** en la app con el editor de entradas de hoy (el nombre, los campos de su tipo y su
  texto); «Nueva entrada» crea en el mundo, y en el sistema solo si se elige y se puede. Borrar pasa por el historial y
  se deshace.
- **Lo que lleva un personaje**: un objeto del mundo se puede llevar en la hoja como cualquier otro, y su jugador lo
  ve en su hoja (solo eso, hasta el módulo 5).
- **La IA**: buscar y leer ya incluyen lo del mundo (con campaignId); guardar y quitar en el mundo (`worldId` y
  `systemId` en `guardar_contenido` y `borrar_contenido`); copiar entre capas (`copiar_contenido`) y ver y traer los
  cambios del original.
- **Todo con el teclado y en el móvil**, WCAG 2.1 AA; textos por i18n.

## Decisiones (propuestas del estudio, por confirmar al ver las pantallas)

1. **Una copia, no una sustitución**: copiar al mundo deja dos entradas («Goblin» del sistema y «Goblin (copia)» del
   mundo), como en Foundry. Sustituir la del sistema en un mundo no entra.
2. **El origen** guarda el sistema, la clave y una huella del original al copiarlo (para saber si ha cambiado sin
   guardar el original entero) y lo que tenía entonces, para enseñar las diferencias por campo.
3. **Los permisos**: el compendio del mundo lo cambia quien puede cambiar el mundo (`world.write`); llevar al sistema
   pide además poder cambiar los sistemas de la cuenta.
4. **Colecciones del mundo** (los grupos de Foundry): no hacen falta todavía; lo del mundo se ordena con las secciones
   y carpetas del sistema. La visibilidad por colección o por entrada, con el módulo 5.

## Pruebas

- `packages/systems`: unir las dos capas en lo que ve una campaña (lo del mundo manda en las claves; las fuentes no lo
  esconden), la huella y las diferencias por campo.
- Servidor: guardar, copiar, llevar y borrar en el mundo con sus permisos (el jugador no puede; otro mundo no lo ve);
  la campaña de otro sistema no lo ve; el aviso del original cambiado; deshacer.
- Web: el compendio con lo del mundo marcado y su filtro; copiar al mundo y cambiar la copia; el aviso con sus
  diferencias.
- E2E: el máster copia el «Goblin» del sistema al mundo, le cambia los PG y el nombre, lo encuentra en el compendio de
  la campaña; el dueño del sistema cambia el original y la copia lo avisa.

## Fuera

Sustituir una entrada del sistema en un mundo, las colecciones propias del mundo, lo que ven los jugadores (módulo 5)
y compartir el compendio de un mundo con otra cuenta.

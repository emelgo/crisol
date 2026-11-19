# ADR-0030: Conectores de IA: Mundos y uno por campaña

Estado: aceptada (decisión 1 de Enrique del 2026-11-19, plan «Ajustes tras los módulos», bloque D) · Enmienda: el
apartado `ia` de `docs/specs/fundacion.md` (un solo `/mcp`) y «La IA» del ADR-0017 (la IA de quien juega solo lee).

## Contexto

Hasta ahora había una sola dirección MCP, `/mcp`, con las 238 herramientas para todo el mundo. La IA no sabía de qué
campaña se hablaba: cada herramienta pedía `campaignId`, y quien jugaba en dos campañas del mismo mundo tenía que
decirlo en cada lectura. La IA de una jugadora solo leía (con dos excepciones: sus notas y la página de su grupo),
aunque la web le deja crear su personaje, tirar o escribir en el registro. Enrique quiere dos tipos de conector:

- «Crisol · Mundos», la dirección de hoy, para quien crea mundos (y mañana migra Eana por ella: no puede cambiar);
- uno por campaña, donde la IA solo ve esa campaña con las herramientas del papel que se tiene en ella.

## Decisión

### Dos direcciones, un recurso OAuth cada una

- **`/mcp`, «Crisol · Mundos»**: igual que antes para el propietario de una organización o el máster de un mundo
  (todas las herramientas, las mismas instrucciones, el mismo token). Quien solo juega ve solo las herramientas de leer
  (80; las de escribir ni se anuncian).
- **`/mcp/campanas/:campaignId`, «Crisol · {campaña}»**: su propio recurso OAuth (RFC 8707) y sus metadatos en
  `/.well-known/oauth-protected-resource/mcp/campanas/:id` (RFC 9728, con `resource_name`). El token de una campaña
  lleva su dirección como audiencia y solo vale en ella: no en Mundos ni en otra campaña, y el de Mundos no vale en una
  campaña.

### Cómo se encaja en Better Auth (1.7)

Better Auth solo emite tokens para recursos dados de alta en `oauth_resource`, y por defecto exige que el cliente esté
unido a cada recurso (`oauth_client_resource`). Las campañas no se conocen al arrancar, y claude.ai es **un solo
cliente** para todos sus conectores (`https://claude.ai/oauth/mcp-oauth-client-metadata`), que al registrarse por CIMD
quedó unido solo a `/mcp`. Sin rodeos raros:

- El recurso de una campaña **se da de alta al vuelo**, idempotente (`aiRepo.ensureOAuthResource`), cuando se piden sus
  metadatos o la autorización (`before` de `/oauth2/authorize`), y solo si la campaña existe.
- **`enforcePerClientResources: false`**: cualquier cliente registrado puede pedir cualquier recurso dado de alta. Todos
  son conectores de este mismo servidor, y los clientes siguen siendo solo los de claude.ai/claude.com (CIMD) o los que
  da de alta el propietario.
- Cada petición se comprueba con `requireMcpAuth` y el recurso de su dirección (firma, emisor, audiencia y caducidad,
  sin base de datos). El consentimiento de una campaña solo lo da quien juega o dirige en ella.

Se descartó aceptar como audiencia cualquier recurso bajo `/mcp`: el token de una campaña valdría en Mundos y en las
demás, que es justo lo que se quiere evitar.

### Qué ve la IA en una campaña

- **La cuenta, recortada a esa campaña** (`scopedActor`): sus pertenencias, solo las de esa campaña, su mundo y su
  organización. La capa de políticas hace el resto: lo de otra campaña no existe, aunque la cuenta juegue en ella, y
  la proyección de la wiki usa esa campaña sin que se diga.
- **La campaña y el mundo los pone el servidor**: se quitan del esquema que ve la IA y se añaden al llamar (un sonido del
  mapa, solo al encenderlo o apagarlo en la campaña: sin `enabled`, cambia el del mundo).
- **Las herramientas, por el papel** (`connectors.ts`, fijadas en `connectors.test.ts`):
  - máster (de la campaña o de su mundo), 152: la Mesa, el registro, revelar, el «hoy» y el clima, las escenas, el
    combate, el sonido, el grupo, los personajes, el compendio de la campaña y leer el mundo. Escribir el mundo
    (páginas, plantillas, calendarios, mapas, sistemas) es de Mundos;
  - jugadora, 44: leer lo que sabe su campaña, ver y crear su personaje y cambiarlo como en la web, `tirar_dados` y
    `tirar_por_personaje`, el registro, sus notas, su página y el «hoy» con el clima de hoy.
- `tirar_dados` siempre tira en el registro de la campaña: la jugadora, a la vista por defecto (`all`, `self` o
  `master`); el máster, oculta por defecto.
- **Instrucciones propias**: la campaña, el mundo, el sistema, el papel, los personajes y el «hoy», y la guía de su
  papel.

### La barrera de la jugadora, por papel en esa campaña

En el conector de una campaña, la jugadora hace lo que la web le deja (`PLAYER_WRITES`: su personaje, sus tiradas, el
registro, sus notas y su página; cada acción mira que sea suyo) y, para su modo de IA, eso cuenta como «escribir»: su
personaje es suyo, no «de los jugadores». Lo demás contesta `READ_ONLY`. En Mundos, la barrera sigue como antes.

### Tus conexiones

- Ajustes › IA lista las apps conectadas con su conector y su último uso, para quien crea mundos y para quien está en
  una campaña (también el máster de una campaña que no es propietario). Salen de los tokens de refresco vivos de Better
  Auth (un cliente sin `offline_access` no sale).
- El token de acceso es un JWT de una hora que no se guarda: el último uso lo apunta el proceso en memoria
  (`AiConnections`) y, tras un reinicio, es la última renovación.
- **«Quitar»** revoca sus tokens de refresco y el conector rechaza al momento los de acceso que ya tenía (también en
  memoria: tras un reinicio, como mucho esa hora). No entra en el historial: son tablas de Better Auth (ADR-0002).
- El Inicio de cada campaña lleva «Conecta tu IA a esta campaña» con su dirección, para el máster y para quien juega.

## Alternativas descartadas

- **Un solo `/mcp` con `campaignId` en cada herramienta**: lo de hoy; la IA se lía entre campañas y ve herramientas que
  no puede usar.
- **Elegir la campaña dentro de la sesión MCP** (una herramienta «usar campaña»): el servidor es sin estado, y un
  conector por campaña se ve y se quita en claude.ai como cualquier otro.
- **Una migración con una tabla de conexiones**: el último uso exacto no compensa otra tabla junto a las de Better Auth;
  basta la memoria del proceso y la última renovación.

## Consecuencias

- Una herramienta nueva hay que clasificarla: en Mundos sale sola; en el conector de una campaña, solo si se añade a la
  lista de su papel (la prueba de la lista lo recuerda).
- Las peticiones que esperan aprobación guardan la entrada con la campaña ya puesta; al aprobarlas se hacen con la
  cuenta entera, como en la web.
- Los recursos de las campañas se quedan en `oauth_resource` aunque la campaña se borre: su token ya no sirve (no hay
  papel en ella).

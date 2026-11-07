# Spec: revelar (módulo 5)

Estado: **construido** (2026-11-06; en la rama `modulo-5/visibilidad`, aún sin PR). Segunda capacidad del módulo 5 (`docs/specs/modulo-5.md`), después de
`conocimiento`. Entrevista: `docs/modulos.md` § «### 5. Visibilidad por campaña». ADR-0017.

## Objetivo

Que el máster **revele en partida** lo que descubren los jugadores, con un clic y desde donde está: un secreto de una
página, una página entera o una entrada. Los jugadores **se enteran** (un aviso y lo nuevo marcado hasta que lo abren)
y el máster tiene a mano **lo que sabe cada grupo**, para repasarlo, deshacerlo u ocultarlo otra vez.

Para quién: el máster en partida (en el ordenador y en el móvil); los jugadores, que reciben lo revelado; la IA del
máster.

## Requisitos

### Revelar

- **Un secreto** (`> [!secreto]`) lleva, para el máster, «Revelar» en su cabecera: a toda la campaña o a unos
  personajes. Revelado, dice a quién («Lo saben: Lía, Bram») y se puede ampliar o volver a ocultar.
- **Una página**: «Revelar» en su cabecera hace lo mismo que «Lo sabe toda la campaña» de `conocimiento`, con el aviso.
- **Qué campaña**: si el máster está dentro de una campaña, se revela en esa; si no, elige entre las del mundo (si
  solo hay una, esa).
- Revelar un secreto de una página que la campaña no ve **avisa** («La página no la conocen: ¿revelarla también?»):
  un secreto solo se ve en su página.
- Cada revelación es una **operación del historial** (`reveal`), se deshace, y su frase dice qué, a quién y en qué
  campaña. El texto del secreto nunca entra en el historial.

### Los jugadores se enteran

- Al revelarle algo, a cada jugador afectado le llega **un aviso** en la app («Nuevo: El pacto de Varn»), que lleva a
  ello, si la tiene abierta. Si no, lo ve al entrar.
- **Lo nuevo sale marcado** hasta que lo abre: la página en el árbol, el secreto en la página («Nuevo»). La campaña
  dice cuántas novedades hay.
- Lo que se oculta otra vez **desaparece** sin aviso.

### Lo que sabe el grupo

- En la campaña, para el máster, **«Lo que sabe el grupo»**: lo revelado, de lo más reciente a lo más antiguo, con a
  quién y cuándo; filtrar por personaje y por tipo (páginas, secretos, mapas, compendio). Desde cada uno: abrirlo,
  ampliar o reducir a quién, ocultarlo otra vez.
- Las marcas heredadas del mundo salen aparte («Lo que sabe todo el mundo»), sin mezclarse con lo de la campaña.

### La IA

- `revelar` (un secreto, una página, una pestaña, un pin o una entrada; a la campaña o a unos personajes) y `ocultar`
  (lo contrario); tipo «jugadores»: en copiloto esperan la aprobación.
- `lo_que_sabe` (lo revelado de una campaña, con su público).
- `leer_pagina` con `ids` señala los secretos por su `^s-id`, como hasta ahora.

## Decisiones (propuestas de los estudios, por confirmar al ver las pantallas)

1. **El aviso, en la app**, sin correo ni notificaciones del navegador; lo nuevo se apunta por cuenta y se borra al
   abrirlo.
2. **Revelar un secreto no saca versión** de la página (ADR-0003 y `research/foundry/journal.md`: es cambiar quién ve
   su documento, no tocar el texto).
3. **Ocultar otra vez** quita el acceso, pero la operación queda en el historial: el máster sabe que lo vieron.
4. **Del diseño** (lienzo, tableros Revelar y Jugador): solo «Revelar» avisa; marcar desde «Quién la conoce» no. El
   secreto, con su morado de rayas: «Secreto · Revelar» o «Lo saben: Lía y Bram · Cambiar» (en «Cambiar», «Ocultar
   otra vez»). Si la campaña no conoce la página, «Revelar también la página», marcado. Un secreto se nombra por el
   título de su sección («Nuevo: El pacto de Varn»). «Lo que sabe el grupo» se abre como ventana desde «Revelado», en la
   barra de la campaña del máster, agrupado por día. La barra de la jugadora dice cuántas novedades tiene.
5. **Revelar solo suma** (2026-11-07, de la revisión): a quien ya lo ve, por su marca o heredado, no se le quita
   nada; si ya lo ve toda la campaña (o todos los elegidos), no se escribe. Por eso, con algo ya revelado, el botón
   dice «Revelar…» y no «Cambiar»; para quitárselo a alguien, «Ocultar otra vez» o «Quién la conoce». «Revelar también
   la página» sale si alguno de los elegidos no la conoce, y la página también se suma.

## Construido (2026-11-06) y lo que queda

- **Servidor** (`apps/server/src/actions/reveal.ts`): `reveal` (la marca y, con `alsoPage`, la de su página, en una
  operación; a quién le aparece se calcula con el motor antes y después para cada jugador, y a esas cuentas les llega
  `revealed` con el título de la página o de la sección del secreto), `hide` (quita la marca o, si lo seguirían viendo,
  «no la conocen»; quita lo nuevo), `listCampaignKnowledge`, `getSecretsKnowledge`, `listNews` y `seeNews`. Lo nuevo,
  en `knowledge_news` (0052), fuera del historial; tras deshacer, deja de salir porque ya no se ve.
- **Web**: «Revelar» en la cabecera del secreto («Lo saben: Lía · Revelar…») y en la de la página, con su desplegable
  (`apps/web/src/wiki/reveal.tsx`); «Revelado» en la barra de la campaña del máster, que abre «Lo que sabe el grupo»
  (`apps/web/src/campaign/group-knowledge.tsx`); el aviso de la jugadora (`apps/web/src/components/reveal-notices.tsx`),
  lo nuevo en su árbol, en el secreto y en la barra.
- **IA**: `revelar`, `ocultar` y `lo_que_sabe` (revelar y ocultar esperan aprobación en copiloto).
- **Pruebas**: `reveal.integration.test.ts`, el aviso en `realtime.integration.test.ts`, el MCP y la e2e
  `revelar.spec.ts`.
- **Queda**: «Cambiar a quién» desde «Lo que sabe el grupo» (hoy, ocultar y volver a revelar, o «Quién la conoce»);
  revelar una entrada del mundo desde la web (hoy, la IA y la API; ocultarla, desde «Lo que sabe el grupo»).

## Pruebas

- Servidor: revelar un secreto a un personaje lo ve su dueño y nadie más (API, búsqueda, MCP); ocultarlo lo quita al
  momento; deshacer la revelación; el aviso solo les llega a los afectados y sin el texto del secreto en el evento.
- E2E: el máster revela un secreto a la pícara durante la partida; la jugadora de la pícara recibe el aviso y lo lee;
  el otro jugador no lo ve ni en la búsqueda; «Lo que sabe el grupo» lo enseña y lo oculta otra vez.
- La prueba de fugas: un secreto revelado a uno no le llega al otro por ninguna vía.

## Fuera

- «Mostrar a los jugadores» una imagen o una página en pantalla, al momento (módulo 7, la sala de jugadores).
- Las notas de los jugadores sobre lo que saben (módulo 7).

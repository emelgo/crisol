# Módulos 8 y 10 · campaña: el hoy, el clima, los viajes, la actividad y la pantalla del máster

Inventario § 7 («Hoy» por campaña, clima con semilla, orto y ocaso, calculadora de viajes) y § 10-11 (centro de avisos
y actividad, pantalla del máster). ADR-0029 (fechas canónicas; prevé el «hoy» de cada campaña). Estudio del antiguo y
del nuevo: 2026-11-17 (resumen en «Lo que había»).

## Decisiones de Enrique (2026-11-17) — mandan sobre lo de abajo

1. **El «hoy» de cada campaña, en la cabecera de la campaña y en la Mesa.** El máster lo avanza con botones (+1 día,
   +1 semana, poner fecha) o con un viaje; cada cambio queda en el registro de la partida; las cronologías marcan «hoy».
2. **Clima, sol y Mesa.** Clima por días según la zona (templado, árido, frío…), con semilla (no cambia al recargar) y
   editable a mano; orto y ocaso según la latitud y la estación; las jugadoras lo ven y la capa de clima de la Mesa lo
   sigue.
3. **Viajes con ruta en el mapa** (o la distancia escrita): ritmo y medio (a pie, a caballo, en barco) → días, y si se
   quiere, avanzar «hoy» con el clima de cada día del viaje.
4. **Centro de actividad y pantalla del máster**, los dos: lo que ha pasado en la campaña desde tu última visita (notas
   y personajes de las jugadoras, revelado, sesiones), con avisos; y en la Mesa, las fichas de la escena, una nota
   fijada y las tablas a mano.

## Decisiones tomadas sin Enrique (con recomendación; se le enseñan en el lienzo y en `tasks/probar.md`)

### El hoy
5. **En el calendario principal del mundo**, como fecha canónica en una columna nueva `campaigns.today` (nula hasta que
   el máster la ponga). La jugadora lo lee en el mismo calendario (sin eras ocultas).
6. **Campaña nueva sin fecha**: la cabecera dice «Sin fecha» y ofrece ponerla; si otra campaña del mundo tiene, se
   propone copiarla.
7. **Botones**: −1 día, +1 día, +1 semana (los días de la semana del calendario) y «Poner fecha» (el selector de
   fechas del módulo 8). En la cabecera del Inicio de la campaña y como chip con menú en la barra de la Mesa; la
   jugadora solo lo lee.
8. **Con historial**: cambiar el hoy pasa por `operation()` y se deshace. El registro no se deshace: deshacer escribe su
   propia entrada («La fecha vuelve a…»).
9. **Entrada de sistema en el registro**: `kind: 'event'` nuevo (migración), con datos estructurados
   (`{type: 'date' | 'travel' | 'weather', …}`) que la interfaz lee por i18n. La ven todos; el clima cambiado a mano,
   solo el máster.
10. **En las cronologías**: en las vistas de campaña (la jugadora y la Mesa), una línea «Hoy» y «hace / dentro de N
    días». En la del mundo, un selector «Hoy de…» si hay varias campañas con fecha.

### El clima y el sol
11. **Zonas de una lista cerrada** con los parámetros del modelo del antiguo: templada, árida, fría, tropical, de
    montaña, de costa, polar. **La zona actual es de la campaña** (cambia al viajar), con su latitud.
12. **Semilla `(mundo, zona, día absoluto)`**: dos campañas en la misma zona y el mismo día ven el mismo clima. Función
    pura que recalcula la racha desde una ventana fija hacia atrás (14 días); no se guardan los días generados.
13. **A mano**: condición, mínima, máxima y viento, guardado por campaña y día (`campaign_weather`); no cambia los días
    siguientes.
14. **El máster ve hoy y la previsión de 7 días; la jugadora, solo el clima de hoy y el sol.**
15. **Sol**: latitud en la campaña (por defecto 45°) y solsticio de invierno sacado de la estación «Invierno» del
    calendario (mitad de la estación). Salida, puesta, alba y anochecer (crepúsculo civil), horas de luz, día o noche
    polar. Solo informa: sin horas en las fechas, no mueve la oscuridad de la escena.
16. **Capa de clima de la Mesa** (nueva, PixiJS, en la Mesa, la de la jugadora y la Vista de jugadores): partículas sin
    estado (semilla + tiempo; nada que sincronizar). Modo en `campaign_tables`: **como hoy** (por defecto) / a mano
    (lluvia, nieve, niebla, ceniza, intensidad, viento) / ninguno; interruptor **Interior** por escena (`scenes`), que
    la apaga.

### Los viajes
17. **Desde el recuadro de medir del mapa** (ya da días a pie, a caballo y en barco con los `speeds` del mapa) y desde
    «Viaje» en la Mesa con la distancia escrita. Ritmo lento / normal / rápido (×0,67 / ×1 / ×1,33) y días de descanso.
    Los ritmos del sistema no se usan en esta versión.
18. **«Avanzar hoy»**: una sola operación que suma los días (redondeados hacia arriba), cambia la zona si se elige la
    de destino y deja una entrada en el registro con el resumen (ruta, medio, días y el clima de cada día).

### La actividad
19. **«Desde tu última visita»**: tabla `campaign_visits(userId, campaignId, seenAt)`, que se pone al marcar como visto
    o al salir del centro, nunca con cada carga.
20. **Fuentes**: notas nuevas o cambiadas de las jugadoras, cambios en sus personajes, lo revelado a la campaña, el
    registro (resumido por día) y los cambios de fecha. `operations` gana `campaignId` (migración) para leerlo de un
    sitio; lo que no pase por `operations` se lee de su tabla.
21. **«Sesión» = un día real con actividad en la Mesa** (agrupar por fecha real); la sesión con tramo propio, más
    adelante.
22. **Avisos**: insignia en «Inicio» de la barra de la campaña con el número de cosas nuevas, el centro en el Inicio
    (máster y jugadora, cada uno con lo que puede ver) y un aviso en vivo si estás dentro. Sin correo ni notificaciones
    del navegador.
23. **La jugadora** ve en su centro lo que le revelan, lo nuevo del registro que le llega y los cambios de fecha; nunca
    notas de otras ni nada oculto (prueba de fugas).

### La pantalla del máster
24. **Se amplía el cajón que ya hay** (`apps/web/src/tabletop/gm-screen.tsx`, atajo G): además de los statblocks de las
    criaturas, los personajes de la escena (ficha corta) y **Tablas** (elegir tablas aleatorias del mundo y tirarlas;
    el resultado va al registro como tirada oculta). La nota fijada y lo elegido se guardan en el servidor
    (`scene_states`), no en el navegador.
25. El Kanban de reglas del antiguo no vuelve.

### La IA
26. MCP: `fecha_de_hoy`, `cambiar_fecha` (fecha o días), `ver_clima` (rango), `cambiar_clima`, `planear_viaje` (con o
    sin avanzar), `actividad_campana`.

## Preguntas del lienzo, aprobadas por Enrique (2026-11-17: «ok»)

Lienzo: https://claude.ai/artifact/UN7grzw9ZSYEjDEg9HrKcs.

27. El hoy en el Inicio del máster, grande (fecha, clima, sol, zona y previsión de 7 días).
28. Temperatura en grados centígrados; el viento en palabras con su dirección.
29. En la Mesa, el chip del hoy bajo el de la escena; la capa de clima e «Interior», en su menú.
30. Los días de descanso de un viaje, repartidos por el camino.
31. La jugadora no ve la previsión: solo hoy y el sol (confirma la 14).
32. «Desde tu última visita» se marca como visto solo con su botón (confirma la 19).
33. La pantalla del máster en cuatro columnas que se encienden y apagan; las tablas, ocultas por defecto, con la opción
    de tirarlas a la vista de todos.

## Capacidades

| Capacidad | Qué | Depende de |
|---|---|---|
| `hoy` | La fecha de la campaña, sus botones, el registro, las cronologías, la IA | — |
| `clima` | Zonas, generador puro, cambios a mano, sol, lo que ve cada uno, la IA | `hoy` |
| `capa-clima` | Partículas en la Mesa, la jugadora y la Vista de jugadores; modo e Interior | `clima` |
| `viajes` | Ritmo, descanso, avanzar hoy con el clima de cada día, desde el mapa y la Mesa, la IA | `hoy`, `clima` |
| `actividad` | Última visita, fuentes, centro, insignia y avisos, la IA | `hoy` |
| `pantalla-master` | Personajes y tablas en el cajón G; lo elegido en el servidor | — |

Orden: `hoy` → `clima` → `viajes` → `capa-clima` → `actividad` → `pantalla-master`.

## Criterios de aceptación

- Pongo la fecha, la avanzo una semana y sale en la cabecera, en la Mesa, en el registro y como «Hoy» en la cronología
  de la campaña; deshacer la devuelve.
- El clima de hoy no cambia al recargar; cambiado a mano, se queda y no altera mañana; la jugadora ve hoy y el sol, no
  la previsión.
- Mido una ruta en el mapa, elijo caballo y ritmo rápido, avanzo: el hoy suma los días y el registro lleva el clima de
  cada uno.
- La lluvia de hoy cae en la Mesa, en el móvil de la jugadora y en la tele; en una escena Interior, no.
- El centro enseña lo nuevo desde mi última visita y la insignia se vacía al verlo; la jugadora no ve nada ajeno.
- En el cajón G salen los personajes de la escena y tiro una tabla; en otro aparato sigue la misma nota fijada.
- Unitarias, integración (con rendimiento del clima: un año en < 50 ms), e2e (con axe y fugas), lint, typecheck y
  licencias en verde.

## Lo que había

- **Antiguo**: «hoy» por campaña en `estado.json`; clima del mundo con el modelo de los «weather pack» (18 parámetros,
  solo el pack «General»), semilla FNV-1a + mulberry32, encadenado día a día y guardado; a mano bloquea el día; sol con
  latitud e inclinación en el calendario; calculadora de viajes al medir (solo a pie, ritmos del sistema) que solo
  avanzaba días; capa de clima de partículas sin estado y botón «Como el clima de hoy»; sin «última visita».
- **Eana**: una campaña con hoy (331, mes 12, día 1); latitud 41; 8 días de clima generados, ninguno a mano; sin
  viajes guardados.
- **Nuevo**: dominio de fechas con `addDays`, estaciones, lunas, `formatDistance`; campañas sin calendario ni hoy;
  registro con `kind` message/shown (no se deshace); mapas con escala, `speeds` y `measureMap` que ya da días; sin
  capa de clima; `knowledge_news` para lo nuevo de la jugadora; `operations` sin `campaignId`; cajón G con statblocks
  y una nota (solo en el navegador).

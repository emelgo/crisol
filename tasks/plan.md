# Plan: Módulo 3 — personajes

Estado: en marcha (Enrique, 2026-11-05: «termina el módulo 3 de una vez»). Spec: `docs/specs/personajes.md` (aprobada)
· ADR-0013 (aceptado) · Mapa del módulo: `docs/specs/modulo-3.md` · Diseño: lienzo «Crisol: personajes» (fuentes en
`out/lienzo-personajes/`) · Tareas: `tasks/todo.md` · Fecha: 2026-11-05. Los planes anteriores, en `tasks/<capacidad>/`.

## Resumen

Primero lo que Enrique pidió ver («¿dónde está el compendio?»): **la campaña en su propia vista, con su compendio**.
Después, de abajo arriba y en porciones que funcionan:

1. **La vista de la campaña y su compendio** (`campana`): la barra cambia al entrar (Inicio de la campaña, Personajes,
   Compendio, Dados), y el compendio lee el contenido del sistema de la campaña con sus ediciones. Lo ven todos sus
   miembros: acciones nuevas autorizadas por la campaña, no por la cuenta.
2. **El personaje** (`personaje`): la tabla, sus permisos y fugas, la lista en la campaña con «Personaje nuevo» y su
   ventana; la ficha mínima calculada con `evaluate`.
3. **Los pasos** (`pasos`): la sección `steps` del formato, el motor puro de lo pendiente (pasos + `grants` por nivel),
   los requisitos con su motivo, subir y bajar de nivel, los PG; los pasos del 5e y lo que su contenido necesita
   (requisitos de multiclase, equipo inicial, conjuros por nivel). Se prueba con los personajes de referencia.
4. **El creador** (`creador`): la cabecera con la barra de pasos y sus (!), cada paso, las elecciones en el panel, la
   multiclase, las características con sus métodos; las versiones y restaurar.
5. **Las tablas** (`tablas`): el dato, su tirada en el servidor con su registro, sin reemplazo por campaña; la pestaña
   «Tabla» de una página; las del SRD en el contenido.
6. **La IA** (`ia`): las herramientas MCP de personajes y tablas, con sus aprobaciones; los pasos en `formato_sistemas`.

Después, `hoja` (su spec, diseño y plan) y el cierre del módulo. `foundry` espera al abogado (spec del módulo).

## Decisiones

- **El compendio de la campaña** usa acciones nuevas (`searchCampaignContent`, `getCampaignContent`) con el permiso de
  leer la campaña: un jugador ve el contenido del sistema de su campaña (con las fuentes que eligió), no los sistemas de
  la cuenta.
- **La vista de la campaña** son rutas bajo `/mundos/$worldId/campanas/$campaignId` (inicio, `personajes`,
  `compendio`): la barra lo detecta por la ruta, como la del mundo, y la llama vuelve a Mis mundos.
- **El personaje** se guarda como sus elecciones y su contenido por referencia (ADR-0013); la hoja se calcula.
- Una migración por porción que la necesite. Todo en la rama `modulo-3/personajes`; la CI, una vez al final.

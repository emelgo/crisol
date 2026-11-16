# Intención: calendarios y líneas temporales (módulo 8 · mundo)

Entrevista con Enrique, 2026-11-16 (una ronda; quiere terminar la app y dejar los ajustes de interfaz para después).

- **Calendarios**: un mundo tiene **varios**, con **uno principal** (el de las fechas por defecto). Cada uno con meses, días
  de la semana, eras, lunas y estaciones, y su editor (como el Crisol antiguo: `docs/inventario.md` § 7).
- **Eventos**: un elemento con fecha (o rango), título, color o imagen y, si se quiere, **una página enlazada**. Además,
  **una página con un campo de fecha sale sola** en la línea temporal.
- **La línea temporal, como pestaña de una página** (ADR-0007, fase 3; la «Pronto» de «Pestaña nueva»), con las **tres
  vistas de Everlore**: lista (la línea vertical con las tarjetas), meses (rejilla por años, meses o días) y calendario
  (el mes día a día, con las lunas).
- **Importar de otros formatos: no** (ni en la interfaz ni como objetivo). Se crean a mano o con la IA por el MCP.
- Fuera de este módulo: el «hoy» de cada campaña, el clima y los viajes (8 · campaña).
- Referencias: Everlore (`apps/web/src/components/timelines/`), el Crisol antiguo (`core/src/calendar`, solo consulta).

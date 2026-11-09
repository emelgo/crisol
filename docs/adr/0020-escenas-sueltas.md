# ADR-0020: Escenas sueltas, como en Foundry

Estado: aceptada (Enrique, 2026-11-10: «Escenas sueltas, como Foundry») · Tras ADR-0019

## Contexto

Desde el módulo 6 (docs/specs/escenas.md) una escena es una **pestaña de una página** de la wiki, como un mapa: la
tabla `scenes` apunta a `page_tabs` (`tab_id` obligatorio) y sus permisos van por la página. Tiene sentido para un
lugar (la página de la Cripta, con su texto y su mapa de batalla), pero desde la Mesa no: al probar la campaña
alrededor de la Mesa (ADR-0019), Enrique creó escenas con «Escena nueva» y preguntó «¿por qué se crea una página al
crear una escena? no tiene sentido», además de que editarlas «es súper poco intuitivo». De tres opciones (ordenarlas
en una página «Escenas», sueltas como Foundry o dejarlo), eligió **sueltas**.

## Decisión

1. **Una escena puede ir sin página.** `scenes.tab_id` pasa a ser opcional y la escena guarda su **nombre** (`name`).
   La de una pestaña sigue igual (su nombre, el de la pestaña); la suelta, el suyo. Nada se migra: las que ya están en
   páginas siguen ahí, y las sueltas son las que se crean desde la Mesa (o por la IA).
2. **Se pueden enlazar a una página**, opcional: las que viven en una pestaña ya lo están; enlazar una suelta a un
   lugar queda para más adelante, si hace falta.
3. **Permisos**: la escena de una pestaña, por su página, como hasta ahora; la suelta, por el **mundo** (`page.write`
   para cambiarla, la de quien edita el mundo; nadie más la ve: los jugadores solo reciben la proyección de la Mesa,
   ADR-0018).
4. **Acciones nuevas**: `createScene` (mundo y nombre), `renameScene` y `deleteScene` (de una suelta; la de una
   pestaña se borra quitando la pestaña). `getScene` acepta `sceneId` además de `tabId`. MCP: `crear_escena`,
   `renombrar_escena`, `borrar_escena`.
5. **En la Mesa**, «Escena nueva» crea una suelta (sin página); su menú (botón derecho o «⋯») abre su editor (mapa,
   rejilla y ajustes) en una ventana de la Mesa, cambia su nombre o la borra. Las de una página abren esa página.

## Consecuencias

- La wiki deja de llenarse de páginas que solo son una escena.
- Dos clases de escena conviven; el código que mostraba «su página» (`pageId`, `pageTitle`) lo trata como opcional.
- La escena suelta no está en la papelera de páginas: borrarla pide confirmación y se puede deshacer desde el historial
  del mundo mientras se pueda.

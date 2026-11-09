# Spec: libros y el espacio de la campaña

Decisión: ADR-0021 · Diseño aprobado: lienzo «Libros y campaña» (https://claude.ai/artifact/6RYct1c2kikxuTZyqkEpTb,
`out/lienzo-libros/`, «está genial», 2026-11-10) · Estudio: `research/roliando/sistemas-y-libros.md`,
`research/nivel20/sistemas-y-libros.md`

## Objetivo

Que el máster arme el compendio de cada campaña con libros: el de serie, los que mete desde sus PDF con la IA y los
suyos; que cada cosa diga de qué libro y página sale; y que la campaña vuelva a tener su espacio, con la Mesa como una
sección. Para quién: Enrique (máster, en PC) y sus jugadores (la jugadora, también en el móvil).

## Requisitos

### Libros (sistema)

1. Un libro es una fuente del documento del sistema con, además de lo que ya tiene (clave, nombre, licencia,
   atribución, edición, editorial, fecha): `description` (texto corto), `cover` (una imagen de los comunes, como la
   portada de un mundo), `origin` (`pdf`, `file` u `own`), `file` (el PDF de la biblioteca del que sale), `requires`
   (claves de los libros a los que amplía) y `version` (entero, empieza en 1). Todo opcional: los sistemas de antes
   siguen valiendo.
2. Acciones sobre los sistemas de la cuenta (solo su propietario): `createBook`, `updateBook`, `deleteBook`, y la
   lectura `getSystemBooks` (cada libro con sus recuentos por tipo y tres ejemplos, sus pendientes de revisar y las
   campañas que lo usan). Herramientas MCP: `ver_libros`, `crear_libro`, `cambiar_libro`, `borrar_libro`.
3. `deleteBook` se niega si una campaña lo tiene elegido (dice cuáles); si no, se lleva su contenido (y vuelve con
   deshacer, como todo).
4. `requires` solo admite libros del mismo sistema; validar el sistema lo comprueba.
5. Los sistemas de serie (en el código) no ganan libros: para añadir uno, se copia el sistema a la cuenta (como hoy).

### Pendientes de revisar

6. Una entrada del contenido puede estar **pendiente de revisar**: `review = { page?, excerpt?, notes[] }`. Mientras lo
   esté no sale en nada que lea o cuente el contenido (compendio, creador, criaturas, búsquedas, tablas, MCP de
   lectura, recuentos).
7. `proposeContent` (MCP `proponer_contenido`): la IA guarda entradas de un libro como pendientes, por tandas (hasta
   100), con su página, el trozo del PDF y sus avisos. Si ya hay una con la misma clave, la sustituye; si ya existe
   una aceptada con el mismo nombre en otro libro del sistema, se marca como repetida.
8. `listPending` (por libro y tipo), `acceptPending` (claves, con el tipo cambiado si se cambió) y `discardPending`.
   Aceptar quita `review`; descartar borra. Todo pasa por el historial.

### La campaña

9. `systemChoices.excluded`: claves de entradas del sistema que la campaña deja fuera (hasta 10.000). Lo que el libro
   gane después entra. El compendio del mundo no se puede excluir.
10. Lo que la campaña no tiene (libro apagado o entrada excluida) no existe para ella: compendio, búsqueda, creador,
    subir de nivel, criaturas, Mesa y MCP.
11. `getCampaignCompendium` da, además, cada libro elegido con su portada, su recuento y su número de excluidas, y el
    libro del mundo; las búsquedas y las lecturas dan, por entrada, el nombre de su libro y su página.

### Web: el espacio de la campaña

12. `/mundos/$w/campanas/$c` es el **Inicio** (se entra en la misma pestaña); la barra de la izquierda cambia a la de la
    campaña. Secciones: Inicio, Mesa (`/personajes`: los personajes, quién está en la Mesa y abrirla), Libros
    (`/libros`, solo el máster), Compendio (`/compendio`), Aventuras (`/aventuras`, vacía por ahora), Páginas
    (`/paginas`); Ajustes, encima.
13. La Mesa (`/mesa`) se abre en otra pestaña, a pantalla completa y sin la barra. `?panel=`, `?pagina=` y `?entrada=`
    en la dirección de la campaña llevan a ella con eso. Quién está dentro (con su pestaña a la vista o no) lo cuenta el
    canal de la mesa (`{ type: 'presence', active }`) y lo lee `getTablePresence`.
14. Inicio del máster: «Ir a la Mesa» (la escena abierta, su sesión, si hay combate), jugadores y personajes (con quién
    está conectado), libros (sus portadas, «Cambiar»), aventura en curso (vacío por ahora). Inicio de la jugadora: su
    personaje, «Ir a la Mesa», el grupo, los libros, lo último que sabe; en el móvil, en una columna.
15. **Libros** (campaña): una tarjeta por libro del sistema con su portada, interruptor «en la campaña» y «Elegir
    contenido» (o «N quitadas»); el del mundo, «Siempre»; «Todos / En la campaña». «Elegir contenido»: buscador, «N de
    M dentro», una fila por tipo con casilla y fracción, que se despliega en sus entradas. Encender un libro que amplía
    a otro apagado lo avisa.
16. **Ficha de un libro** en una ventana que sale de su tarjeta (la portada viaja): portada, sistema, edición, origen
    (con su PDF), versión, licencia, descripción, «Qué trae» (recuento por tipo con ejemplos y «En el compendio»), «Amplía
    a» y las campañas que lo usan. El engranaje abre sus ajustes (nombre, portada, descripción, edición, licencia,
    amplía a) y su zona de peligro.
17. **Sistemas → un sistema → Libros**: sus libros en tarjetas y «Libro nuevo» (discontinuo al final): con la IA desde
    un PDF de la biblioteca (crea el libro y da la frase para copiar), desde un archivo o vacío. Un libro con pendientes
    lo dice en su tarjeta («N para revisar») y lleva a la revisión.
18. **Revisar** (pantalla propia del sistema): tipos con su recuento a la izquierda; las entradas del tipo con casilla,
    nombre y lo que falta, tipo (cambiable) y página; «En el PDF / Cómo queda» a la derecha; «Añadir N entradas al
    libro» y «Descartar».
19. **Compendio** (campaña, pantalla propia y la pestaña de la Mesa): «Por tipo / Por libro»; filtro por libro;
    columna «Libro» con su página; la entrada dice libro y página; «Cambiada» en lo cambiado en el mundo, con «Ver
    original».
20. **Creador**: bajo cada opción, su libro; filtros por libro arriba (solo los de la campaña).
21. Textos de la interfaz en `i18n.ts`; cada pantalla nueva, con su tutorial guiado; nada nombra Foundry ni D&D Beyond.

## Pruebas

- **Dominio** (`packages/systems`): los campos nuevos del libro validan; `requires` a un libro que no existe falla;
  `visibleContent` se salta lo excluido y lo pendiente; el compendio cuenta por libro.
- **Servidor** (integración): crear, cambiar y borrar libros (permisos, el borrado que se niega con su campaña,
  deshacer); proponer, listar, aceptar con otro tipo y descartar; lo pendiente no sale en compendio, búsqueda ni
  creador; lo excluido no sale en la campaña; las herramientas MCP en cada modo de IA.
- **Web** (Vitest): el Inicio (máster y jugadora), Libros (interruptores, «Elegir contenido»), la ficha, «Libro
  nuevo», la revisión, el compendio por libro, el creador con libros y las redirecciones de las direcciones viejas.
- **E2E** (Playwright + axe): entrar en una campaña (Inicio) e ir a la Mesa; apagar un libro y que desaparezca del
  compendio; crear un libro vacío, proponerle entradas por la API (como haría la IA), revisarlas y verlas en el
  compendio con su página; la jugadora en el móvil.

## Fuera

- Cambios de una entrada solo para una campaña (los hay para el mundo).
- Dos versiones de un libro a la vez.
- Portada sacada del PDF.
- Aventuras (su lienzo propio).
- Que los jugadores aporten libros.

# ADR-0021: Los libros de un sistema y el espacio propio de la campaña

Estado: aceptada (Enrique, 2026-11-10: «está genial» al lienzo «Libros y campaña», con sus 16 decisiones) · Sustituye
las decisiones 1 a 3 del ADR-0019

## Contexto

Tras el estudio de Roliando y Nivel20 (`research/roliando/`, `research/nivel20/`; informe en
https://claude.ai/artifact/4uPvHP5VgzGfPLPWKCCc4Y), Enrique pidió dos cosas:

- «al abrir una campaña volvemos a abrir una vista como la del mundo y ahí tendremos los libros, compendio, aventuras
  etc y además la mesa» (la campaña abría directamente en la Mesa, sin barra lateral: ADR-0019);
- que un sistema sean las reglas y que **los libros llenen su compendio**: el 5e con el SRD, los libros de D&D y los de
  Fateforge; la campaña elige el sistema y después qué libros usa.

Los libros ya existían a medias: son las **fuentes** del documento de un sistema (`sources`: clave, nombre, licencia,
atribución, edición, editorial, fecha), cada entrada del contenido lleva la suya (`source`) y su página (`ref.pages`),
y la campaña elige cuáles usa (`systemChoices.sources`). Faltaba tratarlos como algo de primera: con portada y
descripción, que se puedan añadir a un sistema que ya existe, que la campaña pueda dejar fuera entradas sueltas, que el
compendio diga de qué libro y página sale cada cosa, y una forma cómoda de meter un libro desde su PDF.

El lienzo «Libros y campaña» (https://claude.ai/artifact/6RYct1c2kikxuTZyqkEpTb; `out/lienzo-libros/`) lo enseñó en
ocho tableros.

## Decisión

1. **La campaña tiene su espacio, como el mundo.** Se abre **en la misma pestaña** (Enrique, 2026-11-10) y se ve su
   **Inicio**, con su barra a la izquierda: su portada arriba (vuelve a Inicio), Inicio, Mesa, Libros, Compendio,
   Aventuras y Páginas; Ajustes, abajo, se abre encima. La llama sigue llevando a Mis mundos.
2. **La sección Mesa une los personajes y la Mesa** (Enrique, 2026-11-10: «personajes y mesa podemos unirlo dentro de
   la campaña y luego se abre la mesa en otra pestaña»; «desde la pestaña mesa debemos ver quiénes están dentro, si
   está activo»): «Abrir la Mesa» (y «Abrir la tele») en otra pestaña, **quién está en la Mesa ahora** (el máster, los
   jugadores y la tele, desde cuándo y si tiene la pestaña a la vista: `getTablePresence`, MCP `quien_esta_en_la_mesa`,
   en vivo por el canal de la mesa) y, para el máster, la escena abierta, lo que enseña la tele y el combate; debajo,
   los personajes. **La Mesa** (`/mundos/$w/campanas/$c/mesa`) va a pantalla completa en su pestaña, sin la barra de la
   izquierda, y por dentro sigue igual. «Ir a la Mesa» del Inicio también la abre en otra pestaña. Las direcciones de
   antes (`?panel=`, `?pagina=`, `?entrada=` sobre la campaña) llevan a la Mesa con lo que pedían.
3. **Inicio**: «Ir a la Mesa» con la escena en marcha, los jugadores con sus personajes, los libros que usa y la
   aventura en curso. La jugadora ve el suyo: su personaje, «Ir a la Mesa», el grupo, los libros (sin poder cambiarlos)
   y lo último que sabe; sus secciones son Inicio, Mesa, Compendio y Páginas.
4. **Un libro es una fuente del sistema, con más datos**: descripción, portada, de dónde sale (un PDF de la biblioteca,
   un archivo o hecho a mano), los libros a los que amplía (`requires`) y su versión. Solo añade entradas; las reglas
   son del sistema. Lo de serie es un libro más («Reglas básicas»). Se añaden, cambian y borran libros de los sistemas
   de la cuenta con sus propias acciones (y herramientas MCP), sin reescribir el sistema entero. **Un libro que usa una
   campaña no se borra**, y se dice cuál.
5. **La campaña elige libros y, dentro de cada uno, qué entra**: `systemChoices.excluded`, las claves de las entradas
   que deja fuera (por clave, nunca por nombre: así no cae un idioma que se llama como una especie). Lo que el libro
   gane después entra. Lo que no está no existe en la campaña: ni en el compendio, ni al crear personajes, ni en la
   Mesa, ni para la IA.
6. **Lo del mundo** (su compendio: lo copiado y lo hecho para él) **se ve como un libro más**, con el nombre del mundo y
   siempre dentro. Una entrada cambiada en el mundo se marca «Cambiada» con «Ver original» y «Traer el original» (las
   copias con origen que ya hay). *El lienzo decía «para La Marca»; los cambios por campaña quedan fuera de este ADR.*
7. **Cada entrada dice su libro y su página**, en las listas, en la entrada y al crear personajes; el compendio se ve
   **por tipo o por libro** y se filtra por libro. Desde la ficha de un libro, cada recuento abre el compendio filtrado.
8. **Un libro nuevo con la IA desde un PDF**: Crisol no lanza la IA. Crea el libro (con su PDF) y da la frase para
   pedírselo a la IA conectada, que lee el PDF por el conector (`leer_libro`) y **propone** entradas: quedan
   **pendientes de revisar** (`review` en la entrada: su página, el trozo del PDF y sus avisos) y no se ven en ningún
   sitio hasta aceptarlas. La revisión (por tipo, con casilla, tipo y página; lo repetido sin marcar; el texto del PDF
   al lado) acepta o descarta. También se crea un libro desde un archivo (el de Crisol o un paquete de Foundry, como ya
   se importan) o vacío.
9. **Versiones sin sorpresas**: el libro guarda su versión; traer una nueva no cambia las campañas que lo usan sin que
   el máster lo acepte. *Primera fase: la versión se ve y sube; que convivan dos versiones queda para después.*

## Consecuencias

- El ADR-0019 sigue valiendo en lo de dentro de la Mesa (pestañas, ventanas, enseñar, la Mesa de quien juega, «Del
  grupo», varias campañas por mundo); sus decisiones 1 a 3 (abrir en la Mesa, sin vistas sueltas, la barra mínima) las
  sustituye esta.
- Las vistas de la campaña que el ADR-0019 llevó a la Mesa (Compendio, Personajes, Páginas) vuelven a tener pantalla
  propia; la Mesa conserva sus pestañas, que abren lo mismo en pequeño.
- El contenido gana un estado más (pendiente de revisar): todo lo que lee o cuenta el contenido (compendio, creador,
  criaturas, búsquedas, MCP) tiene que saltárselo.
- Aventuras sale en la barra con su pantalla vacía hasta su propio lienzo (capítulos, escenas, criaturas, importarlas).
- Las portadas de los libros: una imagen de los comunes de la cuenta (como la de un mundo); sacarla de la primera
  página del PDF, después.

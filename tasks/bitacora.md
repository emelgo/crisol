# Bitácora del módulo 1

Notas de trabajo para no perder el hilo entre compactaciones: decisiones pequeñas, por dónde va la tarea en curso y lo
que queda pendiente de Enrique. Lo que ya está hecho va a `docs/modulos.md` § «Dónde estamos» y a `tasks/todo.md`.

## Encargo

2026-10-30: Enrique se fue a dormir y pidió terminar el módulo sin parar, apuntándolo todo.

- **Ciclo de cada tarea**: rama, TDD, PR, 4 checks en verde, merge, despliegue y comprobación de staging.
- **Puntos de control 3 a 6**: no se espera; se apuntan aquí como pendientes de Enrique.
- **Lo que pide permiso** no se hace: se aparta aquí y se sigue con lo demás.
- **Al acabar el módulo**: apuntar por dónde vamos y dedicarse a la interfaz, que Enrique ve «horrible».

## Permisos de Enrique (2026-10-30, antes de irse)

- **Dependencias**: cualquier extensión oficial de TipTap 3.32 con licencia MIT, y `@floating-ui/dom`. Se apuntan en el
  PR de cada tarea. Si hiciera falta otra dependencia fuera de TipTap, se programa a mano o se deja apuntada aquí.
- **Volumen**: «archivos» en `compose.prod.yaml`, montado en la app (tarea 18).
- **Chromium**: dentro de la imagen de la app, para «Descargar PDF» desde el servidor (tarea 24). Cambia la decisión 2
  de la spec («imprimir ahora»): hay que actualizar la spec y la tarea 24. Para manejarlo desde el servidor,
  `playwright-core` (Apache-2.0) o lo que use menos.

## Pendiente de Enrique

Hay que contárselo al final, con lo que tenga que probar o revisar:

- Los puntos de control 3 (Markdown y Claude), 4 (versiones), 5 (búsqueda), 6 (hojas) y el final.

## Tarea en curso: 10, el Markdown de ida y vuelta

- **Hecho**: `packages/editor/src/markdown/frontmatter.ts`, un YAML hecho a mano para los cinco tipos de propiedad.
  Las páginas se escriben como `"[[Título]]"`; al leer vuelven títulos, que resuelve el servidor (tarea 11/13).
- **Plan** (`@tiptap/markdown` 3.32.1, MIT, con marked):
  - Un tokenizador de bloque para `> [!tipo]`. Da recuadro, caja o secreto según el tipo:
    - en español: nota, consejo, aviso, peligro, leer, caja y secreto;
    - los de Obsidian en inglés se leen también: info → nota, warning → aviso…
  - Otro para `%%…%%`, que da la nota oculta.
  - **Ids**, solo de los bloques de primer nivel y solo si se piden:
    - en el párrafo y el título, ` ^id` al final de la última línea;
    - en los demás, `^id` en su propia línea, con líneas en blanco alrededor (como en Obsidian);
    - en el secreto, `^s-id`, como pide la spec.
  - Si no hay propiedades y el cuerpo empieza por `---` (un separador), se escribe un YAML vacío (`---\n---`), para
    que no se confunda con el YAML.
  - **Al leer** se devuelven el cuerpo y aparte el contenido de cada secreto y nota oculta, con su id de bloque.
  - **Prueba de ida y vuelta**: un documento con todos los nodos y marcas del esquema. Falla si el esquema tiene un
    nodo o una marca que el documento de prueba no lleva.

## Hechas en esta tirada

- **9** (PR por abrir al escribir esto): bloques, marcas, menú «/», barras, asa e ids. Decisiones apuntadas en
  `docs/modulos.md`. «Enlace a página» y proponer enlazar quedan para la 13.

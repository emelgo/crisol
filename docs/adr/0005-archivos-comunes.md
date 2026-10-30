# ADR-0005: Archivos comunes de la cuenta, junto a los de cada mundo

Estado: aceptada (Enrique, 2026-10-30) · Se construye en la ronda de pulido 1 de la interfaz

## Contexto

Los archivos son de un mundo: cada uno lleva su `world_id`, su nombre no se repite dentro del mundo y `![[nombre]]` lo
busca ahí. Al poner la portada de un mundo nuevo, Enrique no veía las imágenes que ya había subido en otro: «al añadir
una portada deberían aparecerme los archivos que he subido no? […] unos archivos comunes quizás?». Entre copiar
imágenes de un mundo a otro y una carpeta común, eligió la común: «archivos por mundo como ahora y luego una carpeta
común de la cuenta que se comparte entre todos los mundos».

## Decisión

- **Dos ámbitos**: los archivos de un mundo, como hasta ahora, y los **comunes** de la cuenta (su organización, que por
  el ADR-0004 va por debajo), que comparten todos sus mundos.
- **Datos**: `files.organization_id` siempre (también en los de un mundo) y `files.world_id` opcional; un común no tiene
  mundo. El nombre no se repite dentro de su ámbito: un índice para los de cada mundo y otro para los comunes de cada
  organización. Las claves del almacenamiento siguen siendo `<ámbito>/<uuid>`, con la organización como ámbito.
- **Dónde se ven**:
  - en **Mis mundos**, la barra tiene **«Archivos»**, con los comunes;
  - **dentro de un mundo**, «Archivos» tiene los del mundo y, aparte, la carpeta **«Comunes»**, la misma en todos;
  - en el cuadro de la portada, «Del mundo» y «Comunes».

  Lo que se sube va al ámbito en el que se está.
- **Se usan para todo**, como los de un mundo: portadas de mundos y de páginas, `![[nombre]]` y el visor de PDF. Si un
  mundo y los comunes tienen uno con el mismo nombre, **gana el del mundo**. Una portada puede ser un archivo de su
  mundo o uno común de su organización. La exportación de la wiki incluye los comunes que usa.
- **Permisos**: los comunes los ven quien administra la organización y los másteres de sus mundos; los suben, cambian y
  borran quien administra la organización. Los jugadores, como con los del mundo, cuando llegue la visibilidad (módulo
  5).
- **Historial y papelera**: lo que se hace con un común va al historial de la organización (sin mundo), y borrado, a
  su papelera, como «Comunes».
- **IA (MCP)**: `listar_archivos` devuelve los del mundo y los comunes, marcados, para enlazarlos con `![[…]]`.

## Alternativas descartadas

- **Copiar a este mundo las imágenes de otros**: rápido y sin tocar los datos, pero duplica archivos y espacio, y
  cambiar uno no cambia sus copias.
- **Solo archivos de la cuenta**, sin los de cada mundo: un mundo dejaría de ser una unidad que se exporta o se borra
  con todo lo suyo.

## Consecuencias

- Una migración: `organization_id` (rellenada desde el mundo), `world_id` opcional y los índices de nombre por ámbito.
- `![[nombre]]` busca primero en el mundo y luego en los comunes; un común nuevo puede resolver enlaces pendientes de
  cualquier mundo de la organización. Los usos de un común se cuentan en todos sus mundos.
- El aviso en tiempo real de archivos tiene también ámbito de organización.
- La cuota de espacio (módulo 11) cuenta los comunes una vez, en la organización.

# Plan: Módulo 4 — imagenes

Estado: en marcha (2026-11-06). Spec: `docs/specs/imagenes.md` · Mapa: `docs/specs/modulo-4.md` · Diseño: lienzo
«Crisol: compendio y criaturas» (tablero Foundry) · Tareas: `tasks/todo.md`. Los planes anteriores, en
`tasks/<capacidad>/`.

## Cómo

- **El contenido gana su imagen** (`img`, una ruta como la de Foundry: `systems/dnd5e/tokens/thumbs/dragon/x.webp`), en
  `system_content` y `world_content` (migración 0045), en el contrato y en el formato del archivo de un sistema.
- **Las imágenes de un sistema**, en una tabla (`system_images`: sistema, ruta, clave en el almacenamiento, tipo, tamaño,
  licencia y crédito), sus bytes en el almacenamiento de archivos. Se sirven a quien puede leer el sistema o juega en
  una campaña que lo usa.
- **Al importar de Foundry**, el convertidor pone a cada entrada su `img` (la del documento o, en los actores, el
  retrato del mapa de arte). El navegador lee del zip esas imágenes y sus avisos de licencia, enseña el resumen con la
  casilla de no traer las «solo para Foundry», y tras importar las sube en tandas.
- **En la web**: la imagen en la entrada del compendio, en su lista, en la hoja de la criatura y en «En juego»; sin
  imagen, el icono del tipo.

## Puntos de control

1. Tras la tarea 3: importar el dnd5e real por la API con sus imágenes y leer la del Goblin.
2. Tras la 5: verlo en la web (el aviso de licencias, el retrato en el compendio y en juego).

# Spec: el sonido de un zip de Foundry (módulo 7)

Capacidad `sonido-foundry` del módulo 7 (`docs/specs/modulo-7.md`). Se apoya en `sonido`, `sonido-mapa` y en la
importación de escenas de Foundry (`docs/specs/escenas-foundry.md`). Estudio: `research/foundry/sonido.md` § zip.

## Objetivo

Que al traer un zip de Foundry (un módulo, un mundo o una aventura) vengan también sus listas de sonido y los sonidos
de sus escenas, con sus archivos.

## Comportamiento

- **Listas**: las del mundo, las de un compendio de listas y las que van dentro de una aventura, con sus pistas
  (nombre, ruta, volumen, repetir, modo de la lista, fundido). Su clase: las de canal «música» o «ambiente» van a
  ambiente; las de «interfaz» o botonera, a efectos.
- **Archivos**: los que vienen dentro del zip se suben al mundo; las URLs se guardan como URL si son de YouTube o de
  audio directo; las rutas a sonidos de serie de Foundry (que no vienen en el zip) se dejan fuera y se listan en el
  informe de lo que no se pudo traer.
- **Sonidos de escena**: los de cada escena importada pasan a sonidos de escena (radio en casillas, suavizado, muros
  que frenan o amortiguan, oscuridad); la lista o pista que enlace la escena, si se trae, también.
- **Reimportar**: como las escenas, sin duplicar (por su id de origen).
- Se ofrece en el mismo sitio que la importación de escenas y aventuras de Foundry.

## Contratos (propuesta)

- `packages/systems/src/foundry`: la lectura de listas y sonidos (función pura, con pruebas sobre un zip de prueba
  propio, sin contenido de Foundry en el repo).
- El importador de escenas gana los sonidos; un paso nuevo para las listas.

## Pruebas

- Unitarias: la conversión de listas y de sonidos de escena; rutas de dentro, de fuera y URLs.
- Integración: importar un zip de prueba con una lista y una escena con sonidos; reimportar sin duplicar.

## Criterios de éxito

1. Una aventura de Foundry con música trae sus listas listas para lanzar desde la Mesa.
2. El informe dice qué sonidos no se pudieron traer y por qué.

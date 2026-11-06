# ADR-0015: Crisol viene vacío; los sistemas y sus compendios se crean, se importan y se cambian

Estado: aceptada (Enrique, 2026-11-06: «cuando tengamos el modulo 3 lo quiero limpio, sin sistema, sin compendio y con
las herramientas para que desde cero podamos crear/importar el sistema y el compendio y modificarlo»; y del 5e: «Quitarlo
de serie, guardarlo como archivo. Lo que hemos hecho era la prueba para ver si funciona lo que hemos montado y que la IA
sea capaz de replicarlo con el MCP. Nosotros damos la herramienta vacía»)

## Contexto

ADR-0011 trajo los sistemas como datos, con dos de serie: el 5e (con el SRD 5.1 y 5.2.1 como contenido, unos 3.200
documentos) y «En blanco». El 5e era la prueba de que el formato da para un juego entero: hoja, creador de personajes,
mecánica, compendio con sus ediciones. Esa prueba ya está hecha.

## Decisión

- **De serie, solo «En blanco»**: el punto de partida para crear uno desde cero. El catálogo del código no trae ningún
  juego ni contenido.
- **El 5e pasa a ser un ejemplo**: vive en `packages/systems/src/examples/` (fixture de las pruebas, y lo que se
  cruza con dnd5e) y su archivo se arma con `pnpm sistema-5e`, para subirlo en Sistemas como cualquier otro. La web no
  lo carga nunca (Biome lo impide).
- **Tres maneras de tener un sistema**, todas en la cuenta:
  1. Crearlo con la IA por el MCP: tipos, campos, tiradas, hoja, creador de personajes y compendio, y su contenido.
  2. Subir el archivo de uno (`.crisol-system.json`).
  3. Importarlo de Foundry: el zip de un sistema o de un módulo de contenido, con sus compendios.
- **Cambiarlo**: el sistema, con la IA (no hay editor de sistemas en la app); las entradas del compendio, con la IA o
  en la app.
- **Lo que ya usaba el 5e de serie** pasa a una copia en su cuenta con `pnpm crisol sistema-5e` (una por cuenta, solo en
  las que lo usan); se corre una vez en staging tras desplegar.

## Consecuencias

- La app arranca sin juegos: la primera campaña con reglas pide crear o importar un sistema.
- Las pruebas del servidor y las e2e importan el 5e de ejemplo antes de usarlo.
- `catalogContent` desaparece del servidor: un sistema de serie no trae contenido.

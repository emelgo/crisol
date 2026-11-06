# Tareas: Módulo 4 — criaturas

Plan: `tasks/plan.md` · Spec: `docs/specs/criaturas.md`. Cada tarea con sus pruebas antes (TDD) y su commit.

- [x] **1. El formato**: la hoja de cada tipo de actor (`types[t].sheet`, validada; `sheetOf` la usa y la del sistema
  queda para el personaje), `roll` en un campo recurso (sus PG tirados) y `damage` en el tipo (sus campos de
  resistencias, inmunidades y vulnerabilidades); `formato_sistemas` lo documenta. El 5e de ejemplo: la hoja de la
  criatura, al estilo de su statblock, y sus PG con `@dados_golpe`.
- [x] **2. El motor** (`@crisol/systems`, `creatures.ts`): `creatureView` (la entrada con lo de la partida, con la misma
  forma que la hoja de personaje), los PG al ponerla (medios o tirados), los números de las copias y el daño con
  multiplicador y resistencias.
- [x] **3. La tabla `campaign_creatures`** (migración 0044), su repo, el historial y su aviso en tiempo real (al
  máster).
- [x] **4. Las acciones**: poner en juego (cuántas o una fórmula, o única; PG medios o tirados), la lista y una con su
  hoja, lo de la partida (daño, curación, temporales, usos, recargas, otro máximo, tirar PG, descansar), tirar por
  ella, quitar una o todas las copias. Permisos y fugas. **Punto de control 1.**
- [x] **5. Aplicar una tirada**: el daño o la curación de una tirada del registro a varias criaturas en juego o
  personajes, con nada, mitad, entero o doble y sus resistencias (`applyRoll`).
- [x] **6. La web**: «Poner en juego» en una criatura del compendio; «En juego» en la barra de la campaña (el máster),
  con las copias juntas y las únicas aparte; la hoja de la criatura (los bloques de la hoja de personaje) con daño y
  curación; «Aplicar» en el registro de tiradas; el móvil. **Punto de control 2.**
- [x] **7. La IA**: poner en juego, ver, partida, tirar, quitar y aplicar; las instrucciones del MCP.
- [ ] **8. La wiki**: enlazar una criatura (`[[@Nombre]]`, con «@» o «[[» al escribir), su tarjeta al pasar y al
  tocar, y lo que la enlaza.
- [ ] **9. Cierre**: e2e `criaturas.spec.ts`, fugas, axe, `tasks/probar.md`, `docs/modulos.md`. **Punto de control 3.**

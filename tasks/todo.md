# Tareas: personajes

Plan: `tasks/plan.md`. Spec: `docs/specs/personajes.md`. Cada tarea, con TDD y en una porción que funciona; al acabar,
`pnpm lint`, las pruebas de lo tocado y un commit.

## Fase 1: la campaña en su vista, con su compendio

- [x] **1. Leer el contenido desde la campaña**: `searchCampaignContent` y `getCampaignContent` (permiso de leer la
  campaña; solo lo de sus fuentes). Pruebas de integración y de fugas (quien no está en la campaña no ve nada).
- [x] **2. La vista de la campaña**: rutas de inicio y compendio; la barra con Inicio (nombre de la campaña), Personajes,
  Compendio y Dados al entrar, con su animación; la llama vuelve a Mis mundos.
- [x] **3. El compendio**: tipos, buscador (sin tildes, en los dos idiomas), lista con «2024» / «2014 · Legado», la
  lectura de cada tipo (conjuro, criatura, clase con sus rasgos por nivel, objeto, regla…) y el panel con la edición,
  el nombre en inglés y la otra versión. En el móvil, lista y lectura una tras otra.

## Fase 2: el personaje

- [x] **4. El personaje en la base de datos**: tabla, versiones, permisos (dueño y máster), historial; acciones de
  crear, listar, leer, cambiar, borrar y cambiar el dueño; fugas.
- [x] **5. «Personajes» en la campaña**: tarjetas, «Personaje nuevo» (con quién lo juega, para el máster), su ventana,
  la vista previa al pasar.
- [x] **6. La ficha mínima**, calculada con `evaluate` desde sus elecciones.

## Fase 3: los pasos

- [x] **7. El formato de los pasos** (`creation`) y su validación (sus referencias; las fórmulas de `when`, al calcular).
- [x] **8. El motor de lo pendiente**: pasos + `grants` por nivel, opciones válidas y su motivo, requisitos.
- [ ] **9. Subir y bajar de nivel, multiclase y PG** (media o tirados en el servidor). Hechos subir, bajar y la multiclase con sus requisitos; **quedan los PG tirados** (por la media, ya).
- [x] **10. Los pasos del 5e** y lo que su contenido necesita; los personajes de referencia, por los pasos.

## Fase 4: el creador

- [x] **11. La cabecera y la barra de pasos** con sus (!); clase con sus niveles y rasgos; elegir en el panel.
- [x] **12. Especie, trasfondo, características (sus métodos), equipo y resumen.**
- [x] **13. Las versiones**: al terminar y al confirmar cada nivel; verlas y restaurar.

## Fase 5: tablas e IA

- [x] **14. Las tablas**: el dato, su validación, la tirada con su registro, sin reemplazo por campaña; la pestaña
  «Tabla»; las del SRD.
- [x] **15. Las herramientas MCP** de personajes y tablas, con sus aprobaciones; los pasos en `formato_sistemas`.
- [ ] **16. Cierre**: e2e (crear de nivel 1, subir a 5 con multiclase, restaurar, tirar en una tabla), axe, ritmo,
  revisión, PR y staging.

# Tareas: hoja

Spec: `docs/specs/hoja.md` (en marcha, sin entrevista: Enrique, «termina el módulo 3 de una vez»). Rama
`modulo-3/hoja`, desde `main` tras fusionar `personajes`.

- [x] **H1. Lo de la partida en el cálculo**: `play` (valores, usos gastados, lo que lleva con su estado) entra en el
  documento que monta el motor; daño y curación a un recurso; descansar (corto, largo).
- [x] **H2. Los bloques de la hoja** en el formato (`sheet`), validados; la hoja por defecto; la del 5e.
- [x] **H3. Tirar desde la hoja**: una tirada del sistema o una acción de lo que lleva, por el personaje, en el
  servidor y al registro (`rollForCharacter`).
- [x] **H4. La pantalla**: la ficha por bloques, el panel con el desglose de cada valor, los PG, los usos, el
  inventario (añadir del compendio, equipar) y el móvil.
- [x] **H5. La IA**: ver la hoja, tirar por el personaje, daño y curación, descansar.
- [x] **H6. Cierre**: e2e (Atletismo y un ataque desde la hoja, daño, descanso, un escudo que sube la CA), axe,
  revisión, PR y staging.

# Pulido del módulo 3

Revisión de su interfaz con las pautas (`web-design-guidelines`) y `docs/diseno.md`, 2026-11-05. Hecho en la rama
`modulo-3/pulido-hoja` (PR #104): tutoriales de cada vista, sin dobles clics, «Guardado» de verdad, avisos de las
tablas por i18n, la pantalla vacía de Personajes, cargas y errores. Queda, para pulirlo con Enrique en local:

- [ ] El creador: el foco se pierde al elegir, cambiar o quitar (llevarlo al título nuevo o al panel); abrir una
  decisión no lleva el foco al panel (en lo estrecho queda debajo); «Terminar» y «Confirmar el nivel» con `BusyButton`.
- [ ] El creador: quitar una clase (con sus decisiones) sin confirmar; se deshace desde el historial, pero ¿preguntar?
- [ ] El creador: lo concedido, al desplegarlo mientras carga o con error, no dice nada; un número inválido en un campo
  se ignora sin aviso; el de idiomas, sin ejemplo en el placeholder.
- [ ] Ficha | Creador, y la búsqueda, el tipo y lo abierto del compendio, en la URL (enlazar un conjuro; «atrás» en el
  móvil vuelve a la lista).
- [ ] El compendio en lo estrecho: al abrir un resultado y al volver, el foco.
- [ ] La tabla: el borrador se pierde al cambiar de pestaña de la página, sin avisar.
- [ ] Las tablas del texto del compendio, desplazables con el teclado en Safari (`tabIndex`, región con nombre).

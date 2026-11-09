# Tareas: la campaña alrededor de la Mesa

Plan: `tasks/plan.md`. Lienzo: `out/lienzo-campana/`.

## Fase 1: el armazón

- [x] 1. **La campaña abre en la Mesa (máster).** `/campanas/$c` pinta la Mesa para el máster (y, de momento, la portada
  de antes para la jugadora); `?panel=` elige la pestaña; `/mesa` redirige. `mesa.tsx` se parte sin cambiar lo que hace.
  - Acepta: el máster entra en la campaña y ve la Mesa; las pruebas de la Mesa siguen en verde; `/mesa` lleva a la campaña.
  - Comprueba: `pnpm --filter @crisol/web test`, `pnpm typecheck`, mirarlo en el servidor de desarrollo.
- [x] 2. **La barra derecha.** Pestañas Tiradas, Combate, Escenas, Personajes, Compendio, Páginas y Ajustes, con icono y
  nombre, `tablist` con flechas, la última recordada, plegable; dentro, de momento, lo que ya hay (paneles de escenas,
  encuentros, criaturas, personajes, combate). Las herramientas siguen tapando el panel cuando lo necesitan.
  - Acepta: cada pestaña abre su panel; al volver se abre la última; plegada, el mapa ocupa todo.
  - Comprueba: pruebas de la barra (teclado, recordar, plegar) y las de la Mesa.
- [x] 3. **La barra izquierda corta, Ajustes y las redirecciones.** (Hecho sin las redirecciones: cada vista vieja
  redirige cuando su pestaña la sustituye del todo, en las tareas 5, 6, 8 y 11.) La llama, la Mesa, el mundo y la cuenta (jugadora:
  la llama, su ficha, la Mesa). Pestaña Ajustes: la campaña, miembros (expulsar), Invitar (el enlace en línea), dejar la
  campaña o borrarla en la zona de peligro. `/en-juego`, `/compendio`, `/biblioteca`, `/paginas…`, `/grupo` redirigen.
  - Acepta: no queda ninguna vista suelta en la barra; invitar y expulsar funcionan desde Ajustes; los enlaces viejos
    llegan a su pestaña.
  - Comprueba: pruebas de Ajustes (las de `campaign.test.tsx` se mudan) y de las redirecciones.

### Punto de control 1
- [ ] Pruebas, tipos y Biome en verde; el máster lo encuentra todo en la Mesa; captura para la bitácora.

## Fase 2: las pestañas

- [x] 4. **Tiradas.** El registro de dados de la campaña en su pestaña; fuera de ella, cada tirada sale un momento sobre
  el d20 (las ocultas, en morado, «solo tú»).
  - Acepta: tirar con la pestaña cerrada enseña el aviso y lo quita solo; con ella abierta, no sale.
  - Comprueba: pruebas del registro y del aviso (con tiempo falso).
- [x] 5. **Escenas con «En esta escena».** Tarjetas de escenas con miniatura y «En la tele»; «Escena nueva»; debajo, lo
  que hay en la escena (personajes y criaturas, con PG, ocultar o mostrar, mandar al combate). Lo de En juego entra aquí.
  - Acepta: se abre y se presenta una escena; se oculta una criatura; se manda al combate.
  - Comprueba: pruebas del panel de escenas.
- [x] 6. **Compendio con Libros.** Buscar con categorías (Criaturas, Objetos, Conjuros, Reglas, Libros); arrastrar
  criaturas y objetos al mapa; pasar el ratón por una criatura enseña su ficha rápida; Libros abre el lector de PDF en
  ventana o en el panel.
  - Acepta: se suelta un goblin en el mapa desde el compendio; se busca en un libro.
  - Comprueba: pruebas del panel de compendio.

### Punto de control 2
- [ ] Pruebas en verde; recorrido del máster por las pestañas en el servidor de desarrollo.

## Fase 3: las ventanas

- [x] 7. **El gestor de ventanas.** Abrir varias, mover por la cabecera, estirar por la esquina (puntero y teclado),
  traer delante, minimizar abajo a la izquierda, cerrar, recordar dónde estaban; el zoom se esconde si hay minimizadas.
  - Acepta: dos ventanas se mueven y se apilan; minimizada vuelve a su sitio; con teclado se mueve y se cierra.
  - Comprueba: pruebas del gestor.
- [x] 8. **Páginas en ventanas.** (Del máster; las de la jugadora, con su Mesa en la tarea 12.) Pestaña Páginas: el árbol del mundo con buscador (el máster, todo, con un ojo en las
  conocidas; la jugadora, solo las suyas); una página se abre en ventana (el máster puede escribir; la jugadora, leer);
  los enlaces de dentro abren otra ventana.
  - Acepta: abrir Aldric Varn y Puerto Gris a la vez sin dejar la Mesa; el ojo dice quién la conoce.
  - Comprueba: pruebas de la pestaña y de la ventana de página.
- [x] 9. **Enseñar a los jugadores y fichas en ventana.** Acción `showPage` (y su herramienta MCP): revela si hace falta y
  se la abre en ventana a los miembros conectados; la ventana dice «Enseñando» y quién la ve. Las fichas de personajes y
  criaturas, también en ventana.
  - Acepta: el máster enseña una página y a la jugadora se le abre; la hoja de una ficha del mapa abre en ventana.
  - Comprueba: pruebas de la acción (integración), del aviso en la web y de la ventana de ficha.

### Punto de control 3
- [ ] Pruebas en verde (web y servidor); recorrido con dos navegadores (máster y jugadora).

## Fase 4: la jugadora

- [x] 10. **Abre en su ficha.** (La escena en marcha bajo «Ir a la Mesa», pendiente: la ficha no escucha la mesa.) La jugadora entra en la campaña y ve la ficha de su personaje (si tiene varios, el
  último; si ninguno, crear uno), con «Ir a la Mesa» y en qué escena está la partida.
  - Acepta: la jugadora entra y ve su ficha; en móvil, también.
  - Comprueba: pruebas de la ruta de la jugadora.
- [ ] 11. **«Del grupo» en el Equipo.** Debajo de lo suyo, el inventario del grupo con sus monedas y «Lo puso»
  (`addedBy`, migración); arrastrar entre «Lo mío» y «Del grupo» en PC; en móvil, «⋯» con «Pasar al grupo» y «Me lo
  quedo», y «Lo mío» plegado.
  - Acepta: pasar una poción al grupo y recuperarla, en PC y en móvil.
  - Comprueba: pruebas de la sección, de la migración y de las acciones del grupo.
- [x] 12. **La Mesa de la jugadora.** Espectador `player` en el canal de la mesa (solo miembros; la proyección del grupo,
  sin nada en vivo); su Mesa con Tiradas, Combate, Personajes, Compendio y Páginas.
  - Acepta: la jugadora va a la Mesa y ve lo que el grupo; no ve Escenas ni Ajustes; un ajeno no entra.
  - Comprueba: pruebas de integración de la sala y de la vista.

### Punto de control 4
- [ ] Pruebas en verde; recorrido completo de la jugadora (PC y móvil).

## Fase 5: cierre

- [ ] 13. **Cierre.** Recorridos (tours) nuevos; e2e actualizados (también los pendientes: invitar, unirse, sistemas, y
  la tarea 9 del módulo 6); accesibilidad y fugas; ADR-0019, `docs/diseno.md`, specs afectadas, `docs/modulos.md`,
  `tasks/probar.md`; revisión (`/agent-skills:review` y `web-design-guidelines`); PR a `main` con la CI una vez.

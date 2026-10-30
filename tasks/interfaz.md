# Etapa de interfaz: la mezcla del Crisol antiguo y del nuevo

Plan y tareas de la etapa de interfaz (2026-10-30). El diseño aprobado «como primera aproximación» está en el lienzo
«Crisol: interfaz» (https://claude.ai/artifact/QLHQADLdZSnTn5uzTubqf7; fuentes en `out/lienzo-interfaz/`, fuera de
git). Lo que dijo Enrique, en `docs/modulos.md` § «Para el repaso final de la interfaz». Va antes de los arreglos de sus
pruebas («Lo que dijo Enrique al probar») y de cerrar el módulo 1; `tasks/plan.md` y `tasks/todo.md` siguen siendo los
del módulo 1.

## Qué cambia

- **Del antiguo**: grises neutros; barra de iconos a la izquierda, con su nombre debajo; panel lateral; pestañas finas;
  acciones con icono sobre la página y el resto en «⋯»; panel derecho (índice, enlaces, versiones); barra de estado;
  cada nivel de título con su color; el rojo solo en lo importante.
- **Del nuevo**: Barlow para el texto, Barlow Condensed para los títulos, y las esquinas cortadas de los recuadros.
- **Fuera**: la barra oscura de arriba, los botones en mayúsculas, las filas de botones sobre el texto y los textos de
  ayuda fijos.
- **«IA», no «Claude»**, en toda la interfaz.

## Decisiones

- Los iconos, de `lucide-react` (ISC). El lienzo los dibuja a mano; en la app, una librería con licencia permisiva.
- El tema sigue al sistema, con el botón para cambiarlo, como ahora.
- Cada porción se despliega en staging y se puede probar sola. Las e2e y @a11y se ajustan en la misma porción que
  cambia lo que miran.

## Tareas

- [x] **1. Colores, letra y botones.** Tokens nuevos (grises del antiguo, títulos con color por nivel, rojo solo en
  lo importante) y botones, pestañas y rótulos en minúscula normal; los títulos siguen en Barlow Condensed. Los
  contrastes, en `tokens.test.ts`.
  - Archivos: `apps/web/src/styles/{tokens,base}.css`, `components/*.module.css`, `theme.test.ts`.
- [x] **2. El armazón.** Fuera la barra de arriba. Entran la barra de iconos de la izquierda (Mundos; dentro de un
  mundo, Páginas, Buscar, Marcadores, Etiquetas y Archivos; abajo Historial, Papelera, IA, Ajustes y la cuenta), el
  panel lateral con lo que elijas en ella y la barra de estado.
  - Archivos: `routes/root.tsx`, `wiki/wiki.tsx`, `wiki/navigation.tsx` y sus CSS.
- [x] **3. La página.** La cabecera pasa a ser la ruta más iconos: marcar, hoja, buscar en la página y «⋯», con
  renombrar, mover, icono y portada, en lectura, exportar y borrar. Las propiedades, en una lista compacta. El panel
  derecho lleva índice, enlaces y versiones, que hoy van debajo de la página. Las subpáginas, en su recuadro.
  - Archivos: `wiki/wiki.tsx`, `properties.tsx`, `backlinks.tsx`, `versions.tsx`.
- [x] **4. El editor y las pestañas.** La barra de encima del texto (secreto, nota oculta, bloque y buscar en la
  página) pasa a una línea fina, sin cajas y con iconos. No se quita: es el camino con el teclado, y para quien no
  conoce el menú «/». Las pestañas, en una tira fina de lado a lado; «Añadir propiedades», discreto.
- [x] **5. La IA.** La interfaz dice «IA», no «Claude»: aprobaciones, historial, versiones, conectar y avisos. En la
  barra, el número de peticiones que esperan tu aprobación sobre el icono de la IA. **Queda para pulir**: llevar la
  cola de peticiones a un panel de la IA, en vez de encima de cada página, y marcar en la página lo que la IA quiere
  añadir o quitar antes de aprobarlo.
- [x] **6. Historial y papelera.** Cuando no se puede deshacer porque alguien escribió después, un recuadro bien
  visible dice por qué y, si fue en una página, lleva a ella y a sus versiones. El historial guarda el id de la
  página en cada `editPage`. Los botones secundarios de toda la app pesan menos con ratón y con el dedo siguen del
  tamaño que se toca. Va con el punto 7 de sus pruebas, que sigue abierto hasta reproducirlo con él.
- [x] **7. Mis mundos.**
  - **Tarjeta**: arriba, la portada (imagen o color) con el icono en un recuadro de esquinas cortadas; debajo, el nombre
    con letra de título, la descripción y las acciones.
  - **«Ajustes»** abre un cuadro con la descripción, el icono (siete), el color (seis) y la portada, que usa el mismo
    selector que la de las páginas.
  - **Servidor**: la migración 0023, `updateWorld` (se deshace con el historial) y la herramienta MCP `cambiar_mundo`.
  - **Renombrar y Borrar** siguen como estaban.
- [x] **8. Buscar y Ctrl+K.** Los resultados, en bloques que se marcan al pasar; la sección en el color de los títulos
  y lo de un secreto en su morado. El selector Ctrl+K con bordes suaves y la opción elegida con la raya roja. Los
  filtros siguen en la pantalla de resultados.
- [x] **9. La hoja.** Puntos 11 y 12 de sus pruebas:
  - la nota lateral va en la misma caja que el bloque que la sigue (se mide y se pagina con él), así que flota a su
    lado y el texto la rodea;
  - el papel se encoge al ancho que tiene, al lado del editor o en una pantalla estrecha, y se sigue midiendo a tamaño
    real. Al imprimir, tal cual.

  Lo que Enrique ve mal de la hoja, por concretar con él en la revisión.
- [x] **10. Móvil y entrar.** Entrar, en una caja en el centro con su título. El móvil ya lo traía la parte 2 (la
  barra abajo y el panel en un cajón). Queda para pulir: menos botones en la barra de abajo.

## Ronda de pulido 1, pantalla a pantalla, en local (2026-10-30)

Enrique lo revisa en vivo en el servidor de desarrollo, en http://localhost:5173 (`pnpm dev`, con la API en 8130).
«No pases los test hasta terminar, solo haz cambios en localhost y los veo en tiempo real y luego pasamos todo».
Todo va en la rama `interfaz/pulir-inicio`, en un commit local sin subir. Las normas que va dictando, en
`docs/diseno.md`.

**Hecho:**
- **Con sesión, la portada lleva directa a Mis mundos**, y el rombo de la barra también.
- **Entrar con sesión lleva a Mis mundos**. Antes, si la sesión no llegaba (el servidor reiniciándose), la app
  mandaba a Entrar y se quedaba ahí aunque luego la sesión volviera.
- **Crear la cuenta** (arranque y unirse):
  - centrada;
  - nombre y apellido(s) en dos recuadros;
  - nombre de usuario único, que es el apodo visible;
  - contraseña con medidor de seguridad y repetida.

  En el servidor: las columnas `first_name` y `last_name` (migración 0024), Better Auth con `additionalFields`,
  `usersRepo.isNameTaken` y el error `USERNAME_TAKEN` en el arranque, al unirse y al cambiar el perfil.
- **Errores de formulario propios** en `Field`, sin el globo del navegador, con el foco al primero que falla.
- **Mis mundos**:
  - con la colocación de Ajustes;
  - sin la frase larga;
  - «Nuevo mundo» y «Crear tu primer mundo» abren un cuadro (`CreateDialog`), en vez del formulario suelto.
- **Tutorial guiado de cada vista** (`components/tour.tsx`), el de Mis mundos:
  - crear un mundo, con «Mundos» resaltado y su nota en el mismo paso;
  - Historial;
  - Papelera, con los días de `TRASH_DAYS`;
  - tu menú.

  Sale solo la primera vez, hasta acabarlo; con Atrás desde el segundo paso, sin Saltar ni «Lo tengo claro». Un «?»
  casi transparente abajo a la derecha lo vuelve a sacar. Lo hecho se guarda en el navegador, por cuenta. Pruebas ya
  hechas en `components/tour.test.tsx`.
- **La marca, la llama** del Crisol antiguo (`components/brand.tsx`): en la barra, la cabecera y la pestaña
  (`public/favicon.svg`), y latiendo mientras algo carga (`Loading`), en vez de la pantalla en blanco.
- **Tarjeta del mundo**: portada que se acerca al pasar el ratón, con Ver (Cambiar, solo en su ventana;
  `routes/world-cover.tsx`, con encuadre y acercamiento: `zoom` opcional en `pageCover` y `worldCover`, sin migración, jsonb; pruebas en `contracts/actions.test.ts`);
  toda la tarjeta lleva al mundo; Guardar y Cancelar solo con cambios; al pie, el papel y el engranaje. El engranaje abre la ventana del mundo
  (portada arriba, nombre, descripción, icono, color y zona de peligro, `components/danger.tsx`); sin Renombrar ni
  Borrar sueltos. Cuadros con X y cierre al pulsar fuera (`components/modal.tsx`). Pruebas en `worlds.test.tsx`.
- **Crear un mundo** abre la misma ventana que sus ajustes (`WorldDialog`): portada (se sube al crearlo), nombre,
  descripción y color (ninguno, fijo o propio, que se recuerda en el navegador, `routes/world-look.ts`; tiñe el
  contorno). «Nuevo mundo» es un recuadro discontinuo con la forma de una tarjeta, tras el último. Sin iconos en los
  mundos. En el contrato, `worldColor` admite `#rrggbb` (columna de texto: sin migración).
- **Por decidir al cerrar la ronda**: el icono del mundo ya no sale en la interfaz, pero sigue en el contrato
  (`updateWorld`, MCP) y en la columna `icon`. Quitarlo de ahí o dejarlo.
- **Los mundos, en el orden en que se crearon** (uno nuevo, al final): `worldsRepo.listMemberWorlds` y su prueba.
- **Animaciones**: la tarjeta de un mundo nuevo entra y la de uno borrado se va (con menos movimiento, solo fundidos); los cuadros (`dialog[open]` en
  `base.css`) y el menú de la cuenta se abren con un pequeño crecimiento.
  En Ajustes, «Animaciones» (completas por defecto, reducidas o como el sistema; `src/motion.ts`, `data-motion`).
  Los cuadros también se cierran animados (transiciones con `@starting-style`; `afterExit` en `modal.tsx` espera
  a que acaben). Al crear, la lista se pone al día cuando el cuadro ya se ha ido, y la tarjeta entra con el contorno
  iluminado. Historial y Papelera se piden al pasar el ratón por su botón (`api/queries.ts`).
- **Barras de desplazamiento** finas, del color de los bordes; en las ventanas solo se desplaza el contenido.
- **Barra lateral**:
  - sin barra de estado abajo;
  - el tema y la IA salen de ella;
  - Historial y Papelera abren una ventana encima (`components/window.tsx`), igual que Perfil y Ajustes desde el menú
    de la cuenta.
  - en las ventanas de Historial y Papelera, sin el enlace «Mis mundos» de arriba.
- **Menú de la cuenta**: quién eres, Perfil, Ajustes y Cerrar sesión. Es fijo en la pantalla y no se corta.
- **Ajustes** (`/ajustes`):
  - Apariencia, con el tema;
  - IA, solo el conector y el modo.
- **Perfil**, centrado como Ajustes: tus datos (usuario, nombre, apellidos; el email aún no se cambia) y cambiar la contraseña.
- **Las peticiones de la IA**, en tarjetas flotantes abajo a la derecha, como en el Crisol antiguo.
- **ADR-0004**: cuentas personales y registro público, con la organización por debajo.

**Al acabar la ronda** (cuando Enrique lo diga):
1. Poner al día las pruebas que han cambiado:
   - la portada redirige;
   - las etiquetas de la cuenta: Nombre, Apellido(s), Nombre de usuario y Repite la contraseña;
   - crear un mundo es un cuadro;
   - Historial y Papelera son botones que abren ventana;
   - borrar un mundo va por el engranaje y su zona de peligro (`trash.test.tsx`);
   - Entrar con sesión redirige; Historial y Papelera de la cuenta, sin enlace de vuelta;
   - Perfil y Ajustes, en el menú;
   - el tema ya no está en la barra;
   - mientras carga sale la llama (`Loading`), no la pantalla en blanco;
   - las tarjetas de la IA;
   - el bootstrap y la unión, con `firstName` y `lastName`;
   - `USERNAME_TAKEN`;
   - el contrato de `Account`;
   - las pruebas nuevas de la ventana y el perfil (las de los recorridos ya están).
2. `pnpm test` entero y `pnpm e2e`.
3. PR, CI y staging; la migración 0024 se aplica al desplegar.
4. En `.env` de desarrollo, `PUBLIC_URL` pasó a `http://localhost:5173`: Enrique entra por `localhost` y el servidor
   rechazaba las peticiones de `127.0.0.1` con `BAD_ORIGIN`. Solo afecta al desarrollo.

### Punto de control: tras las tareas 1 y 2
- [ ] e2e, @fugas y @a11y en verde; desplegado en staging.
- [ ] Enrique lo ve en staging antes de seguir con la 3.

### Punto de control: tras la 6
- [ ] Lo mismo, y Enrique repasa la página, el editor y la IA.

### Punto de control: final
- [ ] Todas en staging; Enrique da la etapa por buena «para pulir luego».

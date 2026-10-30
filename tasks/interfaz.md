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

### Punto de control: tras las tareas 1 y 2
- [ ] e2e, @fugas y @a11y en verde; desplegado en staging.
- [ ] Enrique lo ve en staging antes de seguir con la 3.

### Punto de control: tras la 6
- [ ] Lo mismo, y Enrique repasa la página, el editor y la IA.

### Punto de control: final
- [ ] Todas en staging; Enrique da la etapa por buena «para pulir luego».

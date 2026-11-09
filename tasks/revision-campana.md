# Revisión de «la campaña alrededor de la Mesa» (2026-11-09; los 8 importantes, arreglados el 2026-11-10)

Revisión independiente de 760c040..HEAD. Seguridad y permisos, bien. Por arreglar (importante, por orden):

1. Abrir o cerrar la primera página remonta todas las ventanas (`PageWindowsSocket` cambia el árbol): árbol fijo, `CollabSocket` con `enabled`.
2. Con una herramienta abierta, la barra se desmonta y no salen las tiradas sobre el d20 ni se abre el combate nuevo: `RollToasts` y el efecto del combate, a `Mesa`.
3. Los atajos de la Mesa (Supr, Escape, letras) saltan dentro de las ventanas y de la barra: excluir `[role="dialog"]`, `[data-window]`, `[data-mesa-side]`.
4. Traer una ventana delante reordena el DOM (pierde el foco y quizá la captura del puntero): orden del DOM fijo con un `z` aparte; `onLostPointerCapture`.
5. Ventanas: foco al abrir, devolverlo al cerrar o minimizar, Escape la cierra.
6. Arrastrar del grupo a «Lo mío»: el error no se ve, lo escrito a mano no debería arrastrarse y se lleva el montón entero (pedir cantidad o 1).
7. «Lo que sabe el grupo» (Revelado) se quedó sin sitio: el ojo en la pestaña Páginas y las novedades de quien juega; borrar `_RevealedButton` y `_NewsLabel`.
8. `ToMesaIfMaster` pierde la página de `/paginas/$p` (llevar `?pagina=` y abrir su ventana) y pinta la vista vieja mientras carga.

Menores (arreglados: temporizador repetido, «solo tú», `aria-pressed`, `useId`, `aria-roledescription`, punto del combate; el resto, pendiente): el ojo de «En esta escena» con criaturas ocultas por el módulo 5; «la ven N» cuenta a quien la conoce; doble aviso al revelar y enseñar; `?panel=` al empezar un combate; reabrir la misma entrada del compendio; temporizador repetido en las tiradas y «solo tú» en las de visibilidad máster; `useParty` en hojas de criaturas; soltar en la propia lista; `useId` en «En esta escena»; el punto del combate sin texto; `aria-pressed` en Ficha/Creador; `aria-roledescription` en el título de la ventana; `addedBy` por nombre; cerrar la Mesa de una jugadora expulsada; `systemId` nulo en `SheetOpener`; `/grupo` sin redirigir.

Además, lo que pidió Enrique para mañana: el Compendio como en Foundry (solo consulta, siempre por carpetas, sin «Todo») y lo añadido a la campaña en otra pestaña.

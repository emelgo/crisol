# Lo que tiene que probar Enrique

Lista viva: todo lo que haya que probar se apunta aquí y se marca cuando lo pruebe. Lo que diga va a «Lo que dijo» (al
final) y de ahí a su arreglo, o a `docs/diseno.md` si es una norma de la interfaz.

- **Staging**: https://neo.crisol.144-91-122-245.sslip.io (con el módulo 2 desde el 2026-11-04).
- **La IA**: el conector «Neo Crisol» de claude.ai (`https://neo.crisol.144-91-122-245.sslip.io/mcp`), con la cuenta
  de propietario.
- **En local**, con los cambios al momento: http://localhost:5173 (lo arranco cuando haga falta).

## Módulo 2: tipos de página y plantillas

Los criterios de éxito de `docs/specs/plantillas.md`, en el orden en que se usan.

### Campos

- [ ] En una página cualquiera, desde el panel: un campo de opciones, un enlace a una sola página y un reloj.
- [ ] Mandar a la papelera una página enlazada desde un campo: el campo la enseña tachada.

### Crear desde plantilla

- [ ] «Página nueva» → «Desde plantilla» → PNJ: sale con sus campos en el panel y sus apartados en el texto. La marca
  junto al título lleva a su plantilla.
- [ ] Desde un enlace `[[…]]` a una página que aún no existe: crearla eligiendo plantilla.
- [ ] **Criterio 1**: ponerle Facción al PNJ, abrir la facción y verlo en «Miembros». Lo mismo con Lugar →
  «Habitantes», y con un Objeto cuyo Portador es el PNJ → «Lleva encima».
- [ ] «⋯» → «Aplicar plantilla…» en una página ya hecha: añade lo que falta sin borrar nada.

### Plantillas propias (Mis mundos → Plantillas)

- [ ] **Criterio 2**, en este orden (Frentes apunta a Frente, así que Frente va primero):
  1. «Frente» desde cero, con Nivel, Estado, un reloj de 8 y Regiones (→ Lugar);
  2. copiar PNJ como «PNJ de Eana» y añadirle Frentes (→ Frente);
  3. en Frente, la tabla «PNJ del frente» (PNJ de Eana · Frentes);
  4. crear un frente y dos PNJ de Eana con él: salen en su tabla.
- [ ] Escribir el texto de una plantilla (sus apartados) y crear una página con ella.
- [ ] **Criterio 3**: quitar un campo de «Frente»; los frentes ya hechos no cambian.
- [ ] Borrar una plantilla propia: sus páginas dicen «(borrada)» junto al título y sus tablas siguen.
- [ ] Las de serie no se cambian: candado y «Copiar».

### Deshacer

- [ ] **Criterio 5**: desde el historial, deshacer crear una página desde plantilla y crear una plantilla.

### La IA, desde claude.ai

- [ ] **Criterio 4**: que cree en pocas llamadas 20 páginas desde plantilla (lugares, facciones y PNJ) enlazadas entre
  sí; después, que lea una facción con `leer_pagina` y reciba sus miembros.
- [ ] Que busque «PNJ cuyo Lugar es …» y que haga una plantilla propia.

### Teclado y móvil

- [ ] **Criterio 7**: elegir plantilla, rellenar campos y configurar una tabla solo con el teclado.
- [ ] Lo mismo en el móvil.

### Ya comprobado (no hace falta probarlo)

- **Criterio 6**: el 95 % de las tablas, en 43 ms con 5.000 páginas (el límite es 150 ms).
- **Criterio 7**, la parte automática: la CI en verde y sin supresiones nuevas; axe sin fallos críticos ni graves.

## Módulo 1: wiki (pendiente desde el 2026-10-30)

- [ ] **Deshacer con versiones** (punto 7 de sus pruebas): reproducirlo juntos. Escribir, que la IA cambie algo y
  deshacerlo desde el historial; si alguien escribió después, se niega y dice por qué.
- [ ] **Punto 6**: el PDF de una hoja de dos columnas con statblock, nota lateral y tabla (ningún bloque partido y nada
  de la interfaz en el papel), e «Imprimir» en Chrome, Firefox y Safari.
- [ ] **Final**: los criterios de éxito de `docs/specs/wiki.md` que aún no ha probado:
  - páginas con subpáginas, todos los bloques, propiedades, etiquetas, enlaces, secretos y archivos (1);
  - la IA crea 20 páginas enlazadas y cambia una sección de una página abierta, que se ve sin recargar (3);
  - restaurar una versión anterior (4);
  - exportar el mundo a .zip (6);
  - buscar «dragon» y «dargón» encuentra «Dragón» (7);
  - el árbol, la vista previa y el editor con el teclado, y una página mediana abierta en menos de 1 s (8).

## Por arreglar antes de probarlo

Lo hago yo; cuando esté, pasa arriba. Son los puntos de «Lo que dijo Enrique al probar» (`docs/modulos.md`) que siguen
abiertos:

- el id de un secreto cambia al reemplazarlo por bloque (1);
- la fecha de la página no cambia al escribir en el texto (2);
- la búsqueda no dice en qué título está un secreto (3);
- una nota oculta de una línea vuelve en tres (4);
- un párrafo vacío al abrir una página (6, va con el 7);
- buscar en la página no mira dentro de los secretos ni de los enlaces (8).

Y uno del módulo 2 que se quedó fuera del plan: el aviso al borrar una página no cuenta los campos que la apuntan (lo
pide la spec).

## Lo que dijo

(Aquí, lo que diga al probar, con la fecha.)

# ADR-0026: Las capas de los mapas y lo que dibuja la IA

Estado: aceptada (Enrique, 2026-11-13: aprobó el lienzo «Mapas con capas» con sus diez decisiones: «está genial»); se
construye en el módulo 9 (`docs/specs/mapas-capas.md`). Amplía el ADR-0007 (pestañas y mapas) y el ADR-0017 (lo que
sabe cada campaña).

## Contexto

El mapa de una página tenía imagen, escala y pines. Para que sirva de verdad (Eana, una región) hacen falta regiones,
rutas y textos, ordenados en capas, que el máster pueda esconder; medir con días de viaje; y, como dibujar a mano
cuesta, que la IA los trace. La tabla `map_elements` existía sin usar desde el ADR-0007.

## Decisión

1. **Capas en una tabla propia, `map_layers`** (con historial), en orden por clave fraccionaria; cada elemento lleva su
   capa y su puesto. Sin capa (lo de antes), cuenta como de la primera. Los pines siguen encima de todo y sin capa.
2. **Visibilidad en dos niveles**: una capa «solo del máster» (`hidden`) no llega a ningún jugador ni a su IA, aunque
   se haya revelado algo de ella (vale para todas las campañas); dentro de una capa a la vista, cada elemento sigue a
   su página como un pin (`hidden` y las marcas `element` del conocimiento, ADR-0017). Lo filtra el servidor. Un
   elemento que lleva a una página que la campaña no conoce sale sin nombre ni enlace.
3. **Apagar una capa en mi pantalla** es de la vista: se guarda en el aparato (`localStorage`), no en el servidor.
4. **La geometría, JSON propio en 0–1** (como los pines): una región, piezas (islas; sin huecos de momento); una ruta,
   puntos y, si los tiene, los pines donde empieza y acaba; un texto, su sitio, su giro y su arco. Los estilos, en
   listas cerradas validadas con zod (sin pinceles ni curvas a mano).
5. **La IA dibuja en píxeles de la imagen que ve**: `imagen_mapa` le enseña la imagen del mapa con sus medidas (o el
   SVG); `dibujar_en_mapa` y `cambiar_dibujo` aceptan esos píxeles (`view`) y el servidor los pasa a 0–1, simplifica el
   trazo (Douglas–Peucker, con tope de puntos) y, con `snap`, pega los vértices a los de lo cercano (fronteras sin
   huecos) y los extremos de una ruta a los pines. El estudio vio que la IA acierta más así que con coordenadas sueltas.
6. **Sin librería de imágenes en el servidor** de momento: la imagen va tal cual (si es de un tipo que la IA admite y
   cabe); sin rejilla ni recorte. `sharp` queda descartado por traer libvips (LGPL).
7. **Medir** lo hace cada uno en su vista (no se guarda): la escala del mapa (una raya calibrada) y lo que se anda en un
   día en cada mapa (a pie, a caballo, en barco; con valores de serie). `medir_mapa` hace lo mismo para la IA, sobre lo
   que ve quien pregunta.

## Consecuencias

- Las fronteras vecinas se pegan por vértices cercanos, no comparten borde: mover una no mueve la otra.
- Copiar una página copia sus capas y lo dibujado, con las rutas a los pines de la copia.
- Si algún día hace falta enseñar a la IA la rejilla o recortes nítidos de un mapa enorme, habrá que elegir una
  librería de imágenes sin copyleft (p. ej. una de Skia con licencia BSD o MIT).

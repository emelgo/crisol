# Módulo 4: compendio, criaturas y biblioteca

Mapa de capacidades (2026-11-06), de la entrevista con Enrique (`docs/modulos.md` § «### 4. Compendio, criaturas y
biblioteca»). Cada capacidad tiene su spec en `docs/specs/<id>.md` y su ciclo (diseño, plan, construcción y revisión),
en este orden. Los estudios: `research/foundry/criaturas-y-capas.md` y `research/dndbeyond/criaturas-y-grupo.md`; los
de antes que sirven, `research/foundry/compendio.md` y `research/foundry/avances-y-tablas.md` (las tablas).

| Id | Qué hace | Depende de |
|---|---|---|
| `compendio-mundo` | El compendio de cada mundo: contenido hecho para un sistema, que ven las campañas del mundo que lo usan; copiar una entrada entre capas (del sistema al mundo y del mundo a la cuenta) guardando de dónde sale; crear, cambiar y borrar en la app; la IA | — |
| `criaturas` | La hoja de una criatura (su statblock, que se tira); ponerla en juego desde la campaña: copias numeradas o una única, con PG fijos o tirados; su estado en partida (PG, usos, recargas, estados, descansos); «En juego» del máster; enlazarla desde la wiki; la IA | `compendio-mundo` |
| `imagenes` | Los retratos y los iconos: traer de un zip de Foundry, en segundo plano, las imágenes de sus documentos; poner imagen a una entrada propia; verlas en el compendio, la hoja y lo que está en juego | `compendio-mundo` |
| `tablas-compendio` | Las tablas aleatorias como entradas del compendio (de un sistema o de un mundo): las de Foundry al importarlo y las propias; se tiran en la campaña con su estado, y sus resultados enlazan a otras entradas | `compendio-mundo` |
| `grupo` | El inventario del grupo de la campaña: objetos del compendio o escritos a mano, monedas, pasar cosas a un personaje y de vuelta; lo ven y lo cambian el máster y los jugadores | `hoja` (módulo 3) |
| `biblioteca` | Los PDF del mundo y los comunes de la cuenta: su texto por página al subirlos, buscar dentro (el resultado abre el visor en esa página) y la búsqueda por significado de la wiki, el compendio y los PDF (pgvector y un modelo propio) | — |

Orden: `compendio-mundo` → `criaturas` → `imagenes` → `tablas-compendio` → `grupo` → `biblioteca`. Lo que más se usa
en partida va primero; `biblioteca` no depende de nada y puede adelantarse si hace falta.

## Lo que se da por hecho (propuesta de Claude, por confirmar al verla)

1. **Las capas, en la práctica**: Crisol viene vacío (ADR-0015), así que el sistema de una campaña es siempre uno de la
   cuenta, y «la capa de la cuenta» es el contenido de ese sistema. Lo nuevo es la capa del mundo. Copiar «a la
   cuenta» es copiar al sistema.
2. **Quién ve qué, hasta el módulo 5**: el compendio del mundo y lo que está en juego, solo el máster (y quien puede
   cambiar el mundo). Los jugadores siguen viendo el compendio del sistema, como hoy.
3. **Las criaturas en juego son de la campaña**, como los personajes: un PNJ único que sale en dos campañas del mismo
   mundo lleva su estado en cada una (las campañas pueden tener sistemas distintos).
4. **Un PNJ de la wiki enlaza a su criatura** con un enlace al compendio, y la criatura dice desde qué páginas se la
   enlaza. La página no copia el statblock.
5. **Las tablas de la wiki se quedan** (la pestaña «Tabla» de una página, del módulo 3) y comparten el motor con las
   del compendio.
6. **La búsqueda por significado, en el VPS** (medido el 2026-11-06, abajo): un proceso aparte dentro de la app, que se
   carga al usarlo y se descarga sin uso; la app pasa de 512 MB a 1 GB de límite.

## La medida del modelo de embeddings (2026-11-06)

`intfloat/multilingual-e5-small` (MIT; 384 dimensiones; español e inglés), cuantizado a int8 (113 MB), en este VPS
(6 núcleos Broadwell, 11 GiB):

| Montaje | Memoria al cargar | Pico | Por trozo de ~320 tokens (2 hilos) |
|---|---|---|---|
| `@huggingface/transformers` (Apache-2.0) | 515 MB | 604 MB | 300 ms |
| `tokenizers` nativo (Apache-2.0) + `onnxruntime-node` (MIT) | 481 MB | 520 MB | 256 ms |
| **SentencePiece en wasm** (`@sctg/sentencepiece-js`, Apache-2.0) **+ `onnxruntime-node`** | **270 MB** | **290 MB** | **240 ms** |

- El tokenizador de los otros dos montajes se come unos 300 MB (el vocabulario de 250.000 piezas). El de SentencePiece da
  los mismos números de token que el de referencia en las pruebas (texto en español, signos y emojis).
- Un libro de 300 páginas son unos mil trozos: unos 4 minutos en segundo plano. Una búsqueda, un trozo: un cuarto de
  segundo, más unos 2 segundos si el modelo estaba descargado.
- En la imagen de Docker solo hace falta la librería de Linux x64 sin CUDA de `onnxruntime-node` (unos 25 MB; el
  paquete entero ocupa 536 MB).

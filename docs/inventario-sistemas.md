# Cómo es un sistema de reglas en el Crisol actual

Leído el 2026-11-04 en `~/CrisolVTT/crisol` (desarrollo), solo de consulta, para la spec de `sistemas` (módulo 3) y las
que vienen detrás (`personajes`, `hoja`). Amplía el apartado 5 de `docs/inventario.md`. Las rutas son de ese repo.

**Rutas abreviadas.** Todas cuelgan de `/home/admin/CrisolVTT/crisol`:
- `sistema.ts` = `/home/admin/CrisolVTT/crisol/packages/systems/src/esquema/sistema.ts`
- `formula.ts` = `/home/admin/CrisolVTT/crisol/packages/systems/src/formulas/formula.ts`
- `parser.ts` = `/home/admin/CrisolVTT/crisol/packages/core/src/query/parser.ts`
- `hoja.ts`, `tiradas.ts`, `creacion.ts`, `alElegir.ts`, `niveles.ts`, `validar.ts`, `textoIa.ts`, `documentacion.ts`, `editar.ts`, `motor/mesa.ts` = `/home/admin/CrisolVTT/crisol/packages/systems/src/motor/*`
- `5e/…` = `/home/admin/CrisolVTT/crisol/packages/systems/src/ejemplos/5e/*`
- `ids.ts` = `/home/admin/CrisolVTT/crisol/packages/systems/src/ids.ts`
- `HojaGenerica.tsx`, `hojaPorDefecto.ts`, `Asistente.tsx` = `/home/admin/CrisolVTT/crisol/packages/fichas/src/*`
- `mcp/sistema.ts` = `/home/admin/CrisolVTT/crisol/apps/core-host/src/mcp/tools/sistema.ts`
- `resources.ts` y `prompts.ts`, en esa misma carpeta `mcp/`
- `SistemaService.ts` = `/home/admin/CrisolVTT/crisol/apps/core-host/src/sistema/SistemaService.ts`
- `VistaSistema.tsx` = `/home/admin/CrisolVTT/crisol/apps/desktop/src/renderer/src/sistema/VistaSistema.tsx`

## 0. Idea general
- **Solo datos.** Un sistema es `.crisol/sistema.json` en cada mundo, validado con el esquema zod `sistemaSchema` (sistema.ts:1085-1200). No hay reglas en el código.
- **Ejemplos.** 5e 2014, 5e 2024 y «En blanco» son ejemplos escritos en TypeScript que se copian al mundo (5e/index.ts:1-4, 106-107).
- **Documentación desde el esquema.** Cada `describe()` del zod es corto y en español, y de ahí sale la documentación para la IA (sistema.ts:5-6; documentacion.ts:91 usa `z.toJSONSchema`).
- **Carga tolerante** (SistemaService.ts:1-13 y 141-170):
  - Si solo falla alguna referencia, se usa el sistema igual y se dicen los problemas.
  - Si falla el formato, se carga sin lo que falla.
  - Si ni así vale, se sigue con el último válido. Antes de guardar encima, el archivo malo se copia a `sistema.con-problemas.json`.
  - Guardar solo acepta un sistema sin problemas (:107).
- **Vista «Sistema».** Sus secciones son general, hoja, diseño, creación, tiradas, criaturas, estados, mesa y avanzado (el JSON entero) (VistaSistema.tsx:41-42, 686-705). General tiene nombre, resumen y fuente (:49-73).

## 1. Las secciones del `sistema.json` (sistema.ts:1085-1200)
**Raíz**
- `formato: 'crisol-sistema'` y `version: 1`, un literal sin migraciones (:1087-1088).
- `id`, `nombre`, `resumen` (hasta 8000 caracteres, para la IA) y `fuente` {nombre, licencia, atribucion, atribucionEs?, url?} o null (:1089-1095).
- `tablas`: de tipo `lista` (por posición), `mapa` (por clave) o `rangos` (la primera fila cuyo «hasta» no se pasa) (:23-29, :1096).
- `personaje` (:1097-1163): campos (hasta 200), resumen (plantilla), nivel, tamano (las casillas que ocupa en la mesa), hoja, estilo, creacion, subida y alElegir.
- `tiradas` (:1164).
- `criatura` (:1165-1188): calculos [{clave, formula}], bloque, iniciativa, formulario.campos y desafio.
- `estados` (:965-981): clave, nombre, reglas[], niveles, nivelMax, soloMesa y mesa{color, icono, efecto}.
- `consulta` (:1190-1196): acciones, cobertura y viaje.
- `mesa` (:1040-1081):
  - rejilla;
  - dados{defaultRoll, crit, explode};
  - iniciativa{mode turn-order|sides};
  - recursos (hasta 6, con `personaje` para seguir un campo de la hoja);
  - sentidos, luces y widgets.
- `calendarios` (:1198).

**Ids y claves**
- Una `clave` sigue la regex `[\p{L}\p{N}_-]{1,60}` y lleva el aviso «no cambiarlo una vez en uso» (:10-13). Una `rutaClave` tiene hasta 4 tramos (:15).
- Las claves de los elementos de un conjunto admiten espacios («sleight of hand») y tienen `alias` para importar (:180-187).
- Fórmulas hasta 2000 caracteres (:17). Una plantilla es texto con `{expr}` dentro (:18).
- En la mesa, el id de un estado es `${sistema.id}-${clave}` (motor/mesa.ts:19).
- Los ids antiguos se traducen: `dnd5e`/`generico` → `5e-2014`, `dnd2024` → `5e-2024` (ids.ts:5-11).

**Campos de la hoja** (tipo `CampoSistema` :95-169; zod :190-310)
- Base común: clave, nombre, abrev, ayuda, `ruta` (dónde va en el YAML, con `{elemento}` en un conjunto) y `omitir` (nunca|vacio|cero|falso|defecto) (:33-45).
- **texto**: defecto, max, lineas, amplia, recortar (:192).
- **numero**: defecto, defectoFormula, min, max, maxFormula, decimales (:193-205).
- **marca**: defecto, `guardar: 'lista-de-claves'`, aviso{si, texto, bloquea} (:206-218).
- **opciones**: opciones[{valor, nombre, si}], opcionesDe (un conjunto), opcionesDePaginas, vacio, libre (:219-237).
- **texto-lista**: max y sugerencias (`estados` o páginas del mundo) (:238).
- **derivado**: una `formula`; no se guarda (:239).
- **grupo**: campos y omitirSi (:240-242).
- **lista** (:243-292):
  - columnas, requiere, max;
  - enlace (tipo de página) y enlaceFiltro;
  - repetir, desdePagina, bloquear;
  - dentro (contenedores, como la mochila) y filtros;
  - `desde{lista, si, columnas}`: filas calculadas de otra lista;
  - `paginas{clase, propiedad}`: cada fila es una página.
- **conjunto**: elementos o elementosDe, campos por elemento (con `este`), omitirElementoSi, orden, conservarOtros (:293-308).
- Solo en columnas de una lista: deshabilitado, oculta y ayudaFila (:48-52).

**Valores derivados**
- Cualquier campo `derivado`, a cualquier nivel: raíz, grupo, columna o subcampo de un conjunto.
- Se evalúan al pedirlos, con getters y caché, y los ciclos se detectan en ejecución («depende de sí mismo») (hoja.ts:469-577, ciclo en :479).
- Ámbito: en un conjunto, `este` = {clave, nombre, abrev, datos, subcampos} (hoja.ts:554-557); en una lista, `este` = la fila (:507). Las capas van de lo local a la raíz (:460-466, 496).
- `defectoFormula` y `maxFormula` se aplican al normalizar (:167-199).
- Ejemplos de 5e (5e/personaje.ts:51-237):
  - `competencia = tabla("competencia", nivel - 1)`
  - `mod = floor((este.puntuacion - 10) / 2)`
  - habilidad: `caracteristicas[este.datos.car].mod + este.comp * competencia`

**Modelo de la hoja** (hoja.ts:1-10)
- El YAML del bloque `personaje` se lee como `Hoja {datos, resto, error}` (:17-27). Lo que el sistema no conoce va a `resto` y se conserva.
- Leer normaliza (valores por defecto, topes).
- `cambiarHoja` va por clave (`pg.actual`, `inventario.6.notas`, `inventario.Foco arcano.notas`) y renormaliza todo (:618, 694-733).
- Claves internas: `_alElegir`, `_niveles` y `_repetir` (:30-34).

## 2. Lenguaje de fórmulas
**Gramática**
- Usa el analizador de expresiones del núcleo en dialecto `bases` (formula.ts:9, 67-76 → parser.ts:446). Sin `eval`.
- Nodos: lit, id, member, index, call, unary (`!`, `-`), bin, list y obj (parser.ts:26-40).
- Prohibidos: link, datekw, regex, lambda y method (formula.ts:36-64). No hay `x.y()` ni lambdas.
- Precedencia (parser.ts:154-171): `||` 1, `&&` 2, comparaciones 3, `+ -` 4, `* / %` 5. También acepta `=`, `|` y `&` como alias.
- No hay ternario: se usa `si(c, a, b)`. Literales: números, "…", true/false/null, `[ ]` y `{ }`.

**Valores y coerción**
- Un valor es número, texto, sí/no, null, lista o registro (:11).
- `comoNumero` entiende «+2», «1/4», «1 1/2» y la coma decimal (:116-127).
- Son falso: null, false, 0, "" y [] (:137).
- `+` con un texto concatena (:288-296). `==` compara como números si los dos lo son (:285).
- `lista.col` sobre filas devuelve esa columna de cada fila (`armas.nombre`) (:331-336).

**Funciones** (formula.ts:191-276; documentadas en documentacion.ts:11-42)
- Números: max, min, floor, ceil, round, abs, suma, numero, caras.
- Lógica: si y o (las dos solo evalúan lo que necesitan, :349-358), vacio.
- Texto: texto, signo, fraccion, miles, unir, juntar, contiene (sin tildes ni mayúsculas).
- Tablas: `tabla("n", clave)`.
- Filas: sumaFilas, `filas(lista, "condición", "col")`, contarFilas, largo, contar.
- Dados: alMenos, pares, dobles, mayor, menor.

**A qué datos puede referirse** (el ámbito, formula.ts:28-32)
- Los valores de la hoja por clave (con los derivados) y `este`.
- En tiradas: `total`, `objetivo`, `natural`, `dados` y `grupo.<etiqueta>` (tiradas.ts:112-119).
- En los pasos: `antes` y `eleccion.<clave>.<dato>` (creacion.ts:5-7).
- En «al elegir»: `valor`, `pagina`, `paginas.<n>` y `fila` (alElegir.ts:193-205).
- En filtros y opciones de páginas: `pagina`. En el bloque de características de la criatura: `x` (sistema.ts:382).

**Límite y evaluación**
- `PRESUPUESTO = 20 000` nodos visitados por evaluación; al pasarlo, «La fórmula tarda demasiado» (formula.ts:34, 325).
- Se interpreta el árbol con `evaluar()` (:383).
- Plantillas: `analizarPlantilla` y `rellenar`; `{{` y `}}` escriben llaves (:392-433).

**Errores**
- `ErrorFormula`, corto, en español y con la fuente entre comillas: «x»: no existe la función «y» (:40, 48, 72).
- Los del analizador dicen la posición (parser.ts:214-217).
- En ejecución: «max necesita un número y recibió «x»», «División entre cero», «No hay tabla «x»».
- Una variable que no existe da null, sin error (:329-330).
- En la hoja, muchos errores se tragan y dan null (hoja.ts:169-173, 529-535, 592-596).

**¿Da un desglose explicable?** No. `evaluar` devuelve solo el valor, sin términos ni orígenes. Lo más parecido que hay:
- El registro `_alElegir` sabe qué elección puso cada cosa, y `origenEnRegistro` lo dice («trasfondo: Sabio») (alElegir.ts:178-189).
- Columnas `origen` que se rellenan con `fijas` (sistema.ts:902).
- `ayudaFila`, un texto que se escribe a mano (sistema.ts:51).
- `referencias()` saca los nombres que usa una fórmula (formula.ts:79-109), pero no se usa para explicar nada.

## 3. Tiradas
**Esquema** (sistema.ts:316-346)
- clave y nombre (plantilla).
- `para`: un conjunto, una lista o una ruta (`conjuros.lista`). Sale una tirada por elemento o fila, con `este`.
- `formula`: plantilla de notación, como `1d20{signo(este.total)}`.
- `variantes` [{si, formula}]: manda la primera que se cumple.
- `modos` [{clave, nombre, cambia{de: a}, dobla}].
- `objetivo` {nombre, opcional}; `total` (una fórmula si no es la suma).
- `resultado`: franjas [{si, nombre, tono}]; manda la primera que se cumple. Tonos: critico, exito, parcial, fallo, pifia, neutro (:314).
- `critico` (para los dados 3D): natural, roll-under, doubles, high-total, none o resultado (lo dice la franja).

**Motor** (tiradas.ts; puro, los dados los tira @crisol/dice)
- `prepararTirada`: elige la variante, rellena la plantilla, aplica el modo con sustitución de texto y dobla los dados si toca (:41-49).
- `tiradasDeHoja` expande `para`: el elemento es la clave en un conjunto o el índice de la fila en una lista (:52-64).
- `doblarDados` y `multiplicarDados` (:67-78).
- `interpretar` y `bandaDe` calculan el total y la franja (:125-151).

**Cómo se enlaza con los campos** (indirecto). La tirada apunta a su conjunto o lista con `para`, y los bloques de la hoja nombran la tirada por su clave:
- `DatoHoja.tirada` (:545).
- `caracteristicas.tirada` y `salvacion.tirada` (:594-595).
- `competencias.tirada` (:606).
- `tabla.tirada` o `tabla.tiradas[]` {tirada, modo, etiqueta, columna, criticoDe, criticoSi, niveles{desde, hasta, extra}} (:618-644).
- En las criaturas no hay claves: `propiedad.tirada` y `bonos.tirada` son notación directa (:375, 385).

**Críticos y ventaja**
- Ventaja y desventaja son modos con `cambia {"1d20": "2d20kh1"}` y `"2d20kl1"` (5e/index.ts:17-20).
- El crítico de daño es un modo `dobla` más `criticoDe`/`criticoSi` en la tabla: si el impacto fue crítico, el daño sale doble (sistema.ts:626-631).
- Un conjuro a más nivel suma `niveles.extra` por cada nivel por encima.
- `mesa.dados` da los valores globales de crit y explosión (:1052-1058).

**Las de 5e** (5e/index.ts:22-66)
- característica, salvación y habilidad: contra una CD opcional, Éxito/Fallo.
- iniciativa.
- ataque: 20 natural es Crítico, 1 es pifia, y si no, Impacta/Falla contra la CA.
- muerte y dado de golpe.
- documentacion.ts:44-86 trae dos ejemplos que no son 5e: una reserva de d6 (`total: mayor(dados)`) y 2d6 + atributo.

## 4. Creación y subida de nivel
**Pasos.** `personaje.creacion` y `personaje.subida` son listas de `PasoCreacion` (sistema.ts:760-796; zod :814-961). Todos admiten titulo, ayuda, `si` (sale solo si se cumple, con la hoja tal como va), `soloCreacion` y `aplazar` (:798-803). Los tipos:
- **datos**: escribir campos; cada uno con etiqueta, pista, max y obligatorio (:815-830).
- **eleccion**: opciones en tarjetas (:831-833). Cada `OpcionCreacion` lleva (:735-743, 804-812):
  - nombre, valor, ayuda;
  - `pone{campo: valor}` y `suma{campo: n}`;
  - `datos`, que los pasos siguientes ven como `eleccion.<clave>.<dato>`;
  - `filas{lista: [...]}`.
- **puntuaciones** (:707-732, 834-851):
  - métodos `serie`, `tirada` (4d6kh3), `compra` (costes, también negativos), `reparto` (puntos como número o fórmula, porElemento, max, elementos) y `libre`;
  - `aumentos`: columnas Base · Especie · Total en la misma tabla.
- **marcas**: elegir (fórmula), opcional («hasta N») y elementos (:852-868).
- **valores**: una fórmula propuesta (con `antes`), fijo, y `tirar{dados, formula con resultado}` (:869-890).
- **lista**: añadir filas (:891). **filas**: elegir de opciones o de páginas (:892-907).
- **campo**: aplica una regla alElegir dentro del paso; con `parte: 'aplazados'`, `valor` (`antes.nivel + 1`) o `tambienEn` (multiclase) (:908-931).
- **cambiar**: cambiar una fila por otra (:932-945). **equipo**: (a)/(b) o elegir del compendio (:946-960).

**Reglas `alElegir`** (sistema.ts:1109-1161). Al cambiar un campo de la hoja (clase, especie, trasfondo…) se abre una ventana con lo que da. Cada regla lleva:
- campo, `si` (con `valor`) y titulo;
- `pagina` {carpeta, tipo, nombre, falta}, cuyas propiedades son `pagina`, y `paginas` para más;
- pone y marcas[{conjunto, marca, valor, elementos, enSuLugar}];
- filas (fijas o `{desde, columna, fijas}`) y suma{desde, ruta con `{clave}`};
- aviso y pasos.

**Cómo se ejecuta** (creacion.ts)
- Hay un `Borrador {hoja, cambios[], elecciones{clave: datos}, variables, paginas}` en memoria (:15-33).
- Cada paso pasa por `pasoVisible` (:65) y por `resultadoPaso(paso, inicio, antes, estado)`, que da `{cambios, datos}` (:231-384).
- `RespuestaPaso` es un registro libre que manda la interfaz (:226).
- Al terminar, todos los cambios se aplican de una vez (Asistente.tsx:1131, con `cambiosConApunte`).

**Cómo se guardan las elecciones**
- En la hoja solo quedan los valores resultantes. Los `datos` de las elecciones mueren al cerrar el asistente.
- `_alElegir` (en `resto`) guarda, por campo (o `campo=fila`), un `Aplicado {valor, cambios[{campo, antes, despues} | {campo, filas}]}`. Sirve para quitar exactamente lo dado si después se elige otra cosa (alElegir.ts:33-40, 86-140, 609-618).
- `_niveles` guarda un `ApunteNivel {nivel, modo, hora, antes (cada clave que tocó, tal como estaba), alElegir, repetido}` (niveles.ts:14-24, 66-79).
- `_repetir` permite «repetir desde el nivel N» (niveles.ts:26-33, 93-124). Lo que no se toca al repetir viene de una lista fija en el motor (niveles.ts:36).

**Validación de los pasos**
- Al usarlos, `faltaEnPaso` devuelve lo que falta como textos («Habilidades» (2 más)) (creacion.ts:429-549), y `resultadoPaso` lanza un Error si faltan marcas (:272).
- Sobre el sistema, `validarSistema` comprueba que cada paso nombra campos que existen y son del tipo pedido (validar.ts:313-426).

## 5. Diseño de la hoja por bloques
Una aclaración: `motor/hoja.ts` no es el diseño, sino el modelo de datos (leer, normalizar, escribir, derivados y cambios). El diseño es `personaje.hoja: BloqueHoja[]` (sistema.ts:487-536; zod :556-703), y lo pinta HojaGenerica.tsx (switch en :2200-2251).

**Los 20 bloques**
- De datos:
  - **fila** y **datos** (cifras grandes);
  - **reserva** (actual, max y temporales, con daño y curación);
  - **contador** (un campo, o `desde` una lista: la munición) y **casillas**;
  - **caracteristicas** (valor y muestra, tirada, salvación) y **competencias** (marca 0/1/2, total, detalle);
  - **tabla** (columnas, tiradas, usos, vistas, agrupar, ordenar, anadir, pie, anchos, rayas, vacia, descripcion);
  - **cantidades**, **espacios**, **etiquetas**, **textos** y **nota**.
- De composición: **seccion**, **columnas** (hasta 4), **pestanas** (con `cuando`) y **si**.
- Sueltos: **texto** (plantilla con negrita y cursiva), **espacio** y **raya**.

**Cómo se componen**
- Un `DatoHoja` es una clave o un objeto {campo, etiqueta, tirada, icono, signo, ancho, pista, estilo} (:472-483, 540-552). Se edita si se guarda; si es derivado, solo se lee.
- Cada bloque admite un `estilo`: colores validados, letra en %, márgenes y una clase propia (:403-430).
- Estilo global (:449-468):
  - densidad, fuente, colores y temas claro/oscuro;
  - `css` de hasta 30 KB, anidado dentro de la hoja, sin url() ni @import;
  - variables `--pj-*` y selectores `[data-campo]` y `[data-columna]`.
- Sin `hoja`, `hojaPorDefecto` la deduce de los campos (hojaPorDefecto.ts:8-40).
- Las criaturas usan otro lenguaje de bloques, `BloqueSistema`: cabecera, imagen, grupo, pestanas, propiedad, caracteristicas, bonos, rasgos, conjuros, texto y si (sistema.ts:350-391).
- La hoja de 5e (`HOJA_5E`, 5e/personaje.ts:244-309): fila de identidad, cifras, PG, dados de golpe, casillas de muerte con `si: 'pg.actual <= 0'` y pestañas Principal, Inventario, Conjuros y Rasgos.

## 6. Validación (validar.ts)
**Qué devuelve.** `validarSistema(entrada)` devuelve `ProblemaSistema[] {ruta, mensaje}` (:12-15, 42), con rutas legibles por clave: `personaje.campos[fue].formula`, `tiradas[ataque].resultado[0].si`.

**Qué comprueba, en orden**
1. El formato con zod. Si falla, devuelve hasta 30 problemas y para (:43-44).
2. Las claves que el formato no conoce (se quitarían al guardar) (:27-50).
3. Los campos (:80-195):
   - claves repetidas;
   - fórmulas y plantillas que no se entienden;
   - tablas inexistentes, solo si el nombre va escrito tal cual (:20-22);
   - conjuntos y columnas referidos que no existen;
   - opciones vacías y opciones por fila fuera de una lista.
4. La maquetación: campos, tiradas, columnas y modos que existen; `criticoDe`; un contador con `campo` o `desde` (uno de los dos); el CSS (:196-311).
5. Los pasos y «al elegir» (:313-426).
6. Las tiradas (:428-444).
7. La criatura (:446-483).
8. Estados y mesa: claves únicas, y la tirada por defecto y la de iniciativa se pueden tirar (:485-500).
9. Si no hay problemas: con una hoja vacía, se calculan los derivados y se prepara cada tirada para comprobar que se puede tirar (:502-518).

**Detalles**
- No hay detección estática de ciclos. Salen en el paso 9 con la ruta genérica `personaje` (:515-516).
- Se valida al guardar (mcp/sistema.ts:56-64; SistemaService.ts:107).
- Los ejemplos tienen pruebas (ejemplos/ejemplos.test.ts:45-50) y salidas doradas en `__dorados__/salidas`.

## 7. 5e 2014 (SRD 5.1) frente a 2024 (SRD 5.2)
Los dos salen de `quintaEdicion(edicion)` (5e/index.ts:71-102).

**Lo común**
- Campos, hoja y tablas de personaje (5e/personaje.ts), tiradas y mesa (casillas de 1,5 m, cono de 53,13°, recursos PG y CA).
- Cobertura y viaje (referencia5e.ts:36-47).
- Ojo: también los sentidos y luces de 2014 en los dos (index.ts:97-98).

**Lo que cambia**
- **Identidad y fuente**: `5e-2014` o `5e-2024`; SRD 5.1, o SRD 5.2 con `atribucionEs` (index.ts:76-82; srd51.ts:7; srd52.ts:8).
- **Estados**: mismas claves en inglés, textos distintos. El cansancio, por ejemplo: 6 niveles con efectos acumulados en 2014, y en 2024 −2 por nivel a las pruebas de d20 y −1,5 m de velocidad (srd51.ts:50-60; srd52.ts:54-64).
- **Acciones de consulta**: 10 en 2014 (con Lanzar conjuro y Usar objeto) y 12 en 2024 (con Influir, Magia, Estudiar y Utilizar) (referencia5e.ts:8-34).
- **Creación** (5e/creacion.ts:129-168):
  - 2014: Clase → Características → Especie (aumentos fijos con `suma`; el semielfo reparte +1 en un paso con `si`) → Trasfondo como texto → Habilidades (las de la clase + 2) → PG y CA → Equipo.
  - 2024: Clase → Trasfondo (una elección que pone 2 habilidades y `datos.caracteristicas`) → Especie (sin aumentos) → Características → Aumentos (reparto de 3, como mucho 2 a una, solo entre `eleccion.trasfondo.caracteristicas`) → Alineamiento → Habilidades → PG y CA → Equipo.
  - En 2024, paladín y explorador tienen espacios de conjuro a nivel 1 (:25-26).
- **Subida**: la mejora de característica va en los niveles 4, 8, 12, 16 y 19 en 2014, y en 4, 8, 12 y 16 en 2024 (:172).
- **Criatura** (5e/criatura.ts:90-162):
  - 2014: salvaciones en su propia línea, herramientas, daños e inmunidades a estados por separado, «Desafío (PX)» y «Bonificador por competencia», efectos regionales.
  - 2024: iniciativa con su pasiva y su tirada, salvaciones dentro de la tabla de características, inmunidades con los estados en la misma línea, equipo (`gear`), «VD (PX; BC)».
- **Lo que no usa ningún ejemplo**: ni `alElegir` ni los pasos campo, filas, cambiar o equipo; esas piezas nacieron para Eana. El inventario sí son páginas (`paginas: {clase: 'objeto', propiedad: 'portador'}`, 5e/personaje.ts:181).

## 8. Lo de la IA y las herramientas MCP
**Recursos y prompt**
- `crisol://sistema` es `textoParaIa` (textoIa.ts:107-152; resources.ts:135-140). En Markdown y sacado de los datos, así que vale para cualquier sistema. Lleva:
  - el resumen y el id;
  - cada campo con su clave para `cambiar_personaje` y su tipo (los calculados, con su fórmula);
  - las tiradas con sus franjas;
  - los campos de criatura en el orden en que se pintan, y sus cálculos;
  - tablas, estados, sentidos, luz, mesa y licencia.
- `crisol://sistema/esquema` es `documentacionSistemas` (documentacion.ts:90-137; resources.ts:142-147): las partes, la gramática y las funciones, las variables de las franjas, las rutas de `cambiar_sistema`, dos ejemplos y el JSON Schema entero.
- El prompt `crear_sistema` guía 9 pasos con el máster (prompts.ts:198-222).

**Herramientas** (mcp/sistema.ts)
- **ver_sistema** `{parte?}`: todo, personaje, hoja, estilo, tiradas, criatura, estados, consulta, mesa, tablas o calendarios (:67-84).
- **crear_sistema** `{desde | sistema, id?, nombre?}`: lo sustituye entero; pide aprobación de tipo «borrar» (:86-106).
- **cambiar_sistema** `{cambios[hasta 40] {ruta, poner | quitar | anadir, antes}}` (:108-139).
  - Rutas como `a.b[n][clave=x]` (editar.ts:1-33).
  - Todo o nada, y pide aprobación de tipo «escribir».
- **validar_sistema** `{sistema?}`: incluye los problemas del archivo tal como está en disco (:141-161).
- **probar_tirada** `{tirada, elemento, personaje | yaml, modo, objetivo, dados fijos}`: devuelve notación, total y franja (:163-202).
- **ver_hoja**: un PNG de la hoja renderizada (:204-286).
  - Admite pestaña, ancho, tema, un sistema sin guardar, foco, un paso de creación o subida, el buscador y el HTML.
  - Necesita la app abierta.
- **probar_hoja** `{yaml | personaje, cambios}`: devuelve datos, calculado, filas calculadas, el YAML que se escribiría y las tiradas (:288-330).
- Guardar es validar, mandar la orden `sistema.guardar` y apuntarlo en el historial (:56-64).

## Lo que me parece frágil o mejorable
1. **Las erratas pasan.** Una variable que no existe da null (formula.ts:329-330) y la validación no mira los identificadores. Además, el aviso «No da ningún valor» no salta nunca: `derivados` cambia undefined por null (validar.ts:507 frente a hoja.ts:585).
2. **Errores poco precisos.** Los ciclos solo se ven en ejecución y con la ruta `personaje`. Un error en un derivado tumba esa comprobación final con un solo mensaje. En la hoja se tragan muchos errores (hoja.ts:169-173, 529-535).
3. **El tope de 20 000 pasos no limita una hoja.** Cuenta por cada llamada a `evaluar`: `filas()` empieza un contador nuevo por fila y cada derivado tiene el suyo (formula.ts:246, 384). La condición de `filas()` es un texto que no se valida al guardar, y su caché crece sin límite (:174-175).
4. **No hay desglose explicable** (base + bonos con su origen). Para la spec, convendría que la evaluación devolviera términos etiquetados.
5. **La ventaja es sustitución de texto** (`replaceAll('1d20', …)`, tiradas.ts:45): «11d20» se rompe. Mejor un modelo estructurado de tirada.
6. **Alias del analizador heredados de Bases**: `=`, `|` y `&` valen como `==`, `||` y `&&` (parser.ts:154-160).
7. **Dos lenguajes de maquetación**: uno para personajes y otro para criaturas, más 30 KB de CSS libre.
8. **Tiradas de lista por índice**: el elemento de una fila es su posición (tiradas.ts:60); reordenar cambia a qué fila apunta.
9. **Ids frágiles**: el id de un estado en la mesa depende de `sistema.id` (motor/mesa.ts:19), que `crear_sistema` puede cambiar. La mesa usa claves en inglés de Atlas y el resto, en español.
10. **El asistente guarda su estado en el YAML del jugador**: `_alElegir`, `_niveles` (con copias de lo que había antes) y `_repetir`. Crece y se puede editar a mano, y lo que no se toca al repetir es una lista fija de claves en el motor (niveles.ts:36).
11. **Versiones**: `version: 1` sin migraciones. Las claves desconocidas se pierden al guardar, y la carga «sin lo que falla» puede esconder partes enteras (SistemaService.ts:151-155).
12. **Normalización con matices**: un número fuera de rango se recorta sin avisar también al cambiarlo. Un texto sin `max` se corta a 200 caracteres al cambiarlo, pero no al leerlo (hoja.ts:185-199).
13. **Esquema enorme**: 1207 líneas, `lista` con unas 15 opciones y 11 tipos de paso, muchos nacidos de Eana. Cuesta aprenderlo, al máster y a la IA.
14. **Ejemplos en TypeScript, no en JSON**, y 2024 reutiliza sentidos y luces de 2014.
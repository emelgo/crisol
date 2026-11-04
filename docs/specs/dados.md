# Spec: dados (módulo 3)

Estado: **aprobada** por Enrique el 2026-11-04 («ok»), con las tres propuestas de sus preguntas. Primera capacidad del módulo 3 (`docs/specs/modulo-3.md`). Las decisiones
de Enrique, en `docs/modulos.md` § «### 3. Sistemas, fichas y dados».

## Objetivo

Tirar dados en Crisol y que la campaña lo vea. Cada tirada se resuelve en el servidor, queda en el registro de su
campaña y llega en vivo a quien la puede ver, con dados 3D. Se tira desde el panel de dados, desde una tirada escrita en
la wiki y desde la IA. Es la base de lo que viene después: la hoja tira con esto, y los sistemas ponen sus reglas
(la tirada por defecto, los críticos).

Usuarios: el máster y los jugadores de una campaña. La IA del máster, por el MCP.

### Historias

1. Como máster, abro «Dados» y tiro `1d20+5` o `4d6kh3`. Los dados caen en 3D, sale el total con su desglose y queda en
   el registro de la campaña.
2. Como jugador, veo en vivo las tiradas públicas de todos, cada una con el color de quien tira.
3. Como jugador, tiro «solo al máster» o «para mí»: solo lo vemos el máster y yo. Como máster, tiro en oculto: solo lo
   veo yo.
4. Como máster, escribo en una página de la wiki una tirada (`dice: 2d6+3`, como en Obsidian, o desde «/» → Tirada) y
   en partida la pulso: se tira en la campaña que tengo elegida.
5. Desde claude.ai, la IA tira en una campaña o prueba una fórmula sin apuntarla, y lee las últimas tiradas.

## Mapa de capacidades

| Id | Qué hace | Depende de |
|---|---|---|
| `notacion` | La notación, el intérprete y la tirada, sin base de datos ni interfaz (`packages/dice`) | — |
| `registro` | La tirada en el servidor, el registro de la campaña, la visibilidad y el aviso en vivo | `notacion` |
| `panel` | El panel de dados en la web, con su registro | `registro` |
| `dados-3d` | Los dados 3D que caen con el resultado del servidor | `panel` |
| `en-el-texto` | La tirada escrita en una página de la wiki | `registro` |
| `ia` | Las herramientas MCP | `registro` |

Orden: `notacion` → `registro` → `panel` → `dados-3d` → `en-el-texto` → `ia`. Lo más arriesgado va antes: que nadie
reciba una tirada que no puede ver (en `registro`, con su prueba de fugas) y que los dados 3D caigan en el resultado
que se les dice (un prototipo al empezar `dados-3d`).

## Requisitos

### `notacion`

- **Lo que se escribe**, como en el Crisol actual (su notación es nuestra y es la referencia; se puede partir de su
  código, pasándolo a las normas de este repo):
  - dados: `1d20`, `d20`, `d%` (d100), `4dF` (Fate);
  - quedarse con los altos o los bajos y descartarlos: `4d6kh3`, `2d20kl1`, `4d6dl1`;
  - repetir: `2d6r1`, `2d6ro<3` (una vez);
  - explotar: `1d6!`, `1d6!>4`, `3d6!!` (sumando en el mismo dado);
  - éxitos y fallos: `5d10>=8f1`;
  - aritmética con paréntesis: `(1d8+2)*2`, `1d20+5-1d4`;
  - etiquetas y comentario: `1d20[ataque]+5[fuerza] # Espada larga`.
- **Ventaja y desventaja**: `2d20kh1` y `2d20kl1`, con una función que da la misma fórmula con ventaja, con desventaja
  o sin ellas.
- **Críticos**: en un d20, el 20 natural es crítico y el 1, pifia (la regla de 5e, hasta que el sistema ponga la suya).
- **Un intérprete propio, sin `eval`**: texto → árbol → tirada. El azar entra de fuera: en el servidor, `crypto`; en las
  pruebas, una secuencia fija.
- **El resultado**: el total, cada dado (caras, valor, si cuenta, si explotó o se repitió), el crítico o la pifia y el
  desglose en texto (`1d20+5 → [14] + 5 = 19`).
- **Dicha en español**, para quien no lee notación: `2d20kh1` → «Ventaja (2d20, se queda el mayor)».
- **Límites**: 200 caracteres por fórmula, 100 dados por tirada, 1.000 caras, 100 explosiones. Pasarse da un error en
  español que dice dónde.

### `registro`

- **Quién tira**: los miembros de la campaña (el máster y sus jugadores) y la IA del máster. Leer el registro, solo los
  miembros, cada uno lo que puede ver. Permisos nuevos `dice.roll` y `dice.read`, en la capa de políticas.
- **Cada tirada se guarda** (tabla `dice_rolls`): campaña, mundo, quién (persona o IA), fórmula, etiqueta, resultado,
  visibilidad y hora.
  - **No son operaciones del historial**: una tirada no se deshace, pasó. El registro es su propia lista.
  - Se lee hacia atrás, de 50 en 50.
- **Visibilidad**, que decide el servidor:

  | Visibilidad | La ven | Quién la usa |
  |---|---|---|
  | Todos | toda la campaña | máster y jugadores |
  | Para mí | quien tira y el máster (sin aviso) | jugadores |
  | Al máster | quien tira y el máster (marcada para él) | jugadores |
  | Oculta | solo el máster | el máster |

  Los demás no reciben nada de una tirada privada, ni que ha habido una: ni por la API, ni por el WebSocket, ni por el
  MCP.
- **En vivo**: cada tirada llega al momento a cada miembro que la puede ver, con el aviso que ya hay en tiempo real.
- **Ritmo**: tirar tarda menos de 50 ms en el servidor; como mucho, 60 tiradas por minuto por persona (más, `429`).
- **El color de cada persona** para sus dados: uno por defecto, y se cambia en el perfil.

### `panel`

- **«Dados»**, en la barra de iconos dentro de un mundo (una excepción a la norma de que esa barra solo lleve el mundo y
  Archivos) y en la página de una campaña (la que tienen los jugadores). Abre y cierra la ficha de dados a la derecha,
  en el sitio del panel de la página, sin tapar el texto. La ficha lleva:
  - el campo de la fórmula, con su descripción en español mientras se escribe y el error si no vale;
  - botones rápidos (d4, d6, d8, d10, d12, d20, d%) y ventaja o desventaja;
  - la visibilidad (cada uno solo ve las que puede usar);
  - la campaña, si el mundo tiene varias (recuerda la última);
  - debajo, el registro en vivo: quién, cuándo, la fórmula, el total grande, el crítico marcado y el desglose al
    desplegar. Las privadas, con su marca.
- **Repetir** una tirada del registro con un clic.
- Con el teclado entero; el total se anuncia a los lectores de pantalla.

### `dados-3d`

- **Los dados caen en 3D** sobre la pantalla con el resultado que dio el servidor: d4, d6, d8, d10, d% (dos d10), d12,
  d20 y dF, con el color de quien tira. El crítico brilla.
- **Las tiradas públicas de los demás también caen** en tu pantalla, con su color. Se puede apagar en el panel.
- **La animación, siempre entera**, aunque el sistema pida menos movimiento (norma de `docs/diseno.md`). El total se
  anuncia a los lectores de pantalla.
- **Se carga aparte**, solo al tirar la primera vez, para no pesar en el arranque. Con más de 20 dados, caen los 20
  primeros y el resto va solo en el registro.
- **Dependencias nuevas**: `three` y `cannon-es`, las dos MIT, como en el Crisol actual. **Hace falta el visto bueno de
  Enrique.**

### `en-el-texto`

- **Una tirada en una página**: un nodo en línea con su fórmula y su etiqueta. Se pone desde «/» → Tirada, o
  escribiéndola como `` `dice: 1d20+5` `` (como el plugin Dice Roller de Obsidian, que usa Eana).
- **En Markdown, de ida y vuelta**: `` `dice: 1d20+5` ``, para que la IA la escriba y para pasar Eana.
- **Pulsarla tira** en la campaña elegida en el panel, con su visibilidad. Si el mundo no tiene campañas, tira sin
  apuntar y lo dice.
- **Una fórmula que no vale** se ve marcada y no tira.

### `ia`

| Herramienta | Tipo | Qué hace |
|---|---|---|
| `tirar_dados` | `write` | Tira una fórmula con su etiqueta. Con campaña, queda en su registro (por defecto, oculta: solo la ve el máster); sin campaña, solo da el resultado |
| `ver_tiradas` | `read` | Las últimas tiradas de una campaña que puede ver el máster |

- Las tiradas de la IA salen en el registro como de «IA».
- Las instrucciones del MCP hablan de la notación y de las tiradas escritas en la wiki.

### Interfaz

- Pantallas y piezas nuevas: el panel de dados con su registro, la bandeja de dados 3D y la tirada en el texto.
- Siguen las normas de `docs/diseno.md`. Los prototipos se hacen y se aprueban en el paso de diseño, antes del plan.
- Todo usable en el móvil y con el teclado; WCAG 2.1 AA.

## Pila

La de los módulos anteriores. Dependencias nuevas: `three` y `cannon-es` (MIT), solo en la web y cargadas aparte.

## Comandos

Los del módulo 0 (`docs/specs/fundacion.md` § Comandos). No hay comandos nuevos.

## Estructura

```
packages/dice/                       La notación, el intérprete y la tirada (puro: sin base de datos ni interfaz)
packages/contracts/src/dice.ts       Las acciones de dados y su evento en vivo
packages/db/src/schema/dice.ts       La tabla dice_rolls
apps/server/src/actions/dice.ts      Tirar y leer el registro, con su visibilidad
apps/web/src/dice/                   El panel, el registro y la bandeja 3D
packages/editor/src/nodes/dice.ts    La tirada en el texto
```

## Estilo

El del módulo 0 (`docs/specs/fundacion.md` § Estilo).

## Pruebas

- **`packages/dice`**: cada parte de la notación, con un azar fijo; los límites; el desglose y la descripción en
  español; los críticos.
- **Integración**, contra Postgres:
  - cada visibilidad: quién la recibe y quién no, por la API y en vivo;
  - quien no es de la campaña no tira ni lee;
  - el límite por minuto.
- **Fugas**: un jugador no recibe las privadas de otro ni las ocultas del máster, por ninguna vía (API, WebSocket,
  MCP).
- **MCP**: cada herramienta en cada modo de IA.
- **Web**: el panel (fórmula, error, visibilidad, registro) y la tirada en el texto.
- **E2E** (Playwright + axe):
  - el máster y una jugadora en dos pestañas: la tirada pública de una sale en el registro de la otra al momento; la
    «al máster» de la jugadora solo le sale al máster;
  - una tirada escrita en la wiki se pulsa y sale en el registro;
  - axe en el panel.
- Cobertura ≥ 80 % de las líneas nuevas o cambiadas, con TDD en cada porción.

## Límites

- **Siempre**:
  - el azar, en el servidor; la web nunca decide un resultado;
  - la visibilidad, en el servidor;
  - textos por i18n;
  - todo en verde en local antes de subir (la CI gasta cuota: una vez tras muchos cambios).
- **Preguntar antes**: dependencias nuevas (`three`, `cannon-es`), cambiar `CONSTRAINTS.md`.
- **Nunca**: `eval` ni `new Function` para las fórmulas; tocar el Crisol actual (se lee, no se cambia); nada de
  `research/` en el código.

## Criterios de éxito

1. **En staging**, Enrique (máster) y una jugadora, en dos navegadores: él tira `1d20+5` y a ella le caen los dados con
   su color y le sale en el registro al momento.
2. **Ella tira «al máster»**: él lo ve marcado y ella también; una segunda jugadora no recibe nada. Él tira en oculto y
   nadie más lo ve.
3. **En una página de la wiki**, Enrique escribe `` `dice: 2d6+3` ``, la pulsa y sale en el registro de la campaña.
4. **Desde claude.ai**, la IA tira en la campaña y lee las últimas tiradas.
5. **Ritmo**: tirar tarda menos de 50 ms en el servidor.
6. **Calidad**:
   - la CI en verde, sin supresiones nuevas;
   - la prueba de fugas ampliada pasa;
   - axe sin fallos críticos ni graves en el panel;
   - tirar con el teclado, y el total se anuncia.

## Fuera de `dados`

- Las reglas de dados de cada sistema (la tirada por defecto, los críticos de otros juegos): con `sistemas`.
- Las tiradas desde la hoja y la ventaja propuesta: con `hoja`.
- Las tablas aleatorias: con el compendio (módulo 4).
- El chat y los susurros: con la sala de jugadores (módulo 7).
- Las tiradas dentro de un statblock: con el bestiario (módulo 4).
- Sonido de los dados.

## Preguntas abiertas

Resueltas al aprobarla (2026-11-04):

1. `three` y `cannon-es` (MIT), en la web y cargadas aparte: **sí**.
2. Las tiradas de la IA, ocultas por defecto y públicas solo si se le pide: **sí**.
3. Los dados de los demás caen en tu pantalla por defecto y se pueden apagar: **sí**.

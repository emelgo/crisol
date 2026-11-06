# Capas de compendio, criaturas en juego, grupo e imágenes en Foundry VTT (dnd5e)

Módulo de Crisol: 4. Compendios, bestiario y biblioteca · Fecha: 2026-11-06 · Versión estudiada: Foundry VTT 14.369 y
dnd5e 6.0.6

## Pregunta

Para el módulo 4, Enrique quiere que el compendio se juegue como en Foundry o D&D Beyond, con tres capas (la del
sistema, la de la cuenta y la del mundo) y que sus criaturas se pongan en juego como copias o como únicas. Queríamos
saber:

1. **Capas de compendio**: compendios del sistema o de un módulo frente a los del mundo; cómo se crea uno de mundo,
   cómo se copia una entrada (si guarda su origen y si se puede actualizar desde el original), el bloqueo, las
   carpetas y quién ve o usa cada compendio.
2. **Criaturas en juego**: actores del mundo frente a fichas en la escena; fichas enlazadas y no enlazadas: dónde
   viven los PG y los usos de cada copia, qué pasa al borrar una ficha y cómo se hace un PNJ único. Si dnd5e tira los
   PG de una criatura.
3. **La hoja de PNJ de dnd5e en partida**: qué enseña y cómo se juegan sus acciones (ataque, salvación, daño y
   aplicarlo, recarga, usos, legendarias, guarida) y el descanso.
4. **El grupo y el encuentro de dnd5e**: el inventario compartido, los miembros y el reparto de PX y monedas; el
   encuentro con sus cantidades, su dificultad y su colocación.
5. **Imágenes**: qué trae el zip de dnd5e, a dónde apuntan las imágenes de sus compendios, cuántas son de lo que trae
   Foundry de serie y con qué licencia.

Las tablas aleatorias ya están en `avances-y-tablas.md`, y la pantalla y la riqueza del compendio, en `compendio.md`.

## Lo que hacen

### Cómo se estudió

- Con craft-anything, en modo profundo: se restauraron las 405 fuentes originales de dnd5e (MIT) desde su mapa de
  fuentes y se leyó el cliente de Foundry, que va sin minimizar. Cada afirmación lleva su evidencia en el registro del
  estudio (hallazgos `fnd_1` a `fnd_12`).
- Se hizo inventario de la carpeta del sistema (1.501 archivos) y de los iconos de serie de Foundry (7.102), y se
  contaron las rutas de las imágenes en los compendios de dnd5e ya copiados en `datos-locales/dnd5e/` (fuera de git).
- **No se arrancó Foundry**: todo sale del código y de los datos. No se cambió nada del mundo `crisol-rea`.

Marcas: [O] observado en el código o en los datos; [I] inferido.

### 1. Las capas de compendio

- **Dos clases de compendio** [O]: los que trae un paquete (sistema o módulo, declarados en su manifiesto) y los del
  mundo, que crea el máster desde la barra lateral eligiendo nombre y clase de documento (actores, objetos, diarios,
  tablas, escenas…). Un compendio guarda documentos de una sola clase.
- **El bloqueo** [O]: los de un paquete nacen bloqueados y los del mundo, abiertos. Al desbloquear uno ajeno, Foundry
  avisa de que lo cambiado se perderá cuando se actualice el sistema o el módulo y ofrece, en el mismo aviso,
  **duplicarlo al mundo**. Duplicar crea un compendio del mundo con una copia de todo.
- **Copiar una entrada** [O]: traer un documento de un compendio al mundo lo copia entero, con un id nuevo, sin
  carpeta ni orden y con su dueño en quien lo trae. La copia **guarda la referencia a su original**. Al guardar un
  documento del mundo en un compendio se hace lo contrario: se le quitan los permisos y esa referencia.
- **Sin actualizar desde el original** [O, en lo buscado]: en el núcleo no hay ninguna acción que refresque una copia
  con los cambios de su original. La referencia sirve para citar la fuente, para que los avances encuentren lo que ya
  se concedió y para reutilizar una criatura ya importada (punto 4). Mejorar el sistema no mejora lo ya copiado.
- **Carpetas, en dos niveles** [O]: un paquete agrupa sus compendios en carpetas de la barra lateral desde su
  manifiesto (dnd5e: «contenido moderno» y «contenido antiguo», con subcarpetas de rasgos, objetos y conjuros, y
  monstruos), y cada compendio tiene dentro sus propias carpetas de documentos.
- **Permisos por rol, no por persona** [O]: cada compendio tiene un nivel por rol (ninguno, limitado, observador o
  dueño). El máster es siempre dueño; si el paquete no dice otra cosa, el ayudante es dueño y el jugador, observador.
  dnd5e deja los de 2024 visibles para los jugadores, salvo los rasgos de monstruo, que solo ve el ayudante. El máster
  lo cambia por mundo, y se guarda en un ajuste del mundo junto a la carpeta, el orden y el bloqueo.
  - Con **observador** se ve el compendio y se abren sus entradas.
  - Con **limitado**, sus entradas salen en la búsqueda de la barra, pero el compendio no se lista [O en el código; I
    en cómo se ve].
  - Importar al mundo pide, además, permiso para crear esa clase de documento.

### 2. Criaturas en juego

- **Tres sitios para una criatura** [O]: la entrada del compendio (la referencia), el actor del mundo (la copia
  editable) y la ficha en una escena. Soltar una criatura del compendio en la escena la importa antes al mundo.
- **Ficha enlazada** [O]: es el propio actor del mundo. Sus PG, usos y estados se guardan en el actor, todas sus fichas
  los comparten y no se pierden al borrar la ficha. Así se hace un PNJ único que conserva su estado entre sesiones:
  marcando su ficha como enlazada.
- **Ficha no enlazada** [O]: guarda solo lo que cambia frente al actor del mundo (nombre, imagen, datos de juego,
  objetos y efectos) dentro de la propia ficha, y lo que se ve es el actor más esos cambios. Cada goblin de la escena
  lleva así sus PG. Lo que no ha cambiado sigue al actor: si el máster mejora el goblin del mundo, las copias lo notan
  salvo en lo que ya tocaron [I]. **Al borrar la ficha, se pierde su estado.**
- **Lo que hace dnd5e** [O]: los personajes creados en el mundo nacen con la ficha enlazada y del bando amigo; los PNJ,
  sin enlazar. Un ajuste del mundo (no, en silencio o con mensaje; de serie, no) tira los PG de cada PNJ no enlazado
  con su fórmula al crear la ficha y los guarda en esa copia. Si no, cada copia empieza con los PG medios.
- **Números en el nombre** [O]: la ficha puede añadir un número («Goblin 2») o un adjetivo al azar al crear copias.

### 3. La hoja de PNJ de dnd5e en partida

- **Cabecera** [O]: retrato, CA, PG con temporales, iniciativa, VD con su bono de competencia, tipo y alineamiento.
  También los contadores de acciones legendarias, resistencias legendarias y guarida, y las salvaciones contra muerte
  (solo si el PNJ está marcado como importante y llega a 0 PG). El máster tiene ahí el botón de descanso; el jugador
  dueño, si un ajuste lo permite.
- **Barra lateral** [O]: características con sus salvaciones, habilidades, velocidades, sentidos, idiomas,
  resistencias, inmunidades y vulnerabilidades (también a estados), dados de golpe, equipo y tesoro.
- **Pestañas** [O]: rasgos, inventario, conjuros, efectos, biografía y rasgos especiales. Los rasgos se agrupan por
  cómo se activan (pasivos, acción, acción adicional, reacción, legendaria y guarida). Cada fila enseña su
  recuperación, sus usos, su tirada y su fórmula, y se filtra y se ordena.
- **Jugar una acción** [O]: sale como tarjeta en el chat. En un ataque, primero el ataque y después el daño; en una
  salvación, la CD y el daño. El daño se aplica desde la tarjeta a las fichas elegidas o apuntadas, cada una con su
  multiplicador (nada, mitad, entero, doble), y tiene en cuenta resistencias, inmunidades, vulnerabilidades y umbral.
- **Recargas y usos** [O]: una recarga es una forma de recuperar usos con un dado (p. ej. con 5 o 6). dnd5e puede
  tirarla sola al empezar el turno de la criatura, según un ajuste (de serie, no); si no, se pulsa en la hoja. Los usos
  se recuperan por periodos: descanso corto o largo, al amanecer, al anochecer, al empezar o acabar el turno, en la
  iniciativa o al empezar el combate.
- **Legendarias** [O]: las acciones legendarias se reponen al empezar el combate y al acabar el turno de la criatura.
  Una resistencia legendaria se gasta desde la tirada de salvación fallida, que pasa a contar como superada.
- **Descanso** [O]: los PNJ descansan como los personajes, con la misma ventana.

### 4. El grupo y el encuentro de dnd5e

- **El grupo** [O]: un actor más, con miembros (otros actores), monedas, PX, inventario propio, efectos y una
  descripción. Su hoja tiene pestañas de miembros, inventario, efectos y biografía.
  - Desde el grupo se tiran las salvaciones o habilidades de todos y se descansa a la vez (con un mensaje para que
    cada uno lo confirme o, si se elige, directamente).
  - Su nivel, para los encuentros, es la media de los personajes.
  - Un ajuste del mundo marca cuál es el grupo principal.
- **Pasar cosas** [O]: un objeto se pasa arrastrándolo de una hoja a otra. Entre actores distintos, lo de serie es
  **copiar**; con Mayús se **mueve** (se borra del origen). Las monedas y los PX se reparten con una ventana de premio:
  a partes iguales o la cantidad a cada uno, entre los miembros de los que uno es dueño. Las monedas también se pasan
  entre un personaje y el grupo.
- **El encuentro** [O]: otro actor, con miembros por referencia (también entradas de un compendio) y, para cada uno,
  una cantidad fija o una fórmula que se tira al colocarlo («1d4+1 goblins»).
  - Suma sus PX y da su dificultad (baja, moderada o alta) frente al grupo principal, según su nivel medio y su número
    de criaturas.
  - Colocarlo en la escena importa al mundo lo que haga falta (reutiliza lo ya importado para esto) y crea las fichas.
    Según un ajuste, también las mete en el combate y tira su iniciativa.

### 5. Imágenes

- **Las criaturas no llevan imagen en sus datos** [O]: el manifiesto de dnd5e declara un mapa de arte que, al leer el
  compendio, pone a cada actor su retrato (una miniatura) y su ficha (con su escala: un dragón adulto, más grande). Lo
  cubre para 312 criaturas del SRD 5.1, 350 actores de 2024 y 12 héroes de ejemplo. El máster puede apagar por paquete
  los retratos, las fichas o las imágenes de los objetos, y el mapa lleva un crédito para el autor. Como el arte se
  pone al leer la entrada, la copia que se importa al mundo se queda con esas rutas [I].
- **Lo que trae el zip** (137 MB) [O]:

  | Carpeta | Qué | Cuánto | Licencia, según sus avisos |
  | --- | --- | --- | --- |
  | Fichas | Retratos y fichas de criaturas y héroes, en webp | 99 MB: 479 imágenes y 180 miniaturas | De Forgotten Adventures: solo dentro de Foundry |
  | Fichas compuestas | Anillos de las fichas | 1,5 MB | De Caeora: solo dentro de Foundry |
  | Iconos | De interfaz, estados, daños, actividades, clases, especies, monedas | 1,8 MB: 186 svg y 56 webp | Casi todos de game-icons.net y Noun Project (CC BY 3.0); los de estados, monedas y un daño, de mikiko.art (CC BY-NC-SA 4.0); los de escuelas de magia, de WotC (solo dentro de Foundry); los de niveles de conjuro, derivados de Rexard (solo dentro de Foundry) |
  | Ilustraciones | De clases, PNJ, vehículos y productos | 4,6 MB | De WotC: solo dentro de Foundry |

- **Las imágenes de los objetos y conjuros** [O]: en sus compendios, 2.900 de 3.145 (el 92 %) apuntan a los iconos de
  serie de Foundry, que no vienen en el zip y cuya licencia (de Rexard, vía Humble Bundle) también prohíbe usarlos
  fuera de Foundry. Solo apuntan a iconos del propio zip 245, casi todos de los conjuros y el equipo de 2024. En los
  actores de 2024 hay además 32 fichas que apuntan a un módulo de pago (el Monster Manual) que no viene en el zip.
- El código de dnd5e es MIT; sus imágenes, no [O].

## Compromisos y límites

- **La copia es independiente**: ganan sencillez y que el mundo no se rompa cuando se actualiza el sistema, pero las
  mejoras del original no llegan a las copias y no hay forma de verlas ni de traerlas.
- **El estado de una copia vive en la escena**: un goblin sin enlazar existe solo como ficha en un mapa. Sin escena no
  hay copias, y borrar la ficha borra sus PG. Para que algo dure hay que enlazarlo, y entonces todas sus fichas
  comparten estado (un PNJ «único» con dos fichas sería el mismo).
- **Copiar por defecto al arrastrar** evita perder cosas, pero en el inventario del grupo es fácil duplicar objetos
  sin querer: mover pide acordarse de Mayús.
- **Permisos por rol para todo el compendio**: no hay forma de enseñar a los jugadores una criatura y ocultar otra del
  mismo compendio, salvo repartirlas en dos.
- **Imágenes atadas a Foundry**: casi todo el arte que se ve en dnd5e no puede salir de Foundry por licencia, y gran
  parte ni siquiera viaja en el zip.
- **Mucha automatización depende del combate** (recargas, legendarias, usos por turno): fuera de un combate, va a mano.

## Qué nos llevamos a Crisol

### Propuestas, por prioridad

Coste aproximado en días de trabajo, con pruebas y revisión.

| # | Qué | Traer o imitar | Cómo | Coste |
| --- | --- | --- | --- | --- |
| 1 | **El compendio del mundo**, la tercera capa | Imitar | El contenido de hoy es del sistema de la cuenta. Que pueda ser también de un mundo, hecho para un sistema y visto por sus campañas con ese sistema. Copiar una entrada del sistema o de la cuenta al mundo (y del mundo a la cuenta) con un id nuevo y **su origen guardado**. El del sistema no se cambia en la campaña: se copia y se cambia la copia, como el aviso de Foundry | 3–4 |
| 2 | **Ver y traer los cambios del original**, que Foundry no tiene | Mejorar | Con el origen guardado: «el original ha cambiado» en la copia, las diferencias por campo y traerlas todas o algunas | 2 |
| 3 | **Criaturas en juego en la campaña, sin escena**: única o copia | Imitar el modelo, no el sitio | Un registro por campaña: la entrada del compendio (referencia), si es única o copia, su nombre («Goblin 2») y **solo lo que cambia** (PG, temporales, usos, estados, legendarias, notas), con su historial. La única dura entre sesiones y es a la que enlaza la wiki; las copias se quitan al acabar o se descartan juntas. Al crearla, PG medios o tirados (lo elige la campaña). El módulo 6 las pondrá en el mapa | 4–6 |
| 4 | **La hoja de la criatura** con los bloques de la de personaje | Imitar | Cabecera (CA, PG, VD, iniciativa), características y salvaciones, sentidos, idiomas y resistencias, y las acciones agrupadas por cómo se activan, cada una con su tirada. Contadores de legendarias y de guarida; «recargar» con su dado; gastar una resistencia legendaria desde la salvación fallida | 4–5 |
| 5 | **Aplicar daño desde la tirada** a una o varias criaturas en juego (o a personajes) | Imitar | En el registro de tiradas, «aplicar» con nada, mitad, entero o doble por objetivo, y con resistencias, inmunidades y vulnerabilidades. Reutiliza `playCharacter` | 2–3 |
| 6 | **Poner varias a la vez**: «3 goblins» o «1d4+1 goblins» | Imitar el encuentro, solo esa parte | La cantidad o su fórmula al poner en juego. Los encuentros guardados con PX y dificultad, con la iniciativa (módulo 6) | 1 |
| 7 | **El inventario del grupo** | Imitar, con «dar» en lugar de arrastrar | Por campaña: objetos (del compendio o escritos) con cantidad, monedas y PX. «Dar a…» mueve a un personaje (y de vuelta), sin duplicar. Repartir monedas y PX a partes iguales o a cada uno. Lo ven y cambian el máster y los jugadores | 3–4 |
| 8 | **Las imágenes de lo traído de Foundry** | Traer, con su licencia | Leer el mapa de arte del manifiesto (retrato y ficha con su escala), no solo el `img` de cada documento. Resolver las rutas dentro del zip; las de serie de Foundry no vienen, así que usar un icono propio por tipo. Leer los avisos de licencia de cada carpeta y enseñarlos al importar (en dnd5e serían unas 760 «solo para Foundry», unas 125 CC BY 3.0 y 33 CC BY-NC-SA), con el crédito guardado en cada imagen. Miniatura para las listas y la grande para la hoja. Necesita subir el zip entero y convertirlo en segundo plano | 3–4 |
| 9 | **Quién ve cada colección** del compendio del mundo | Imitar, más fino | Por colección (o por entrada), «lo ven los jugadores» o «solo el máster». De serie, las reglas sí y las criaturas no. Va con el módulo 5; hasta entonces, solo el máster | 1–2 (con el 5) |

Orden propuesto: 1 y 3 primero (sin ellas no hay nada que jugar); 4 y 5 juntas (la hoja y el daño); 7 aparte; 8 con
la subida del zip en segundo plano; 2, 6 y 9 cuando estén las otras.

### Qué no traer

- Ninguna imagen de serie de Foundry ni las de su sistema con licencia «solo dentro de Foundry», salvo que las importe
  quien usa Crisol desde su propio zip, para su uso privado (ADR-0014) y con su aviso. Las CC BY-NC-SA de los estados y
  las monedas tienen una licencia que `CONSTRAINTS.md` no admite en el producto: nunca de serie.
- Las fichas en la escena como único sitio del estado (eso es de la mesa, módulo 6).
- El arrastrar con teclas para elegir entre copiar y mover.

### Qué haremos distinto

- El estado de las criaturas en juego, en el servidor y con historial y deshacer, sin depender de una escena; el mapa
  lo enseñará después.
- Una criatura única es única por campaña, no «enlazada»: la wiki enlaza a ella y no hay dos fichas que la compartan
  por accidente.
- La copia de una entrada sabe de dónde viene y avisa cuando su original cambia.
- La visibilidad, por colección o por entrada, no por rol para todo el compendio.

## Sin comprobar

- Nada se vio en marcha: no se arrancó Foundry. Lo de importar con el retrato del mapa, los PG tirados en la copia y
  que borrar la ficha pierda su estado sale del código.
- Cómo quedan los enlaces de una tabla de un compendio de mundo a entradas de otros compendios al importarla.
- Cómo se ve en pantalla el nivel «limitado» de un compendio.
- Las licencias son las de los avisos del zip; no se comprobó cada imagen una a una ni lo que cubren las fichas de los
  módulos de pago.

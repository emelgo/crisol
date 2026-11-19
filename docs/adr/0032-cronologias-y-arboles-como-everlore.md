# ADR-0032: Cronologías y árboles como en Everlore (enmienda la decisión 2 del ADR-0031)

Estado: aceptada (Enrique, 2026-11-19, tras probar las pestañas nuevas: «no puede ser que en todas las cronologías
salgan todos los eventos… revisar Everlore»; «las relaciones se hacen a mano, ya que puede haber hijastros etc., entonces
no lo dejes fijo»; «¿qué diferencia hay entre organigrama y árbol?») · Enmienda: la decisión 2 del ADR-0031 («los eventos
sueltos siguen siendo del mundo… cada cronología los junta según su filtro»). El resto del ADR-0031 sigue igual.

## Contexto

Con el ADR-0031 las cronologías ya eran pestañas, pero sus eventos seguían siendo del mundo: cada cronología los juntaba
todos (salvo un filtro por grupos) y, además, todas las páginas con fecha. Dos cronologías de una misma partida se veían
iguales. Everlore (la app anterior de Enrique, al estilo LegendKeeper) lo resuelve así: cada evento pertenece a una línea
temporal (`timeline_events.tab_id`), con sus grupos (`timeline_groups.tab_id`, los carriles del Gantt, con «Sin grupo»
fijo al final y «+ Nuevo grupo» en la esquina de los nombres), y un evento puede enlazar una página (sin que la página
salga sola). Sus vistas: Lista, Gantt (año, mes, día, hora) y Calendario.

En los árboles, Crisol tenía dos pestañas («Árbol genealógico» y «Organigrama») que eran la misma con otro dibujo y
otros tipos de línea fijos (padre o madre, pareja; miembro, dirige), y deducía líneas: el hijo de alguien con una sola
pareja pasaba a ser hijo de los dos. Everlore tiene una sola pestaña («Genealogía»): nodos (una página o solo un
nombre) y líneas que se dibujan a mano (de abajo arriba, padre e hijo; de lado, pareja), sin deducir ninguna, «Añadir
persona» en su barra y «Ordenar árbol».

## Decisión

1. **Cada evento y cada grupo es de una cronología** (`timeline_events.chronology_id` y `timeline_groups.chronology_id`,
   que se van con ella). Quitar la pestaña quita sus eventos y sus grupos en la misma operación (deshacer los devuelve);
   duplicar la página los copia (a una plantilla, solo los grupos: las fechas son de los calendarios del mundo). Un
   evento se puede pasar a otra cronología del mundo (`updateTimelineEvent` con `chronologyId`, sin grupo salvo que se dé
   uno de allí). El tope de eventos sigue siendo por mundo; el de grupos, por cronología.
2. **Las páginas con fecha solo salen si la cronología lo pide** («Juntar también las páginas con fecha», con sus
   plantillas y etiquetas). El filtro pierde los grupos. Una cronología nueva nace sin nada.
3. **La vista grande de un calendario junta los eventos de todas** (cada entrada con su `chronologyId`) y las páginas con
   fecha. Su «Evento» pregunta a qué cronología va: un desplegable con las del mundo (primero las que usan ese
   calendario) y «Una nueva…», que crea una página con su pestaña (sin ninguna, es lo propuesto, «Cronología»).
4. **En Meses**, «+ Nuevo grupo» va en la esquina de los nombres (como en Everlore) en vez de en una fila debajo; los
   nombres de los carriles son opacos al desplazarse; «Sin grupo» sale solo si queda algo sin grupo (sin grupos, un
   carril «Eventos»).
5. **Quién lo ve**: un evento cuelga, para «quién lo conoce» y para revelar, de la página de su cronología (antes no
   colgaba de ninguna).
6. **Migración (0093)**, sin copiar eventos: cada uno va a la primera cronología (por fecha de creación) que lo pedía en
   su filtro de grupos; si no, a la primera que los juntaba todos; si no, a la primera del mundo (y en un mundo con
   eventos y sin cronologías, a una página «Cronología» nueva, oculta como lo estaban ellos). Cada grupo se queda en la
   primera que lo usa (por sus eventos o su filtro) y cada otra que lo usaba se lleva una copia con sus eventos. El filtro
   que no se había acotado por plantillas ni etiquetas deja de juntar las páginas con fecha.
7. **Un solo árbol** (pestaña `tree`, «Árbol»; fuera «Organigrama» y la columna `trees.layout`, migración 0092): un
   organigrama es un árbol con líneas «dirige» y «miembro de». **Las líneas se hacen a mano, una a una, y no se deduce
   ninguna.** Sus tipos no son fijos: padre o madre, padrastro o madrastra, adopción, pareja, expareja, hermanos, dirige,
   miembro de y otra con su nombre (encima, debajo o al lado). En la ficha del nodo, «Padre o madre», «Pareja», «Hijo o
   hija» y «Otra relación» (un desplegable con todas); «Añadir persona» (suelta), en una píldora abajo en el centro, como
   el «+» de la cronología. El dibujo solo pinta lo que hay (dos que comparten un hijo no salen como pareja si nadie lo ha
   dicho); las que no son de sangre ni de pareja, con raya discontinua y su nombre. Las libres cuentan en el grafo con su
   nombre (sin papel).

## Consecuencias

- Lo que una cronología enseña es lo suyo: «Historia del reino» y «Las guerras» ya no se repiten.
- Tras la migración, una cronología que juntaba todo puede haberse quedado sin los eventos que fueron a otra (no se
  copian para no duplicar): se pasan con «cambiar_evento» o desde el cuadro del evento en la vista grande del calendario.
- La que mostraba las páginas con fecha sin acotarlas deja de hacerlo: se vuelve a pedir en sus ajustes.
- Deshacer una operación de eventos o grupos de antes de la migración puede fallar (sus filas no llevaban cronología): se
  acepta, como en el ADR-0031.
- Las herramientas MCP conservan sus nombres; `crear_eventos` y `cambiar_grupos_eventos` piden `chronologyId`.

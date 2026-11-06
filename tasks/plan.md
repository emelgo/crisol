# Plan: Módulo 5 — revelar

Estado: en marcha (2026-11-06). Spec: `docs/specs/revelar.md` · ADR-0017 · Mapa: `docs/specs/modulo-5.md` · Diseño:
lienzo «Crisol: lo que ven los jugadores», tableros Revelar y Jugador (`out/lienzo-jugadores/`) · Tareas:
`tasks/todo.md`. Los planes anteriores, en `tasks/<capacidad>/`.

## Cómo

- **Revelar** (`reveal`, tipo `players`): una marca «la conocen» en la campaña (toda o unos personajes) de un secreto,
  una página, una pestaña, un pin o una entrada del mundo, y, si se pide, también de su página («Revelar también la
  página»), en una sola operación (`reveal`, con su frase). Sin campaña y con una sola en el mundo, esa. A diferencia de
  `setKnowledge` (preparar, en silencio), avisa.
- **Lo nuevo** (`knowledge_news`, migración 0052, fuera del historial): una fila por jugador al que le aparece algo que
  antes no veía (se calcula con el motor antes y después, para cada jugador de la campaña), con la página donde está.
  Se borra al abrir esa página (`seeNews`) y al ocultarlo otra vez. El aviso en tiempo real (`revealed`) solo a esas
  cuentas, con el título de la página (o de la sección del secreto: ya lo ven).
- **Ocultar otra vez** (`hide`): quita la marca de la campaña; si con eso lo siguiera viendo (por el mundo o su madre),
  la pone en «no la conocen».
- **Lo que sabe el grupo** (`listCampaignKnowledge`): las marcas de la campaña, de la más reciente a la más antigua, con
  qué es (y su página), a quién y cuándo; aparte, las del mundo si la campaña parte de él.
- **Los secretos de una página** (`getSecretsKnowledge`): para cada secreto, quién lo conoce en cada campaña, para su
  cabecera («Secreto · Revelar» o «Lo saben: Lía y Bram · Cambiar»).
- **Web**: «Revelar» en la cabecera de un secreto (y en la de la página) con su desplegable (campaña, toda o
  personajes, «Revelar también la página»); «Revelado» en la barra de la campaña del máster, que abre «Lo que sabe el
  grupo» como ventana; el aviso del jugador («Nuevo: El pacto de Varn», con «Leerlo»), lo nuevo marcado en su árbol y en
  la página, y el número en la barra.
- **IA**: `revelar`, `ocultar`, `lo_que_sabe`.

## Puntos de control

1. Tras el servidor: por la API, revelar un secreto a Lía le llega a su dueña (aviso y lo nuevo) y a nadie más;
   ocultarlo se lo quita; deshacer.
2. Tras la web: revelar desde el secreto y verlo llegar en la ventana de la jugadora; «Lo que sabe el grupo».
3. Al final: e2e, fugas (el aviso no lleva nada de lo que no ve), revisión.

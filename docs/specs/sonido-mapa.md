# Spec: sonidos en el mapa (módulo 7)

Capacidad `sonido-mapa` del módulo 7 (`docs/specs/modulo-7.md`). Se apoya en `sonido` y en los muros de `vision`
(que ya tienen «tapa el sonido»). Estudio: `research/foundry/sonido.md` § sonidos en el mapa. Secundaria (Enrique).

## Objetivo

Que una escena tenga sonidos en su sitio (una cascada, una fragua) que se oyen más fuertes cerca y que los muros tapan.

## Comportamiento

- **Un sonido de escena**: un punto del mapa con su pista (archivo o del mundo), radio en casillas, volumen, suavizado
  (se apaga poco a poco hacia el borde o se oye igual hasta él) y si los muros que tapan el sonido lo **frenan** (no
  pasa) o lo **amortiguan** (pasa más bajo y apagado). Siempre en bucle. Opcional: solo con la escena a oscuras.
- **Del mundo** (preparación, como los muros y las luces); encender y apagar uno es de cada campaña.
- **Quién lo oye**: en la Pantalla, desde las fichas del grupo (la más cercana manda); en la Mesa de un jugador, desde
  su ficha (o las suyas); en la del máster, desde el centro de su vista (o silenciado, a su elección). Se calcula en
  cada aparato con el núcleo de la mesa (`packages/tabletop`), con los muros que tapan sonido.
- **El editor**: en la Mesa, una herramienta más (como las luces): poner, mover, cambiar el radio y ajustar.
- Los volúmenes del aparato (ambiente) mandan también sobre estos.

### IA (MCP)

`poner_sonido_escena`, `cambiar_sonido_escena`, `quitar_sonido_escena`.

## Contratos (propuesta)

- Tabla `scene_sounds` (con historial, del mundo) y su encendido por campaña en el estado de la mesa.
- `packages/tabletop`: la atenuación (radio, suavizado, muros que frenan o amortiguan) como función pura.

## Pruebas

- Unitarias: atenuación por distancia y suavizado; un muro que frena; uno que amortigua.
- Integración: crear, mover, encender por campaña; el MCP.
- Web: la herramienta y el volumen según la ficha.

## Criterios de éxito

1. Acercar la ficha sube el volumen y un muro que frena lo corta.
2. Sin coste que se note en la Mesa con diez sonidos y cien muros.

# Spec: imagenes (módulo 4)

Estado: **en marcha** (2026-11-06). Tercera capacidad del módulo 4 (`docs/specs/modulo-4.md`). Estudio:
`research/foundry/criaturas-y-capas.md` § 5 y propuesta 8.

## Objetivo

Que el contenido **tenga cara**: el retrato de cada criatura y el icono de cada objeto, conjuro o rasgo, en el
compendio, en la hoja y en lo que está en juego. Las imágenes se traen de un zip de Foundry (las que vienen dentro, con
su licencia y su crédito) o se suben a mano para una entrada propia. Lo que no tiene imagen lleva un icono por tipo.

Para quién: el máster que trae un sistema de Foundry o hace su contenido; quien lee el compendio o juega.

## Requisitos

- **Traer las imágenes con el zip de Foundry** (decidido al planearlo, 2026-11-06): el navegador ya abre el zip para
  elegir compendios e idioma; con eso mismo saca las imágenes que nombran los documentos elegidos y, tras importar el
  sistema, las sube en tandas (`putSystemImages`). No hace falta subir el zip entero (137 MB el de dnd5e) ni convertirlo
  en segundo plano; el avance se ve en la misma ventana.
- **Qué imágenes**: las de cada documento (`img`), y para los actores el retrato del **mapa de arte del manifiesto**
  (`flags.compendiumArtMappings`: de dnd5e salen así 674 criaturas con imagen), con su crédito. Solo las que vienen dentro del zip: las rutas a lo que
  trae Foundry de serie (`icons/…`, el 92 % de los objetos y conjuros de dnd5e) no se pueden traer y llevan el icono
  del tipo.
- **La licencia de cada imagen**: se leen los avisos de licencia de cada carpeta del zip (el `LICENSE` más cercano; si
  nombra el archivo, su línea) y,
  antes de importar, se enseña cuántas imágenes van con cada licencia («760 solo para usar en Foundry», «125 CC BY
  3.0»…), con la opción de no traer las que no se quieran. Cada imagen guarda su crédito y su licencia, que se ven en
  la entrada. Lo «solo para Foundry» o de pago, solo para uso privado (ADR-0014), y nunca de serie en Crisol.
- **Dónde viven**: con el sistema (o el mundo) al que pertenece su entrada, en el almacenamiento de archivos, sin pasar
  por la lista de archivos del mundo. Se sirven a quien puede leer esa entrada. Al borrar el sistema o la entrada, se
  purgan con la papelera.
- **Tamaños**: una miniatura (para las listas y la tarjeta) y la grande (la hoja); la ficha redonda, para la mesa del
  módulo 6, se guarda aparte.
- **Subir una imagen** a una entrada propia (del mundo o de un sistema de la cuenta) desde su editor, o elegir una de
  los archivos del mundo.
- **El icono por tipo**: cada tipo del sistema puede decir su icono (`icon`, ya en el formato); si no, uno por clase
  de documento.
- **La IA**: leer la imagen de una entrada (su dirección y su crédito) y ponerle una de los archivos del mundo.

## Decisiones (propuestas del estudio, por confirmar al ver las pantallas)

1. **Por defecto se traen todas** las del zip, con el aviso de licencias delante; quitar las «solo para Foundry» es una
   casilla.
2. **Las imágenes no cuentan** en la cuota de archivos del mundo, por ahora (el SaaS de pago lo decidirá).
3. **Sin `sharp`**: lleva libvips, que es LGPL, y `CONSTRAINTS.md` no admite LGPL en producción. Las imágenes se
   guardan como vienen (las de Foundry ya suelen ser WebP) y la miniatura se hace con un codificador en wasm de
   licencia permitida (jSquash, Apache-2.0, sobre libwebp, BSD), comprobado antes de añadirlo; si no vale, sin
   miniaturas.

## Pruebas

- `packages/systems`: leer el mapa de arte, resolver las rutas dentro del zip, agrupar por licencia.
- Servidor: la conversión en segundo plano con un zip de prueba (avance, fallo, reintento), servir con permisos, la
  purga.
- Web: el aviso de licencias, el retrato en la entrada, la hoja y la lista, el icono por tipo.
- E2E: traer un zip de prueba con imágenes y verlas en el compendio de la campaña.
- A mano (`tasks/probar.md`): el dnd5e real entero.

## Fuera

Las escenas, los mapas, las fichas en la mesa y los sonidos (módulos 6 y 7); los iconos de serie de Foundry; editar
imágenes.

# Investigación

Aquí van las notas de lo aprendido estudiando **Foundry VTT** y **D&D Beyond**, con craft-anything desde el
2026-11-03 (antes, con REA, que ya no se usa). Enrique tiene licencia de los
dos. El objetivo es entender cómo abordan los problemas para diseñar los nuestros, no reproducirlos.

También se estudia **Homebrewery** (`naturalcrit/homebrewery`), por sus hojas con estilo y su PDF. Su código es MIT: a
diferencia de Foundry y D&D Beyond, se puede aprovechar en `apps/` o `packages/` con su aviso de copyright, una
cabecera con el origen y el commit en cada archivo derivado, y su entrada en las notas de terceros. Sus fuentes e
imágenes, no: varias son CC BY-SA o no traen licencia (ver `research/homebrewery/hojas-y-pdf.md`). Su nota sigue el
mismo formato y es igualmente prosa propia.

Para el módulo 2 se estudian además **Kanka**, **LegendKeeper** y **World Anvil** solo por su web pública
(documentación, ayuda, changelogs, blogs y foros), sin cuenta y sin abrir su código, que en Kanka es copyleft (ver
`research/kanka/`, `research/legendkeeper/` y `research/worldanvil/`).

## Desde el ADR-0014 (2026-11-05)

Crisol es, de momento, de uso privado: el código, los textos y los datos de lo estudiado se pueden llevar a `apps/` y
`packages/` cuando sirvan, con su origen marcado y su entrada en `docs/terceros.md`. Estas notas siguen siendo prosa
propia, y las reglas de abajo valen para lo que se escribe aquí.

## Reglas de sala limpia

1. Solo prosa propia, tablas y diagramas propios. **Nunca** código, pseudocódigo descompilado literal, textos, datos,
   nombres de archivos internos copiados en bloque, imágenes ni recursos de ellos.
2. Describe el *qué* y el *por qué* (problema, enfoque, compromisos, límites que se notan), no el *cómo* línea a línea.
3. El código de `apps/` y `packages/` nunca importa ni lee nada de `research/` (lo comprueba una prueba en CI).
4. Ningún contenido de pago (reglas, monstruos, aventuras de D&D Beyond) entra en Crisol. Reglas: solo SRD.
5. En D&D Beyond solo se lee y se observa con la sesión de Enrique: no se cambia nada de su cuenta.

## Formato de cada nota

`research/<fuente>/<tema>.md`, por ejemplo `research/foundry/vision-y-niebla.md`:

```markdown
# <Tema> en <Fuente>

Módulo de Crisol: <n.º y nombre> · Fecha: AAAA-MM-DD · Versión estudiada: <versión>

## Pregunta
Qué queríamos saber.

## Lo que hacen
Resumen con nuestras palabras.

## Compromisos y límites
Lo que ganan, lo que pierden, problemas visibles.

## Qué nos llevamos a Crisol
Ideas, y qué haremos distinto.
```

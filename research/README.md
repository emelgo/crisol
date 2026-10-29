# Investigación (REA)

Aquí van las notas de lo aprendido estudiando **Foundry VTT** y **D&D Beyond** con REA. Enrique tiene licencia de los
dos. El objetivo es entender cómo abordan los problemas para diseñar los nuestros, no reproducirlos.

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

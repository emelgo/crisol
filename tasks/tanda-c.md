# Tanda C de la carga del D&D 2024 (ADR-0033, decisiones de Enrique del 2026-11-20)

Rama `sistemas/tanda-c`. Lo pidió la IA al preparar el D&D 2024 (puntos 9, 10 y 11).

## 9 · Acciones con opciones (los rayos oculares del contemplador)

Decidido: «Elegir, o tirar si lo dice».

- Formato (`mechanics.actions[]`): `options` (hasta 20), cada una `{ key, label, attack?, save?, damage?, heal?,
  range? }`; `count` (cuántas se usan, por defecto 1); `distinct` (distintas cada vez); `pick` (una fórmula, `1d10`:
  sale la opción de ese puesto, desde 1).
- Dominio (`actions.ts`): `prepareAction` con `option` arma esa opción como si fuera la acción (lo suyo encima de lo
  de la acción); la vista de la acción lleva sus opciones ya armadas (su CD, su daño).
- Tirar: `rollForCreature`, `rollContentAction` y `rollForCharacter` aceptan `action.option`.
- Web: al pulsar una acción con opciones, se elige cuál (o «Tirar 1d10», que tira `pick` y marca la que sale) y se
  tira esa.

## 10 · Tope en un aumento elegido (los dones épicos, +1 hasta 30)

- Formato: `grants[].choose.max` (fórmula): lo elegido no pasa de ahí al aplicar `op: add`.
- Dominio: al aplicar la elección en el creador y en la hoja.

## 11 · Conjuros de las criaturas

Decidido: «Estructurado y con usos».

- Formato: `mechanics.spellcasting = { label?, ability, dc?, attack?, groups: [{ label?, uses?, spells: [clave o
  concepto] }] }`. Sin `uses`, a voluntad; con `uses`, N al día cada uno (vuelven con el descanso largo).
- Vista: en el bloque de la criatura, con los conjuros enlazados al compendio.
- En la Mesa: «Lanzar» tira la acción del conjuro con la CD y el ataque de la criatura; los de N/día gastan un uso
  (estado de la criatura en juego) y vuelven al descansar.

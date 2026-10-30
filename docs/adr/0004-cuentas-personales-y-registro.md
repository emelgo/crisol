# ADR-0004: Cuentas personales y registro público; la organización, por debajo

Estado: aceptada (Enrique, 2026-10-30: «Vale») · Se construye con el módulo 11 (pagos y planes)

## Contexto

El módulo 0 empezó cerrado: un propietario con su organización (la crea el enlace de arranque) y los jugadores por
invitación, sin registro abierto hasta los pagos (ADR-0002). Al pulir la interfaz, Enrique preguntó cómo será el alta
desde la futura landing: «¿como se puede saber la organizacion antes del registro? ¿Tiene sentido una organización?
Cada usuario tendrá su cuenta y en el momento del registro como en una serie de pasos eligirá si es jugador o master o
ambas cosas».

## Decisión

- **Cada cuenta tiene su espacio**: al registrarse se le crea una organización propia, de la que es propietaria. Nadie
  elige ni ve una organización al registrarse. En ese espacio van sus mundos, su plan y su cuota de almacenamiento.
- **La organización se queda en el modelo de datos**, por debajo. Más adelante podrá haber **grupos** opcionales: un
  club, una tienda o una asociación con varios másteres que comparten mundos. Solo entonces se verá en la interfaz.
- **El registro, en pasos**:
  1. la cuenta: nombre y apellidos, nombre de usuario (el que se ve en la app), email y contraseña repetida, con su
     seguridad; aceptar condiciones y privacidad; verificar el email;
  2. «¿Qué vas a hacer en Crisol?»: dirigir, jugar o las dos. Es una **preferencia** que guía los primeros pasos, no
     un permiso. Los roles siguen siendo por mundo y por campaña;
  3. primeros pasos: el primer mundo o pegar el enlace de invitación.
- **La pantalla de arranque se queda para instalar** Crisol en un servidor nuevo (la primera cuenta de la
  plataforma). El registro público reutiliza sus campos (`NewAccountFields`) y su diseño.

## Alternativas descartadas

- **Quitar la organización y colgar los mundos de la cuenta**: lo de hoy es más sencillo, pero los grupos, los planes
  compartidos y las cuotas por espacio pedirían más adelante una migración de todos los datos.
- **Elegir o crear una organización al registrarse**: obliga a entender un concepto que a quien juega o dirige no le
  sirve de nada.

## Consecuencias

- **Antes de abrir el registro hacen falta**:
  - correo saliente para verificar el email (ADR-0002);
  - las condiciones y la privacidad;
  - protección contra abusos (límites, quizá un reto);
  - los planes del módulo 11.
- **Las funciones del propietario** (historial, papelera, conectar la IA) pasan a ser de cada cuenta en su espacio.
- **Hay que revisar** cómo entra un jugador en la campaña de otro espacio: hoy queda como miembro de la organización
  del máster. Lo natural será que le baste con pertenecer a la campaña.

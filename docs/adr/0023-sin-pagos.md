# ADR-0023: Sin pagos ni planes

Estado: aceptada (Enrique, 2026-11-11, en la revisión de la app: el módulo 11 se descarta; Crisol es una herramienta
propia, gratuita y de uso privado)

## Contexto

El catálogo de módulos (`docs/modulos.md`) cerraba con el 11, «Pagos y planes del SaaS», pensado para cuando Crisol se
vendiera. Desde el ADR-0014 Crisol es de uso privado: lo usan Enrique y sus jugadores, y no se distribuye. El código no
tiene nada de pagos, planes ni cuotas por cuenta.

## Decisión

- **No se hacen pagos ni planes.** Crisol es gratis para quien entra.
- **Se mantienen las cuentas personales** (ADR-0004), cada una con su espacio: los jugadores siguen necesitando la suya
  para entrar en una campaña.
- **Una cuenta nueva solo se crea con una invitación.** El registro público del ADR-0004 (sus pasos, el plan y la
  cuota de cada espacio) no se hace. La portada no ofrece registrarse; dice «Tengo una invitación» (tanda 5 de la
  revisión).
- **Los límites que haya son técnicos**, no comerciales: tamaño de lo que se sube, tipos de archivo permitidos y
  demás protecciones del servidor. No dependen de ningún plan.

## Consecuencias

- El módulo 11 queda descartado y no se diseña nada pensando en planes: ni contadores de uso por cuenta, ni funciones
  de pago, ni avisos de «mejora tu plan».
- Si algún día Crisol se vendiera, habría que hacer pagos y planes, abrir el registro y repasar lo traído de terceros
  (ADR-0014, `docs/terceros.md`). Las normas que lo dejan posible siguen: nada de dependencias copyleft y el origen de
  cada cosa traída anotado.

# ADR-0024: Las plantillas, páginas guardadas como modelo

Estado: aceptada (Enrique, 2026-11-11: aprobó el plan de la revisión, `tasks/plan-revision.md`); se construye en la
tanda 3. Sustituye parte del ADR-0009.

## Contexto

Hoy una plantilla (ADR-0009) es una ficha aparte, `page_templates`: nombre, icono, campos, bloques del panel y un
esqueleto en Markdown. No lleva portada, ni hoja, ni pestañas, y su editor es una pantalla propia que no se parece a la
página. Hay plantillas de serie en el código (`BUILT_IN_TEMPLATES`) y las de la cuenta en la base.

En la revisión de la app, Enrique pidió:
- plantillas con mapa, línea temporal y demás («¿plantillas de mapa, cronológicas…?»);
- fuera las plantillas de serie: cada cuenta hace las suyas;
- carpetas para ordenarlas;
- ~~«Desde plantilla» también en «Pestaña nueva».~~ (retirado el 2026-11-12: ver la decisión 5)

Además, «Duplicar» una página hoy son cuatro pasos sueltos en el navegador que se dejan la portada, la hoja y las
pestañas, y no se deshacen de una vez.

## Decisión

1. **Duplicar es una acción del servidor** (`copyPage`): copia portada, hoja, propiedades, panel, texto y pestañas en
   una sola operación, que se deshace de una vez. **Cada tipo de pestaña aporta su forma de copiarse** (un registro de
   tipos de pestaña, el mismo que usará la interfaz).
2. **Una plantilla es una página de verdad**, guardada en **un mundo oculto de la cuenta**: no sale en Mis mundos, no
   admite campañas ni lo que sabe una campaña, y no cuenta en búsquedas ni tablas de los mundos. `page_templates` se
   queda como su ficha: la página que es, su carpeta, su orden y su linaje.
3. **Su editor es la vista de la página** en modo plantilla: portada, icono en el título, pestañas, panel y texto,
   como cualquier página; sin «quién la conoce», marcadores ni «Mencionado en»; y con el editor de campos en lugar de
   sus valores. Lo que se sube al editarla va a los archivos comunes (ADR-0005), para que se vea en todos los mundos.
4. **Crear desde una plantilla es duplicarla** en el mundo, soltando lo que apunta a páginas concretas. Cada pestaña
   guarda **la estructura y el estilo, no los enlaces**: un mapa, su escala y sus pines de ejemplo sin enlazar (y sus
   capas cuando lleguen); una línea temporal, su calendario, sus eras y sus carriles, sin eventos; una pizarra, su
   disposición inicial. No hay «tipo de plantilla»: se ve qué pestañas trae.
5. ~~**«Desde plantilla» en «Pestaña nueva»** añade a una página las pestañas de una plantilla.~~ **Retirado el
   2026-11-12** (Enrique: «me choca lo de usar una plantilla en una pestaña, la plantilla solo al crear una página»):
   fuera de «Pestaña nueva», la acción `addTemplateTabs` y su herramienta del MCP. **Fuera «Aplicar plantilla»** a una
   página ya hecha (el ADR-0009 lo permitía).
6. **Sin plantillas de serie.** Antes de quitarlas, un barrido convierte en propias de cada cuenta las que estén en
   uso, **con los mismos ids de campo y el mismo linaje**, para que las tablas que se llenan solas («Miembros»,
   «Habitantes») den lo mismo antes y después.
7. **Carpetas de plantillas** (`template_folders`), con el árbol común de la tanda 2.

Del ADR-0009 se queda lo demás: campos con id, la forma del campo en la página, el linaje en la página y las tablas
calculadas en el servidor.

## Alternativas descartadas

- **Seguir con la ficha aparte y añadirle portada, hoja y pestañas**: dos formas de guardar lo mismo, y cada novedad de
  la página (pizarra, línea temporal) habría que hacerla otra vez en la plantilla.
- **Plantillas por tipo de pestaña** («plantilla de mapa», «de línea temporal»): una página puede tener varias pestañas
  y entonces no se sabe de qué tipo es.
- **Guardar las plantillas como páginas en cada mundo**: se repetirían en todos y no se verían desde Inicio.
- **Conservar las de serie como ejemplo**: Crisol viene vacío (ADR-0015) y cada máster hace lo suyo; lo de serie
  estorba al quitar, renombrar o adaptar.

## Consecuencias

- Migraciones: el mundo oculto de cada cuenta, la página de cada plantilla (las que hay hoy se convierten: su
  esqueleto pasa a ser su texto) y `template_folders`; el barrido de las de serie en uso.
- Se va el código de las de serie (dominio, servidor, web, i18n, tutorial, MCP y pruebas) y el editor de plantillas
  propio; las herramientas MCP de plantillas y sus instrucciones cambian (tanda 9).
- Lo que el servidor haga por mundo (búsqueda, papelera, historial, exportar, lo que sabe una campaña) tiene que
  saltarse el mundo oculto, con su prueba.
- Las pestañas nuevas (pizarra, línea temporal, árbol: módulos 8–10) nacen en el registro y con su forma de copiarse.

## Notas de la construcción (2026-11-12)

- Las carpetas (`template_folders`, migración 0079) son como las de archivos: color, icono, puesto a mano y nombre que
  no se repite entre hermanas. Borrar una se lleva lo que tiene (sus plantillas, borradas; sus páginas no cambian), de
  una vez. Acciones `createTemplateFolder`, `updateTemplateFolder`, `deleteTemplateFolder` y `moveTemplate`.
- La plantilla, como la da la API (`templateView`), lleva su carpeta, su puesto y lo de su vista previa: la portada de
  su página, sus pestañas y en cuántas páginas se usa.
- Su nombre es el título de su página: `updatePage` comprueba que no se repita. Lo que se sube a su mundo oculto va a
  los archivos comunes.

# ADR-0033: Tokens de acceso personales para las cargas grandes

Estado: aceptada (2026-11-20, a raíz de lo que pidió la IA al empezar a pasar contenido al Crisol oficial) · Amplía el
ADR-0030 (conectores de IA) y el ADR-0025 (libros).

## Contexto

Al pasar un sistema entero (miles de entradas, en dos idiomas, con sus libros, capítulos e imágenes) o la wiki de Eana
con sus imágenes y mapas, el conector MCP no da abasto: cada entrada tendría que escribirse en la conversación. La IA
puede ejecutar programas que llamen a la API, pero `/api/actions` solo aceptaba la sesión de la web (una cookie). Las
imágenes de un sistema (`system_images`, el `img` de cada entrada) solo se subían desde la web al importar un zip de
Foundry, los capítulos no podían incrustarlas, y el archivo de un sistema tenía un tope de 10 MB.

## Decisión

- **Tokens de acceso personales**, en Ajustes › IA, para quien crea mundos: nombre, caducidad fija (7, 30, 90 o 365
  días), como mucho 20 por cuenta. `crisol_pat_` y 32 bytes al azar; se guarda solo su huella (SHA-256) y su principio
  para reconocerlo. El token entero se ve una vez, al crearlo. «Quitar» lo borra y deja de valer al momento. Crearlos y
  quitarlos es un ajuste de la cuenta (como el modo de IA): no pasa por el historial.
- **`Authorization: Bearer crisol_pat_…`** vale en `POST /api/actions/*` (también en las acciones grandes) y en las
  subidas de archivos (`/api/files`), **como la cuenta que lo creó, con sus permisos de ahora** (las pertenencias se
  leen en cada petición). Un token que no vale da 401 aunque la petición lleve también la cookie.
- Lo que se hace con un token **queda en el historial como hecho por la IA**, con `token «nombre»` como herramienta, y
  se deshace como lo demás.
- **No sigue el modo de IA**: quien lo crea lo da por aprobado (las aprobaciones de una en una no sirven para un
  programa que manda miles). Para limitarlo, no se crea o se quita.
- Con un token no se ven, crean ni quitan tokens, ni se cambia el modo, ni se aprueba, ni se quitan conexiones (`UI_ONLY`:
  solo desde la web).
- **Se descartó el plugin de claves de Better Auth** (`@better-auth/api-key`, aparte del núcleo en la 1.7): una tabla
  propia (`api_tokens`) es poco código, no añade dependencia y encaja con nuestro `actorFrom`.
- **Imágenes en los capítulos**: en el texto de un capítulo, `![[ruta]]` (con texto alternativo, ancho y pie, como en la
  wiki) es una imagen del sistema del libro por su ruta, no un archivo del mundo. Si falta, se dice. Se suben con
  `putSystemImages` (ya existía; ahora cualquiera, no solo las de un zip de Foundry), por la misma ruta.
- **Imágenes del sistema, también por el MCP** (`subir_imagenes_sistema`, `ver_imagenes_sistema`,
  `borrar_imagenes_sistema`): listarlas por carpeta y quitarlas por su ruta (con sus bytes; no se deshace).
- **La portada de un libro puede ser una imagen del sistema** (`cover.image`, su ruta) en vez de un archivo de los
  comunes (`cover.fileId`): una de las dos.
- **Libros y capítulos solo para el máster** (`master` en una fuente del sistema o en un capítulo; migración 0095): a
  quien no dirige la campaña no le llegan esos capítulos (ni en la lista, ni al pedirlos, ni en la cuenta del libro);
  las entradas del compendio de ese libro, sí. Viaja en el archivo del sistema.
- **El archivo de un sistema, hasta 64 MB** (antes 10): un sistema con sus libros en dos idiomas pasa de 30 MB. Se
  descartó bajarlo libro a libro: subir un archivo con `into` reemplaza el sistema entero.

## Consecuencias

- Un token robado vale como la cuenta hasta que caduca o se quita: por eso la caducidad es obligatoria y corta por
  defecto (30 días), y la lista dice su último uso (apuntado como mucho una vez por minuto).
- Las instrucciones del MCP explican a la IA que, para lo que no cabe en la conversación, puede pedir un token.
- El tope de documentos de contenido por sistema sube de 5000 a 20 000 (la IA ya llevaba 3264 con cinco libros).

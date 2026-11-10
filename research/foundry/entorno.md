# Entorno de estudio de Foundry VTT

Instalado 2026-10-29 con la licencia de Enrique, solo para el REA (ver `research/README.md`).

- Versión: Foundry VTT 14.369 (Node, requiere Node ≥ 24.13.1). Sistema dnd5e 6.0.6 (MIT). Mundo de pruebas
  `crisol-rea` («Crisol REA»), usuario Gamemaster sin contraseña.
- Programa en `/opt/rea-targets/foundry/app` (de solo lectura, legible para REA), datos en
  `/opt/rea-targets/foundry/data` (usuario `foundry`, grupo `admin`).
- Puerto 30000. Foundry escucha en todas las interfaces (no deja elegir), pero UFW deniega la entrada salvo 22/80/443 y
  no hay sitio en Caddy: solo se llega desde el propio VPS.
- Arranque (no hay servicio de systemd): `cd /opt/rea-targets/foundry/app && sudo runuser -u foundry -g admin -- env
  HOME=/opt/rea-targets/foundry node main.js --dataPath=/opt/rea-targets/foundry/data --port=30000 --noupnp --noupdate`
- Navegador para REA: Foundry 14 exige Chromium ≥ 146 y una ventana de al menos 1366×768. El Chromium por defecto de
  REA es el 145, así que en `capture_browser_scenario` hay que pasar
  `executable_path: /home/admin/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome` (Chromium 153) y un
  `viewport` de 1920×1080. Sin GPU, el lienzo usa WebGL por software.
- EULA (versión 11.293): permite instalar y usar, prohíbe publicar partes del software, revenderlo o alojar más de una
  instancia accesible a otros por licencia. No prohíbe estudiarlo. Por eso aquí no va ni una línea de su código.
- Datos de prueba (REA del módulo 0, 2026-10-29): usuario «Jugador REA» (rol jugador; su contraseña no se guarda aquí),
  entrada de diario «Secreto REA» (solo máster) y unos mensajes de chat de prueba.
- Datos de prueba (REA del módulo 1, 2026-10-29): usuaria «Jugadora Wiki REA» (rol jugador; su contraseña no se
  guarda aquí), la carpeta «REA Wiki» con subcarpetas y cinco entradas de diario con páginas, categorías, secretos,
  enlaces e incrustados («Liga Secreta» ya borrada).
- Observar sin navegador: basta un script de Node con el cliente de socket.io que trae la propia instalación (MIT),
  guardado fuera del repo, para entrar como cualquier usuario y ver todo lo que llega por la red. El POST de entrada
  exige la cabecera `Origin` del mismo sitio.
- Datos de prueba (estudio del módulo 5, visibilidad, 2026-11-06): jugadores «Vis Pícara» y «Vis Guerrero» (rol
  jugador; sus contraseñas no se guardan aquí); la carpeta de diario «Vis Visibilidad» con «Vis Cripta» (ninguno, y
  luego observador para la pícara), «Vis Torre» (limitado, con una página de imagen), «Vis Taberna» (observador, con
  un secreto, ya revelado, y la página «Sótano» en ninguno), «Vis Gremio» (solo la pícara) y «Vis Enlaces» (enlaces a
  todo lo anterior); los PNJ «Vis Goblin» (ninguno), «Vis Ogro» (limitado) y «Vis Asesino» (ninguno, ficha y
  combatiente ocultos); los compendios del mundo «Vis Bestiario» (rol jugador: ninguno), «Vis Objetos» (limitado) y
  «Vis Reglas» (observador, con una carpeta y una entrada con una página en ninguno); la escena «Vis Mapa» (ahora la
  activa del mundo, sin visión, con ocho pines, las tres fichas y un combate) y «Vis Mapa Niebla» (con visión, un pin
  con «global» y otro sin él). El combat tracker sigue los PG (ajuste del mundo) y el goblin quedó
  a 3 de 7 PG, con su estado «Bloodied».
- Datos de prueba (estudio del módulo 6, la mesa, 2026-11-07): jugadores «Mesa Jugadora» y «Mesa Otro» (rol jugador;
  sus contraseñas no se guardan aquí); los personajes «Mesa Heroína» y «Mesa Enana» (de «Mesa Jugadora») y los PNJ
  «Mesa Goblin», «Mesa Acechador» y «Mesa Esqueleto»; la escena «Mesa Cripta» (sin activar: 19 muros con una puerta
  normal abierta, una secreta cerrada y los cinco tipos especiales; las luces «Mesa Antorcha», «Mesa Luz oculta»,
  «Mesa Luz que da visión» y «Mesa Oscuridad»; cinco fichas, el acechador oculto), con la niebla explorada de «Mesa
  Jugadora»; la escena vacía «Mesa Banco de pruebas» (60×60 casillas); los compendios del mundo «Mesa Zip Escenas»
  (las escenas «Mesa Zip Moderna» y «Mesa Zip Antigua») y «Mesa Zip Aventuras» (la aventura «Mesa Zip Aventura», con
  los actores «Mesa Zip Goblin» y «Mesa Zip Jefe», el diario «Mesa Zip Diario», la carpeta «Mesa Zip Carpeta», el
  efecto «Mesa Zip Apresado» y las regiones «Mesa Zip Cono» y «Mesa Zip Terreno»).
- Datos de prueba (estudio del módulo 7, sala de jugadores, 2026-11-10): jugadores «Sala Ana» y «Sala Bruno» (rol
  jugador; sus contraseñas no se guardan aquí); unos mensajes de chat de prueba (un susurro de Ana a Bruno y dos
  públicos de Ana); la lista «Sala Música» (pistas «Tambores», «Dados» y «Tono»), con el archivo
  `worlds/crisol-rea/audio/sala-tono.wav` (un tono de 90 s generado para la prueba); la escena «Sala Sonidos» (sin
  activar, con la lista asociada y los sonidos del mapa «Sala Río» y «Sala Grillos») y los compendios del mundo «Sala
  Zip Música» (la lista) y «Sala Zip Aventura» (la aventura con la escena y la lista). El turno del combate de «Vis
  Mapa» se movió y se devolvió a su estado.

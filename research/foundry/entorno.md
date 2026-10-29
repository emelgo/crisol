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

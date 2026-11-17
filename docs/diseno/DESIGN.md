# Sistema de diseño — Administración Deportiva

v2.2 · Dirección **"Cancha"**. Estado: **aplicado** en toda la app desde la v2.0 (login, estructura, inicio y los 13 módulos). La v2.1 agregó las estadísticas propias de cada deporte y la v2.2 solo documenta y corrige.

Fuente de verdad: `frontend/src/index.css` (tokens y componentes) y `frontend/src/config/deportes.js` (perfil visual de cada deporte). Capturas actuales en `docs/diseno/capturas/`; las de la dirección anterior (v1.3, inspirada en el portal) quedan en `docs/diseno/capturas/v1.3/` y su prototipo en `docs/diseno/prototipo/` como referencia histórica.

## 1. El encargo

| | |
|---|---|
| **Qué es** | Herramienta interna para gestionar los equipos deportivos de la Universidad Simón Bolívar, sede Cúcuta: plantel, entrenamientos, asistencia, partidos, estadísticas, salud y antropometría. |
| **Quién la usa** | Entrenadores, personal de salud y deportistas **desde el celular**, muchas veces en la cancha; administradores y head coach **desde el computador**. |
| **Pedido de la v2.0** | "Cambiar totalmente el frontend y hacerlo más alusivo a lo que trata el proyecto": que se sienta como una herramienta deportiva y no como un formulario administrativo, sin perder la identidad de Unisimón (verde y logos oficiales). |
| **Regla principal** | Cada pantalla debe parecer parte de un partido: marcadores, fixture, planilla de asistencia, tabla de líderes. El deporte activo cambia íconos, colores, posiciones, formato del resultado y estadísticas. |

## 2. De dónde sale cada decisión

| Elemento | Origen |
|---|---|
| Verde noche de cancha (`--cancha-900` `#07291A`) | El césped de noche bajo reflectores. Conserva el verde institucional, pero oscuro, para el menú y los banners. |
| Líneas de cancha (`--lineas-cancha`) | Círculo central, línea media y franjas de corte de césped dibujadas con degradados CSS sobre el menú lateral, el login y el marcador. No son imágenes. |
| Acento lima (`--lima` `#B5F23D`) | Pintura de demarcación y los marcadores electrónicos. Solo sobre fondos oscuros (cifras, opción activa). |
| **Barlow Condensed** (títulos y cifras) | Tipografía condensada de dorsales, marcadores y camisetas. Se lee bien en mayúsculas y en cifras grandes. |
| **Barlow** (texto) | Misma familia, versión normal, para que títulos y texto combinen. |
| Naranja (`--naranja` `#F59E0B`) | Una sola acción destacada por pantalla ("Tomar asistencia", "Nuevo partido"). Viene del portal oficial. |
| Logos oficiales | Horizontal y apilado en blanco; monograma U en el celular. Sin cambios respecto a la v1.3. |
| Íconos **Font Awesome 6** | Los mismos del portal; cada deporte tiene el suyo (`fa-futbol`, `fa-basketball`, `fa-volleyball`…). |

## 3. Tokens

### Color

| Token | Hex | Uso |
|---|---|---|
| `--cancha-950` / `--cancha-900` / `--cancha-800` / `--cancha-700` | `#04170D` / `#07291A` / `#0B3522` / `#10472E` | Menú lateral, login, banners y marcadores. |
| `--verde` | `#0A7F39` | Botón principal (contraste 5,0:1 con blanco). |
| `--verde-hover` / `--verde-vivo` / `--verde-texto` | `#086A2F` / `#12A150` / `#0A6B31` | Hover, estado "presente" y enlaces. |
| `--lima` / `--lima-suave` | `#B5F23D` / `#E8FBC6` | Acento sobre oscuro; fondo de la fila destacada. |
| `--naranja` / `--naranja-texto` | `#F59E0B` / `#1F1300` | Acción destacada (texto oscuro: contraste AA). |
| `--oro` / `--plata` / `--bronce` | `#E3A008` / `#94A3B8` / `#B7712E` | Podio de líderes y medallas. |
| `--fondo` | `#F1F4EE` | Fondo de página, color "tiza" con un toque verde. |
| `--tinta` / `--texto` / `--texto-suave` | `#0F1C15` / `#1B2A21` / `#55665C` | Títulos, texto y texto secundario. |
| `--borde-claro` / `--borde-fuerte` / `--superficie-2` | `#DCE3D9` / `#C3CDC0` / `#F7F9F5` | Bordes y superficies secundarias. |
| Estados | ok `#E3F6E9/#116030`, aviso `#FFF4DB/#7A4A00`, error `#FDE8E7/#A3261F`, info `#E4F1FB/#1D5F8C` | Disponible, con restricciones, lesionado o error, información. Siempre con ícono. |
| `--deporte` | Color del deporte activo | Se define en cada componente con el color del perfil (`deportes.js`). |

Las variables de versiones anteriores (`--accent`, `--verde-panel`, `--text-primary`…) siguen existiendo y apuntan a los tokens nuevos, para no romper estilos de módulos que las usan.

### Tipografía

- **Barlow Condensed** 500–800 (y cursiva 700–800): títulos de página, cifras, marcadores, dorsales, encabezados de tabla y menú. En mayúsculas con espaciado `.03em` a `.22em`.
- **Barlow** 400–700: texto, formularios y tablas. Cuerpo de 15 px; 16 px en campos táctiles (evita el zoom de iOS).
- Cifras siempre con `font-variant-numeric: tabular-nums`, para que los marcadores no "bailen".
- Respaldo: `Arial Narrow` y `Segoe UI`, si las fuentes de Google no cargan.

### Forma y profundidad

Radios de 8, 10, 14 y 20 px (`--radius-sm` a `--radius-xl`). Sombras teñidas de verde noche (`--shadow-sm`, `--shadow-md`, `--shadow-lg`) y una sombra verde para el botón principal (`--shadow-accent`). Áreas táctiles mínimas de 44 px.

### Interacción

| Estado | Regla |
|---|---|
| Hover | Solo con mouse: toda regla `:hover` va dentro de `@media (hover: hover) and (pointer: fine)`. Nada esencial depende del hover. |
| Presionado | Botones, fichas y opciones de menú ceden al presionar (`transform: scale(0.97)`). Sin destello gris del toque. |
| Foco de teclado | Anillo de dos tonos (`:focus-visible`), visible sobre blanco, tiza y verde noche. |
| Deshabilitado | Opacidad reducida y cursor `not-allowed`. Los botones de guardar muestran "Guardando…". |
| Táctil | Con `@media (pointer: coarse)`: objetivos de al menos 44 px y campos de 16 px. Nunca se bloquea el zoom. |

### Estados de cada pantalla

Componente único: `frontend/src/components/EstadoVista.jsx`. Cada pantalla distingue **cargando** (esqueleto con la forma del contenido, aparece tras 150 ms), **error** (motivo y botón Reintentar; nunca se presenta como "no hay datos"), **sin datos** (qué falta y la acción real si el rol puede hacerla) y **filtro sin resultados** (botón para limpiar el filtro). Nunca emojis.

### Tablas anchas

Las tablas con muchas columnas usan `tabla-movil`. En celular (menos de 720 px) quedan las columnas clave; las demás (`col-sec`) se resumen en una línea bajo el nombre o se ven en la ficha. Las de consulta ocasional (`col-ter` o `col-ancha`) se ocultan por debajo de 1280 px. En tableta (720–1279 px) el relleno de celdas baja a 10 px para que quepan sin desbordar.

La tabla de líderes de estadísticas muestra en celular y tableta solo la métrica elegida en **"Ordenar por"**; en computador, todas las métricas del deporte.

### Movimiento

`--dur-rapida` 120 ms (hover y presionado), `--dur-media` 200 ms (menús y modales), `--dur-lenta` 320 ms (cambios grandes); la hoja "Más" y los modales en celular suben en 300 ms con `--curva-hoja`. Solo se animan `transform` y `opacity`. Con `prefers-reduced-motion: reduce` no hay transiciones, salvo un fundido corto en modales y hojas. No se animan el menú, las pestañas ni la navegación con teclado.

## 4. Estructura

### Computador (≥ 1024 px)

```
┌────────────────┬─────────────────────────────────────────────────────┐
│ LOGO UNISIMÓN  │  [ícono] INICIO / módulo actual          🔔  (CD)   │  barra superior translúcida
│ ADMIN. DEPORT. ├─────────────────────────────────────────────────────┤
│ [⚽ Deporte ▾] │  ENCABEZADO DE PÁGINA (título condensado + acciones) │
│                │                                                     │
│ COMPETENCIA    │  ┌── Marcador: próximo partido (verde noche) ──┐    │
│  Inicio        │  │  UNISIMÓN   VS   RIVAL · fecha · lugar       │    │
│  Equipos       │  └──────────────────────────────────────────────┘    │
│  Deportistas   │  [Disponibilidad] [Asistencia] [Deportes y cat.]    │
│  Entrenamientos│                                                     │
│  Asistencia    │                                                     │
│  Partidos      │                                                     │
│  Estadísticas  │                                                     │
│ SALUD Y REND.  │                                                     │
│  Lesiones …    │                                                     │
│ GESTIÓN        ├─────────────────────────────────────────────────────┤
│  Usuarios      │  PIE: logo apilado · Administración Deportiva       │
│ (CD) César · ⏻ │                                                     │
└────────────────┴─────────────────────────────────────────────────────┘
```

Menú lateral de 268 px en verde noche con las líneas de la cancha, agrupado en **Competencia**, **Salud y rendimiento** y **Gestión**; cada rol ve solo sus módulos. Arriba del menú está el **selector de deporte** (o una insignia fija "Tu deporte" si el usuario tiene uno solo). Abajo, el usuario con su rol y el botón para salir.

### Celular (≤ 1023 px)

Barra superior verde noche con el monograma, "Deportes Unisimón" y, debajo, **nombre · rol** del usuario (observación del tester en la v1.9). Contenido en una columna y **menú inferior fijo** con las secciones principales de cada rol más **Más**, que abre una hoja con el resto de módulos, el selector de deporte y Cerrar sesión.

### Login

Pantalla dividida: a la izquierda (o arriba, en celular) la portada verde noche con las líneas de la cancha, el logo y el nombre del sistema; a la derecha el formulario. Se entra con el **usuario corto** (`admin1`) o con el correo. En la v2.1 se quitó de la portada la lista de deportes, a pedido del equipo.

## 5. Componentes propios del deporte

| Componente | Dónde | Qué hace |
|---|---|---|
| Selector de deporte | Menú lateral y hoja "Más" | Filtra toda la app por deporte. Cambia el ícono y el color (`--deporte`). |
| Marcador | Inicio y Partidos | Próximo partido o resultado con las cifras en Barlow Condensed sobre verde noche. |
| Fixture | Partidos | Lista de partidos por fecha; el resultado se escribe según el deporte: marcador (2 - 1), sets (3 - 1), tiempo o marca y puesto. |
| Planilla de asistencia | Asistencia | Una ficha por deportista con dorsal; cada toque lo marca presente o ausente y se guarda al instante. "Todos presentes" y "Todos ausentes" guardan el plantel completo de una vez. |
| Rejilla de deportes | Estadísticas | Una tarjeta por deporte con su ícono, color y número de deportistas y registros. |
| Tabla de líderes | Estadísticas | Podio (oro, plata, bronce) y columnas con las métricas propias del deporte elegido. |
| Catálogo de métricas | Estadísticas | Explica qué mide cada deporte. Los totales derivados (puntos del rugby, medallas) se calculan solos. |

### Perfil de cada deporte

Definido en `frontend/src/config/deportes.js` (visual) y `backend/config/metricas_deportes.js` (estadísticas). El deporte se reconoce por su nombre, sin tildes ni mayúsculas; un deporte nuevo que cree el administrador usa el perfil genérico.

| Deporte | Resultado | Estadísticas propias |
|---|---|---|
| Fútbol y fútbol sala | Marcador (goles) | Goles, asistencias, tarjetas amarillas, tarjetas rojas, minutos |
| Baloncesto | Marcador (puntos) | Puntos, rebotes, asistencias, robos, faltas personales, minutos |
| Rugby | Marcador (puntos) | Tries, conversiones, penales, drops, pases de try, tackles, minutos · puntos calculados (5/2/3/3) |
| Voleibol | Sets | Puntos, aces, bloqueos, recepciones, errores de saque, sets jugados |
| Béisbol y sóftbol | Marcador (carreras) | Carreras, hits, carreras impulsadas, jonrones, ponches (y bases por bolas en béisbol) |
| Natación y atletismo | Tiempo o marca y puesto | Pruebas, medallas de oro, plata y bronce, finales, mejores marcas · medallas calculadas |
| Tenis | Sets | Partidos ganados, sets, juegos, aces, dobles faltas |
| Ajedrez | Marcador (puntos del torneo) | Victorias, tablas, derrotas |
| Balonmano | Marcador (goles) | Goles, asistencias, paradas, exclusiones de 2 min, minutos |
| Hockey | Marcador (goles) | Goles, asistencias, tarjetas verdes y amarillas, minutos |
| Cualquier otro | Marcador | Puntos o anotaciones, asistencias, minutos |

## 6. Qué cambió respecto a la v1.3

| v1.3 (inspirada en el portal) | v2.0 en adelante ("Cancha") |
|---|---|
| Header blanco con pestañas en fila y franja naranja | Menú lateral verde noche con líneas de cancha, agrupado por tema |
| Roboto | Barlow Condensed y Barlow |
| Paneles con encabezado verde estilo Bootstrap | Tarjetas blancas sobre fondo tiza, marcadores y fixture |
| La misma tabla de estadísticas para todos los deportes | Estadísticas, posiciones, íconos y formato de resultado propios de cada deporte |
| Asistencia en tabla con casillas | Planilla de fichas con dorsal, un toque por deportista |
| Fechas mostradas un día antes en Colombia | Fechas tratadas como texto, sin desfase (DEF-040) |

## 7. Historial de decisiones

| Versión | Dirección | Resultado |
|---|---|---|
| 1 | Reinterpretación propia: Zilla Slab + Fira Sans, fondo blanco minimalista. | **Rechazada** por Carlos: no se parecía a las plataformas de la universidad. |
| 2 (v1.3) | Lenguaje visual de Unisimón medido en sus plataformas, modernizado. | **Aprobada** y aplicada en la v1.3. |
| v1.5 | Estados de interacción por dispositivo, tokens de movimiento y foco de dos tonos. Sin emojis. | Aprobada (se conserva en la v2). |
| v2.0 | **"Cancha"**: verde noche con líneas de cancha, Barlow Condensed, marcadores, fixture y planilla; cada deporte con su perfil. | **Pedida por el equipo** ("cambiar totalmente el frontend y hacerlo más alusivo al proyecto") y aplicada. |
| v2.1 | Estadísticas propias de cada deporte con rejilla de deportes y tabla de líderes; se quita la lista de deportes del login. | Aplicada a pedido del equipo. |

## 8. Calidad mínima

Se verifica con Playwright en 360, 390, 768 y 1440 px (celular y tableta con emulación táctil): sin scroll horizontal · objetivos táctiles ≥ 44 px · foco visible con teclado · `prefers-reduced-motion` respetado · contraste AA · estados de carga, vacío y error en cada módulo.

## 9. Capturas

Tomadas en la v2.2 con los datos de demostración (`npm run demo`), a 1440 × 900 en computador y en un iPhone 13 emulado.

| Pantalla | Computador | Celular |
|---|---|---|
| Inicio de sesión | `capturas/login-pc.png` | `capturas/login-celular.png` |
| Inicio del entrenador (marcador y disponibilidad del plantel) | `capturas/inicio-entrenador-pc.png` | `capturas/inicio-entrenador-celular.png` |
| Inicio del administrador | `capturas/inicio-admin-pc.png` | `capturas/inicio-admin-celular.png` |
| Partidos (fixture) | `capturas/partidos-pc.png` | `capturas/partidos-celular.png` |
| Asistencia (planilla) | `capturas/asistencia-pc.png` | `capturas/asistencia-celular.png` |
| Estadísticas de todos los deportes | `capturas/estadisticas-deportes-pc.png` | `capturas/estadisticas-deportes-celular.png` |
| Estadísticas del entrenador (su deporte) | `capturas/estadisticas-entrenador-pc.png` | `capturas/estadisticas-entrenador-celular.png` |
| Hoja "Más" del celular | — | `capturas/menu-mas-celular.png` |

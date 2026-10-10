# Sistema de diseño — Administración Deportiva

Borrador v1.3, versión 2. Autor: Carlos Gamboa. Estado: **en revisión** (no aplicar al código hasta aprobarlo).

Prototipo: `docs/diseno/prototipo/login.html` y `dashboard.html` (abrir en el navegador; `login.html?error` muestra el estado de error). Capturas en `docs/diseno/capturas/`.

## 1. El encargo

| | |
|---|---|
| **Qué es** | Herramienta interna para gestionar los equipos deportivos de la Universidad Simón Bolívar, sede Cúcuta: plantel, entrenamientos, asistencia, partidos, salud y antropometría. |
| **Quién la usa** | Entrenadores, personal de salud y jugadores **desde el celular**; administradores y head coach **desde el computador**. |
| **Regla principal** | **Debe verse como parte de las plataformas oficiales de Unisimón** (portal estudiantil y unisimon.edu.co): misma tipografía, mismos verdes, misma estructura. Solo se moderniza lo que hoy funciona mal. |

## 2. De dónde sale cada decisión

Medido directamente en las plataformas (CSS publicado y capturas por píxel):

| Elemento | Origen |
|---|---|
| Tipografía **Roboto** | Fuente cargada por unisimon.edu.co (`fonts.googleapis.com/css?family=Roboto`). El portal usa la fuente por defecto de Bootstrap, que se ve igual de sobria. |
| Íconos **Font Awesome** | Los usan el portal (FA 5) y el sitio web (FA 6). |
| Verdes `#088732`, `#218D45`, `#148E40` | Encabezados de panel, botones y títulos del portal. |
| Verde noche `#00470A` | Banner/carrusel del portal. |
| Franja naranja + banda verde segmentada | Debajo del header del portal. |
| Naranja `#F0AD4E` | Botón destacado del portal ("Actualizar datos"). |
| Alertas y estados | Paleta Bootstrap que usa el portal (`#DFF0D8`, `#FCF8E3`, `#F2DEDE`, `#D9EDF7`). |
| Footer negro `#000` con líneas `#252525` | Portal y login. |
| Logos oficiales | Horizontal y apilado publicados por el portal; monograma U en `#09843B`. |

## 3. Tokens

### Color

| Token | Hex | Uso |
|---|---|---|
| `--verde-panel` | `#088732` | Encabezados de panel, pestaña activa, menú inferior activo. |
| `--verde-boton` | `#218D45` | Botón principal ("Iniciar sesión"), estado disponible. |
| `--verde-texto` | `#148E40` | Títulos verdes ("Iniciar sesión") y enlaces. |
| `--verde-noche` | `#00470A` | Banners con el logo en blanco. |
| `--verde-logo` | `#09843B` | Logo sobre fondo blanco. |
| `--naranja` | `#F0AD4E` | Una sola acción destacada por pantalla ("Tomar asistencia", "Ver partido"). |
| `--fondo` | `#EEEEEE` | Fondo de página (como el portal). |
| `--texto` | `#333333` | Texto principal. |
| `--borde` / `--pestana` / `--pestana-activa` | `#DDDDDD` / `#F8F8F8` / `#E7E7E7` | Bordes, barra de pestañas y pestaña activa. |
| `--negro` | `#000000` | Footer. |
| Estados | ok `#DFF0D8/#3C763D`, aviso `#FCF8E3/#8A6D3B`, error `#F2DEDE/#A94442`, info `#D9EDF7/#31708F` | Disponible, con restricciones, lesionado/error, información. Siempre con ícono. |

### Tipografía

**Roboto** 300/400/500/700 en toda la app. Títulos de panel 18 px bold blanco; texto 15 px; "Bienvenido" 24 px light (como el portal); nombre del sistema en mayúsculas con espaciado, igual que "SISTEMA DE INFORMACIÓN". Números con `tabular-nums`.

### Forma y profundidad

Radio 4 px (Bootstrap). Paneles con sombra y borde inferior gris, como el portal: `0 1px 3px rgba(0,0,0,.14), 0 4px 0 -1px #D2D2D2`. Banners verdes con degradados radiales sutiles para dar profundidad. Áreas táctiles mínimas de 44 px.

## 4. Estructura

### Computador (≥ 1024 px): igual al portal

```
┌──────────────────────────────────────────────────────────────┐
│ [LOGO UNISIMÓN] │ ADMINISTRACIÓN DEPORTIVA   Bienvenido (CD) CÉSAR │  header blanco
│▄▄▄▄▄▄▄▄▄▄▄ franja naranja + banda verde segmentada ▄▄▄▄▄▄▄▄▄▄▄│
│ Inicio │ Equipos │ Deportistas │ Entrenamientos │ …            │  pestañas
├─────────────────────────────────────────┬────────────────────┤
│ Banner verde noche: próximo partido     │ Mi sesión          │
│ [Disponibilidad del plantel] ▀ verde    │ (datos + botones)  │
│ [Asistencia] ▀ verde                    │ [Para revisar]     │
│                                         │ [Esta semana]      │
├─────────────────────────────────────────┴────────────────────┤
│ FOOTER NEGRO: logo apilado · Administración Deportiva · Portales │
└──────────────────────────────────────────────────────────────┘
```

### Celular (≤ 1023 px)

Header blanco compacto (logo + nombre del sistema + foto), franja, contenido en una columna (banner, disponibilidad, para revisar, esta semana, asistencia, mi sesión), footer negro y **menú inferior fijo** con 5 secciones por rol.

## 5. Qué se moderniza respecto al portal

| En el portal | En Administración Deportiva |
|---|---|
| 13 pestañas en fila, imposibles en celular | Pestañas en PC; menú inferior de 5 secciones en celular. |
| Guirnaldas de temporada sobre los encabezados | Encabezados verdes limpios. |
| Etiquetas de colores sin significado | Cada color es un estado y va con ícono. |
| "Ooooops" en estados vacíos | Mensajes que dicen qué pasó y qué hacer. |
| Bajo contraste en pestañas inactivas | Contraste AA en todo. |
| Página fija de escritorio | Diseño responsive verificado a 390 px y 1440 px. |

## 6. Historial de decisiones

| Versión | Dirección | Resultado |
|---|---|---|
| 1 | Reinterpretación propia: Zilla Slab + Fira Sans, fondo blanco minimalista, solo una franja fina como guiño a la marca. | **Rechazada** por Carlos: no se parecía a las plataformas de la universidad (otra tipografía, otros colores, sin footer negro, demasiado plana). |
| 2 | Lenguaje visual de Unisimón medido en sus plataformas, modernizado. | En revisión. |

## 7. Calidad mínima (se verifica con Playwright en 390 px y 1440 px)

Sin scroll horizontal · objetivos táctiles ≥ 44 px · foco visible con teclado · `prefers-reduced-motion` respetado · contraste AA · estados de carga, vacío y error en cada módulo.

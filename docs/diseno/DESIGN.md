# Sistema de diseño — Administración Deportiva

Borrador v1.3. Autor: Carlos Gamboa. Estado: **en revisión** (no aplicar al código hasta aprobarlo).

Prototipo: `docs/diseno/prototipo/login.html` y `dashboard.html` (abrir en el navegador). Capturas en `docs/diseno/capturas/`.

## 1. El encargo

| | |
|---|---|
| **Qué es** | Herramienta interna para gestionar los equipos deportivos de la Universidad Simón Bolívar, sede Cúcuta: plantel, entrenamientos, asistencia, partidos, salud y antropometría. |
| **Quién la usa** | Entrenadores, fisioterapeutas/personal de salud y jugadores **desde el celular**, muchas veces en la cancha y al sol. Administradores y head coach **desde el computador**. |
| **Su trabajo principal** | Responder rápido "¿quién está disponible, qué toca hoy y qué hay que revisar?" y registrar datos sin fricción. |
| **Debe sentirse** | De la familia Unisimón, pero claramente mejor hecha que los portales actuales. Seria, clara, deportiva sin disfrazarse. |

## 2. Fuentes de identidad (reales, no inventadas)

- **Monograma U** con la firma "Simón Bolívar": letra de bloque tipo *varsity* con doble contorno. Verde oficial del archivo: `#09843B`.
- **Franja de marca** del portal estudiantil: línea dorada sobre un degradado verde → verde azulado → azul.
- Plataformas de la universidad en modo claro, fondo blanco o gris muy claro.

Capturas de referencia guardadas fuera del repositorio (contienen datos personales).

## 3. Tokens

### Color

| Token | Hex | Uso |
|---|---|---|
| `--verde` | `#09843B` | Identidad, acciones principales, estado "disponible". Contraste con blanco 4.8:1. |
| `--verde-profundo` | `#00642D` | Texto de acento, botón presionado, navegación activa. |
| `--tinta` | `#12261B` | Texto principal (negro con matiz verde, ligado a la marca). |
| `--gris` | `#56665C` | Texto secundario, etiquetas de formulario. |
| `--linea` | `#DCE5DF` | Bordes y separadores. |
| `--campo` | `#EEF6F0` | Fondo de la zona protagonista de cada pantalla (la "cancha"). |
| `--blanco` | `#FFFFFF` | Fondo general y superficies. |
| `--oro` | `#F18700` | Advertencias y estado "con restricciones". Viene de la franja. |
| `--rojo` | `#C62828` | Lesionado, errores, acciones destructivas. |

**Franja de marca** (solo como firma, nunca como fondo de contenido): línea `#F18700 → #FFB31F` de 2 px sobre degradado `#00642D → #09843B → #00916F → #0CA8E3`.

Reglas: un solo color de acción (verde). Los estados nunca se comunican solo con color: siempre van con ícono o texto. Sin violeta, sin neón, sin degradados decorativos.

### Tipografía

| Familia | Rol | Por qué |
|---|---|---|
| **Zilla Slab** (600/700) | Nombre de la app, títulos de pantalla, números de camiseta y cifras grandes. | Serifa *slab*: eco directo de la letra de bloque del monograma U. Da carácter deportivo-universitario sin caer en tipografía de disfraz. |
| **Fira Sans** (400/500/600/700) | Todo el texto de interfaz, formularios y tablas. | Creada por Mozilla para leerse bien en pantallas de celular; es la pareja tipográfica oficial de Zilla Slab. Distingue l/I (la l tiene cola), cero normal y números tabulares para tablas. |

Escala (rem, base 16 px, razón ≈ 1.25): 0.8125 · 0.875 · 1 · 1.125 · 1.375 · 1.75 · 2.25 · 3. Interlineado 1.5 en texto, 1.15 en títulos. Números en tablas con `tabular-nums`. Títulos en *sentence case*; **nunca etiquetas en mayúsculas sostenidas**.

### Espaciado, forma y elevación

- Base 4 px: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64.
- Radios con jerarquía: 6 px controles y fichas, 12 px paneles. Fotos y avatares en cuadrado redondeado (parche de camiseta), no círculo.
- Sin sombras decorativas. Elevación solo para lo que flota: menú inferior, diálogos, desplegables.
- Áreas táctiles mínimas de 44 × 44 px.

## 4. Estructura

### Celular (≤ 768 px) — prioridad

```
┌────────────────────────────┐
│▀▀▀▀▀▀ franja ▀▀▀▀▀▀▀▀▀▀▀▀▀│
│ [U] Administración Dep. (CG)│  barra superior fija, compacta
├────────────────────────────┤
│ Buenos días, César          │
│ Sábado 10 de octubre [Rugby▾]│
│ ┌─ cancha (verde claro) ──┐ │  zona protagonista
│ │ 19 de 23 disponibles     │ │
│ │ [7][9][10][11][12][14]… │ │  plantel como dorsales
│ └──────────────────────────┘ │
│ Esta semana                 │  lista por fecha
│ Asistencia                  │
│ Para revisar                │
├────────────────────────────┤
│ Inicio Plantel Agenda Asist. Más │  menú inferior por rol
└────────────────────────────┘
```

### Computador (≥ 1024 px)

```
┌──────────┬───────────────────────────────────────────┐
│▀▀▀▀▀▀▀▀▀▀ franja ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀│
│ [U] Adm. │ Buenos días, César        [Rugby ▾]  (CG) │
│ Deportiva├───────────────────────────────┬───────────┤
│          │ cancha: disponibilidad        │ Esta      │
│ Plantel  │ (dorsales del plantel)        │ semana    │
│ Actividad├───────────────┬───────────────┴───────────┤
│ Salud    │ Asistencia    │ Para revisar              │
│ Admin.   │               │                           │
└──────────┴───────────────┴───────────────────────────┘
```

- Menú lateral **agrupado por dominio** (Plantel, Actividad, Salud, Administración): los grupos ordenan 12 módulos que en el portal de la universidad son 13 pestañas en fila.
- Contenido alineado a la izquierda, ancho máximo 1280 px; texto corrido ≤ 72 caracteres.

## 5. Principios

1. **La audacia está en un solo lugar:** la franja de marca y el monograma. Todo lo demás es sobrio.
2. **Cada pantalla tiene una "cancha":** la pregunta principal de esa pantalla va en la zona verde clara; el resto es apoyo.
3. **El plantel se ve como plantel:** jugadores representados por su dorsal, no por filas genéricas.
4. **Celular primero, de verdad:** se diseña a 390 px y se amplía; nada depende de pasar el mouse por encima.
5. **El color significa algo:** verde = disponible/acción, oro = con restricciones, rojo = lesión/error. Siempre con ícono o texto.
6. **Textos claros:** verbos concretos ("Guardar lesión", no "Enviar"), errores que dicen qué pasó y cómo seguir, estados vacíos que invitan a actuar. Sin "Ooooops".

## 6. Revisión contra lo genérico (decisiones corregidas)

| Primer impulso | Por qué era genérico | Decisión final |
|---|---|---|
| Dashboard con 4 tarjetas de cifras (jugadores, lesiones, partidos, entrenamientos) | Es la plantilla SaaS por defecto (y el diseño actual). | Zona protagonista con la **disponibilidad del plantel como dorsales**: responde la pregunta real del entrenador. |
| Tipografía deportiva condensada (tipo Barlow/Oswald) | Es lo que usa cualquier plantilla deportiva. | **Zilla Slab** ligada al monograma U. |
| Atkinson Hyperlegible para la interfaz | Probada en el prototipo: dibuja el cero tachado ("1Ø de octubre", "3:ØØ p. m.") y la versión de Google Fonts no trae alternativa. En fechas y horas en español parece un error. | **Fira Sans**: legible en celular, cero normal, números tabulares y misma familia de diseño que Zilla Slab. |
| Todo en tarjetas blancas con sombra sobre gris | "Kit de tarjetas SaaS". | Fondo blanco, secciones separadas por espacio y líneas; solo la "cancha" tiene fondo propio. |
| Login partido en dos con panel de color y logo gigante de marca de agua | Patrón de login por defecto. | Composición sobria: monograma real, nombre en slab, formulario; la franja como firma. |
| Avatares circulares, íconos Lucide | Elección por defecto de las IA. | Cuadrados redondeados tipo parche; íconos Phosphor con un solo grosor de trazo. |
| Etiquetas en mayúsculas sobre cada título, separadores con "·" | Plantilla de IA. | Títulos en *sentence case*, sin etiquetas decorativas. |

## 7. Calidad mínima (se verifica con capturas en 390 px y 1440 px)

Responsive sin scroll horizontal · foco visible con teclado · `prefers-reduced-motion` respetado · contraste AA · estados de carga, vacío y error en cada módulo.

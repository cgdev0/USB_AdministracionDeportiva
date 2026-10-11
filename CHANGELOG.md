# Historial de versiones

Registro de cambios y autoría de cada versión del sistema.
Cada versión está marcada con una etiqueta (tag) en el repositorio.

## v1.5 — Pulido y experiencia de usuario

**Autor:** Carlos Gamboa · **Etiqueta:** `v1.5`

Integra el pulido planificado (DEF-022 a DEF-026) con una mejora de la experiencia en celular y computador. Se entregó en 6 fases (PR #24 a #28).

Accesibilidad y contraste
- Colores con contraste AA: verde de botón `#1E7F3E`, verde de texto `#107233`, naranja con texto oscuro. El verde del logo y de los paneles no cambia.
- Botones de ícono con nombre para lectores de pantalla, selectores con etiqueta, tablas recorribles con el teclado y foco visible sobre cualquier fondo.
- En pantallas táctiles, todos los controles miden al menos 44 px y los campos usan letra de 16 px (evita el zoom de iOS).

Estados de cada pantalla
- Mientras carga se ve la forma del contenido, sin cifras falsas.
- Si el servidor falla, se explica el problema y hay un botón Reintentar en todas las pantallas.
- Estados vacíos con explicación y la acción que corresponde; "sin resultados del filtro" se distingue de "no hay datos".
- Sin emojis en la interfaz: solo íconos de Font Awesome.

Rendimiento
- Cada módulo se descarga al abrirlo y se precarga al pasar el mouse o tocar el menú. El inicio carga en 2,8 s con 4G lento (antes 5,7 s).

Movimiento e interacción
- El hover solo existe con mouse (ya no se queda pegado en el celular); los botones responden al presionar.
- La hoja "Más" y los modales en celular suben desde abajo; las gráficas animan en 250 ms; pulso breve al guardar un dorsal.
- Se respeta la preferencia de movimiento reducido. Revisión estricta con la skill `review-animations`: aprobada.

Responsive
- Deportistas y Estadísticas caben en celular y tableta sin deslizar de lado: columnas clave y el resto en la ficha.
- La ficha del deportista ofrece Editar y Eliminar.

Pruebas: 118 casos, 100 % aprobados; índice de calidad 100 en las 22 métricas medidas (faltan las 4 manuales). Informe: `docs/calidad/informes/v1.5.md`. Registro para auditoría: `docs/calidad/informes/v1.5-registro.md`.

## v1.4 — Seguridad

**Autor:** Carlos Gamboa · **Etiqueta:** `v1.4`

Corrige los 7 defectos de seguridad y robustez de la línea base (DEF-015 a DEF-021).

Contraseñas y sesiones
- Contraseñas con hash `scrypt` y sal propia (antes, una sola ronda de HMAC-SHA256). Los usuarios existentes no tienen que hacer nada: su hash se actualiza la primera vez que inician sesión.
- Secretos JWT sin valores por defecto en el código: en producción el servidor no arranca si faltan, son cortos o son iguales entre sí. Los tokens deben estar firmados con HS256.
- Tras 5 intentos fallidos para la misma cuenta, el inicio de sesión se bloquea 15 minutos.
- Un correo inexistente tarda lo mismo en responder que uno existente (no revela qué cuentas hay).

Datos de ejemplo sin contraseñas en el código
- `npm run seed` y `npm run demo` asignan una clave aleatoria (se muestra una sola vez) o la de `SEED_CLAVE_INICIAL`, y ya no sobrescriben usuarios existentes.
- Eliminado `seed_cloudsql.js` (obsoleto desde v1.2 y con contraseñas reales).

Errores claros y sin detalles internos
- Identificadores, filtros, fechas, valores de lista y referencias inválidas responden 400 con un mensaje para el usuario (antes, error 500).
- Los errores inesperados muestran un mensaje genérico; el detalle queda solo en la consola del servidor.
- Rangos válidos en la base (migración `004_valores_validos.sql`): edad, peso, altura, goles, asistencias, minutos y medidas no pueden ser negativos.
- Un cuerpo JSON mal formado responde 400.

Otros
- Cabeceras de seguridad (`nosniff`, `X-Frame-Options`, `Referrer-Policy`) y sin `X-Powered-By`.
- CORS limitado: mismo origen en producción, o los dominios de `FRONTEND_URL`.
- La configuración de la API está en un solo lugar (`api/index.js`); `server.js` y `backend/server.js` la reutilizan.

Pruebas: 106 casos (12 nuevos), 100 % aprobados. Informe: `docs/calidad/informes/v1.4.md`.

## v1.3.1 — Marco de calidad y pruebas

**Autor:** Carlos Gamboa · **Etiqueta:** `v1.3.1`

No cambia el funcionamiento del sistema: agrega cómo se evalúa su calidad.

Plan de calidad (ISO/IEC 9126) en `docs/calidad/`
- Requisitos del sistema (RF-01 a RF-19, RNF-01 a RNF-10).
- Características y subcaracterísticas relevantes, con su justificación.
- 26 métricas con fórmula, umbrales e instrumento, e índice de calidad global (meta ≥ 85).
- Plan de pruebas PP-AD-01: alcance, tipos de prueba, entorno, responsables y criterios de aceptación.
- Registro de defectos (26 registrados: 14 cerrados y 12 abiertos, programados para v1.4 y v1.5).

Pruebas automáticas en `pruebas/`
- 94 casos: unitarias, integración de la API contra PostgreSQL, robustez, seguridad, migraciones y navegador (Chromium, Firefox y WebKit).
- Recorrido de los 5 roles por los 13 módulos en 4 anchos de pantalla, accesibilidad con axe-core, objetivos táctiles, carga en 4G y caída del servidor.
- Base de pruebas aparte (`dt_deportivo_pruebas`): no tocan los datos de desarrollo.
- `npm test`, `npm run test:api`, `npm run test:ui` y `npm run test:reporte`, que genera el catálogo de casos y el informe con las métricas.

Línea base (informe `docs/calidad/informes/v1.3.1.md`)
- 92,6 % de aprobación (87 de 94; los 7 restantes son defectos conocidos).
- Índice global 67 de 100: funcionalidad y mantenibilidad en 100; usabilidad y fiabilidad son las prioridades.

Otros
- El servidor acepta la variable `PORT`.

## v1.3 — Administración Deportiva con identidad Unisimón

**Autor:** Carlos Gamboa · **Etiqueta:** `v1.3`

Identidad y diseño
- Nuevo nombre: Administración Deportiva (antes DTdeportivo).
- Diseño alineado con las plataformas de Unisimón: Roboto, Font Awesome, logos oficiales, franja de marca, paneles con encabezado verde, footer negro. Sistema documentado en `docs/diseno/DESIGN.md`.
- Login rehecho como el del portal estudiantil.
- Pestañas en computador y menú inferior con hoja "Más" en celular (antes, en celular no había forma de navegar).
- Inicio nuevo con datos reales: próximo partido, disponibilidad del plantel por dorsal, para revisar, agenda de la semana, asistencia, máximos anotadores, mi sesión (con cambio de contraseña) y gestión de deportes.
- Todos los módulos adoptan la paleta nueva; colores del tema oscuro corregidos (puntos de la somatocarta y textos de gráficas que quedaban invisibles).

Dorsal (número de camiseta)
- Columna `dorsal` (0 a 99), única por equipo; migración `003_dorsal.sql`.
- Se edita en la ficha, con un clic en la tabla de Deportistas y por CSV; aparece como "#7 Nombre" en todos los módulos.

Correcciones
- Asignar o quitar un equipo ya no borra el dorsal ni el entrenador del jugador (actualización parcial).
- El deporte por defecto es "Todos los deportes" (antes se elegía el primero y podía ocultar un plantel).
- Menú y permisos de las páginas salen de la misma configuración; el head coach puede consultar equipos.
- La búsqueda de Deportistas ya no ignora los filtros avanzados y permite buscar por dorsal.
- Un login con credenciales incorrectas ya no intenta refrescar la sesión.

Para el equipo
- `npm run demo` carga un plantel de ejemplo con fechas relativas a hoy.
- `HOST=127.0.0.1 npm run dev` limita el servidor a la propia computadora.

## v1.2 — PostgreSQL nativo

**Autor:** Carlos Gamboa · **Etiqueta:** `v1.2`

- Se elimina Firebase y el adaptador que traducía SQL a Firestore; el backend usa solo PostgreSQL con el driver `pg`.
- Se eliminan la configuración de Firebase con la API key expuesta y las reglas de Firestore abiertas.
- Esquema `database.sql` completo y ordenado, con todas las columnas que usa el código.
- Migraciones para bases existentes en `backend/migrations/`.
- Seguridad: antropometría y evaluaciones aceptan solo columnas válidas (antes era posible la inyección SQL).
- Comandos `npm run db:init` y `npm run seed`.

## v1.1 — Head Coach, Salud y filtros

**Autor:** Eder · **Correcciones:** Carlos Gamboa · **Etiqueta:** `v1.1`

Aporte de Eder:
- Rol Head Coach con panel de supervisión.
- Módulo de Salud: historias clínicas, controles médicos, seguimiento de lesiones y notificaciones.
- Asignación de entrenador por jugador y filtros en Deportistas.
- Visibilidad por rol en jugadores, lesiones y estadísticas.
- Migración SQL para roles y salud.
- Accesos de demostración en el login para desarrollo local.

Correcciones de Carlos:
- Rutas de Head Coach y Salud registradas en todos los servidores (antes daban 404 en Vercel).
- El login de demostración solo actúa si el backend no responde.
- Cada rol ve sus propias lesiones y no puede abrir las ajenas.

> El commit del aporte figura con autor Carlos Gamboa porque se integró desde su equipo; el trabajo de la v0.1 es de Eder.

## v1.0 — Versión original

**Autores:** grupo del proyecto · **Etiqueta:** `v1-original`

- Versión inicial de DTdeportivo: equipos, jugadores, entrenamientos, asistencia, partidos, estadísticas, lesiones, evaluaciones físicas y antropometría ISAK.

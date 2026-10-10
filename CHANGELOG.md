# Historial de versiones

Registro de cambios y autoría de cada versión del sistema.
Cada versión está marcada con una etiqueta (tag) en el repositorio.

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

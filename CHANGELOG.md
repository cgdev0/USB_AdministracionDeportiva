# Historial de versiones

Registro de cambios y autoría de cada versión del sistema.
Cada versión está marcada con una etiqueta (tag) en el repositorio.

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

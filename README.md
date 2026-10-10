# DTdeportivo

Plataforma web orientada a la gestión deportiva de la Universidad Simón Bolívar, sede Cúcuta.

> **Estado documentado:** esta guía describe lo que se identifica en el código de la versión entregada. La existencia de una pantalla no demuestra por sí sola que la operación esté integrada con la base de datos ni que sus permisos hayan sido probados de extremo a extremo.

## Tecnologías identificadas

- **Frontend:** React 18, Vite, React Router, Axios, Recharts y Lucide.
- **Backend:** Node.js/Express, controladores y rutas bajo `backend/`.
- **Datos:** PostgreSQL nativo (driver `pg`). Funciona con PostgreSQL local, Neon o Cloud SQL. Desde la v1.2 no se usa Firebase.
- **Acceso:** el frontend incluye contexto de autenticación y un menú que filtra opciones por rol. En modo desarrollo también contiene cuentas de demostración; estas no sustituyen una autenticación real ni prueban los permisos del backend.

## Módulos visibles en el frontend

| Módulo/página | Archivo |
|---|---|
| Inicio / Dashboard | `frontend/src/pages/Dashboard.jsx` |
| Equipos | `frontend/src/pages/Equipos.jsx` |
| Deportistas | `frontend/src/pages/Jugadores.jsx` |
| Entrenamientos | `frontend/src/pages/Entrenamientos.jsx` |
| Asistencia | `frontend/src/pages/Asistencia.jsx` |
| Lesiones | `frontend/src/pages/Lesiones.jsx` |
| Salud y controles | `frontend/src/pages/Salud.jsx` |
| Evaluaciones | `frontend/src/pages/Evaluaciones.jsx` |
| Partidos | `frontend/src/pages/Partidos.jsx` |
| Estadísticas | `frontend/src/pages/EstadisticasJugador.jsx` |
| Antropometría | `frontend/src/pages/Antropometria.jsx` |
| Usuarios | `frontend/src/pages/Usuarios.jsx` |
| Panel Head Coach | `frontend/src/pages/HeadCoach.jsx` |

## Roles contemplados

El frontend reconoce los roles `administrador`, `head_coach`, `entrenador`, `personal_salud` y `jugador`.

- **Administrador:** acceso administrativo y a la pantalla de Usuarios.
- **Head Coach:** panel de supervisión y vistas deportivas que aparecen habilitadas en el menú.
- **Entrenador:** vistas relacionadas con equipos y gestión deportiva.
- **Personal de salud:** vistas de salud, lesiones y evaluaciones que aparecen habilitadas.
- **Jugador:** vistas de consulta deportiva y personal habilitadas por el menú.

**Advertencia de seguridad:** el menú y las rutas protegidas del frontend no bastan para garantizar privacidad. Deben validarse también los permisos y filtros en el backend para cada endpoint, especialmente para datos médicos, antropometría, estadísticas y asistencia. La matriz definitiva de permisos debe actualizarse después de probar cada rol.

## Base de datos (PostgreSQL)

1. Crear una base vacía, por ejemplo `dt_deportivo`.
2. Copiar `.env.example` a `.env` y completar `DATABASE_URL` **o** las variables `DB_*`, además de `JWT_SECRET` y `JWT_REFRESH_SECRET`.
3. Crear el esquema y los usuarios base:

```bash
npm install
npm run db:init   # ejecuta backend/config/database.sql
npm run seed      # crea los usuarios de prueba
npm run dev       # API + frontend en http://localhost:3000
```

**Base existente de una versión anterior:** ejecutar en orden los scripts de `backend/migrations/` (`001_roles_y_salud.sql`, `002_postgres_nativo.sql`) después de hacer un respaldo.

## Ejecutar el frontend en desarrollo

Requisito: instalar Node.js.

Desde una terminal:

```bash
cd frontend
npm install
npm run dev
```

Abrir la dirección `Local` que indique Vite en la terminal. Si los puertos habituales están ocupados, Vite puede seleccionar otro puerto.

Este comando inicia el **frontend**. No garantiza por sí solo que el backend ni la base de datos estén funcionando. Si la interfaz muestra errores de red o HTTP, verificar el proceso del servidor, la configuración de API y la base de datos antes de concluir que los registros se guardan.

## Archivos de documentación y configuración

- `DOCUMENTACION.html`: documentación visual general del sistema.
- `IMPLEMENTACION.md`: estado de las funcionalidades, limitaciones y tareas de validación.
- `.env.example`: ejemplo de variables de entorno; revisar antes de iniciar el backend.
- `backend/config/database.sql`: esquema completo de PostgreSQL (crea la base desde cero).
- `backend/migrations/`: scripts para actualizar bases creadas con versiones anteriores.
- `backend/`: rutas, controladores, middleware, configuración y migraciones del backend.

## Lista de verificación pendiente

- [ ] Compilar el frontend con `npm run build`.
- [ ] Iniciar y comprobar el backend con la configuración correcta.
- [ ] Crear un registro de prueba en cada módulo que permita guardar información.
- [ ] Recargar la página y comprobar que el registro siga disponible.
- [ ] Probar cada rol con una cuenta separada.
- [ ] Confirmar que un jugador no pueda consultar datos de otro modificando una URL o petición.
- [ ] Confirmar que la cuenta de jugador quede vinculada al perfil deportivo correcto.
- [ ] Probar los permisos en el backend, no solamente en el menú.
- [ ] Revisar las reglas de acceso a datos de salud antes de usar datos reales.

## Alcance de esta versión

Este documento se actualiza para reflejar la estructura del frontend actual. No afirma que todas las funciones estén terminadas, que los roles estén completamente protegidos o que la persistencia se haya verificado con una base de datos real.

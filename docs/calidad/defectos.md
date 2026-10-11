# Registro de defectos

Severidad según `03_plan_de_pruebas.md` (crítica, alta, media, baja). Las fechas usan el formato AAAA-MM-DD; el informe calcula con ellas el tiempo medio de corrección (M-M1) y la densidad de defectos (M-R1).

Cómo registrar un defecto: agregar una fila con el siguiente número, estado **Abierto**, y un caso de prueba que lo reproduzca (en `pruebas/`, marcado con `{ todo: 'DEF-0xx' }` mientras siga abierto). Al corregirlo: estado **Cerrado**, fecha de corrección, versión, y quitar la marca `todo` del caso.

| ID | Detectado | Versión | Módulo | Severidad | Descripción | Estado | Corregido | Corregido en | Caso de prueba |
|---|---|---|---|---|---|---|---|---|---|
| DEF-001 | 2026-10-04 | v1.0 | Base de datos | Crítica | Reglas de Firestore abiertas (`allow read, write: if true`) y API key en el repositorio: cualquiera podía leer y modificar toda la base, incluidos los hashes de contraseñas. | Cerrado | 2026-10-10 | v1.2 | CP-MIG-001 |
| DEF-002 | 2026-10-10 | v1.1 | Deportistas | Alta | Asignar o quitar un equipo desde la pantalla de Equipos borraba el entrenador asignado al jugador (y habría borrado el dorsal): el `PUT` sobrescribía todos los campos. | Cerrado | 2026-10-10 | v1.3 | CP-DOR-006 |
| DEF-003 | 2026-10-10 | v1.1 | Lesiones | Crítica | `GET /lesiones/:id` no filtraba por rol (acceso a lesiones ajenas) y el jugador no podía ver las propias. | Cerrado | 2026-10-10 | v1.1 | CP-PER-002 |
| DEF-004 | 2026-10-10 | v1.0 | Antropometría, evaluaciones | Crítica | Inyección SQL: los nombres de columna del `INSERT` se tomaban del cuerpo de la petición. | Cerrado | 2026-10-10 | v1.2 | CP-SEG-003 |
| DEF-005 | 2026-10-10 | v1.1 | Head coach, salud | Alta | Las rutas `/api/head-coach` y `/api/salud` no estaban registradas en `server.js` ni en `api/index.js`: respondían 404 en el despliegue. | Cerrado | 2026-10-10 | v1.1 | CP-PER-008 |
| DEF-006 | 2026-10-10 | v1.1 | Inicio de sesión | Media | En desarrollo, el acceso de demostración reemplazaba al login real y abría sesión aunque las credenciales fueran incorrectas. | Cerrado | 2026-10-10 | v1.1 | CP-UI-LOG-002 |
| DEF-007 | 2026-10-04 | v1.0 | Base de datos | Alta | `database.sql` no creaba una base nueva (orden de tablas, columnas faltantes), `migrate.js` usaba sintaxis MySQL y un controlador alteraba tablas en tiempo de ejecución. | Cerrado | 2026-10-10 | v1.2 | CP-MIG-001 |
| DEF-008 | 2026-10-10 | v1.0 | Navegación | Alta | En celular el menú lateral se ocultaba sin ningún botón para abrirlo: no se podía navegar entre módulos. | Cerrado | 2026-10-10 | v1.3 | CP-UI-NAV-001 |
| DEF-009 | 2026-10-10 | v1.0 | Deportes | Media | El deporte por defecto era el primero de la lista y podía ocultar el plantel de un entrenador de otro deporte. | Cerrado | 2026-10-10 | v1.3 | CP-UI-NAV-002 |
| DEF-010 | 2026-10-10 | v1.1 | Navegación | Media | Menú y permisos de página no coincidían (el head coach veía Equipos pero era redirigido). | Cerrado | 2026-10-10 | v1.3 | CP-UI-REC-002 |
| DEF-011 | 2026-10-10 | v1.1 | Deportistas | Media | La búsqueda por texto ignoraba los filtros avanzados. | Cerrado | 2026-10-10 | v1.3 | CP-UI-DOR-001 |
| DEF-012 | 2026-10-10 | v1.3 | Deportistas | Media | Editar el dorsal con Enter lo guardaba dos veces (dos peticiones y dos avisos). Detectado por prueba de navegador antes de publicar. | Cerrado | 2026-10-10 | v1.3 | CP-UI-DOR-001 |
| DEF-013 | 2026-10-10 | v1.3 | Asistencia, antropometría | Media | Desbordes horizontales en celular (selector de entrenamiento y barra de pestañas). | Cerrado | 2026-10-10 | v1.3 | CP-UI-REC-001 |
| DEF-014 | 2026-10-10 | v1.3 | Antropometría | Media | Con el fondo claro, los puntos de la somatocarta y el texto de los tooltips quedaban invisibles (colores del tema oscuro). | Cerrado | 2026-10-10 | v1.3 | CP-UI-MED-001 |
| DEF-015 | 2026-10-10 | v1.3 | API (varios) | Media | Un identificador o filtro no numérico (`/api/jugadores/abc`, `?disciplina_id=1 OR 1=1`) produce error 500 en lugar de 400. | Cerrado | 2026-10-10 | v1.4 | CP-SEG-006, CP-SEG-007 |
| DEF-016 | 2026-10-10 | v1.3 | API (varios) | Media | Fechas inválidas, valores fuera de la lista (tipo de partido) y referencias a registros inexistentes producen error 500 en lugar de 400. | Cerrado | 2026-10-10 | v1.4 | CP-SEG-008 a CP-SEG-010 |
| DEF-017 | 2026-10-10 | v1.3 | Estadísticas, deportistas | Baja | Se aceptan valores imposibles: goles, edad y peso negativos. | Cerrado | 2026-10-10 | v1.4 | CP-SEG-011 |
| DEF-018 | 2026-10-10 | v1.3 | API (varios) | Alta | Los errores 500 devuelven al usuario el mensaje interno de PostgreSQL (nombres de tablas y restricciones). | Cerrado | 2026-10-10 | v1.4 | CP-SEG-013, CP-SEG-017 |
| DEF-019 | 2026-10-04 | v1.0 | Autenticación | Alta | Los secretos JWT tienen valores por defecto escritos en el código: sin `.env`, cualquiera podría firmar tokens válidos. | Cerrado | 2026-10-10 | v1.4 | CP-SEG-020, CP-UNI-013, CP-UNI-014 |
| DEF-020 | 2026-10-04 | v1.0 | Usuarios | Alta | Contraseñas de usuarios reales en texto plano en `seed.js` y `seed_cloudsql.js`. | Cerrado | 2026-10-10 | v1.4 | CP-SEG-019 |
| DEF-021 | 2026-10-04 | v1.0 | Autenticación | Media | El hash de contraseñas es una sola ronda de HMAC-SHA256, vulnerable a fuerza bruta. | Cerrado | 2026-10-10 | v1.4 | CP-SEG-014, CP-SEG-015, CP-UNI-010, CP-UNI-011 |
| DEF-022 | 2026-10-10 | v1.3 | Interfaz (general) | Media | Contraste insuficiente (WCAG AA): blanco sobre verde de botón `#218D45` (4,23:1), verde `#148E40` sobre blanco (4,22:1), blanco sobre naranja `#F0AD4E` (1,94:1). Son colores del portal oficial; hay que ajustarlos sin perder la identidad. | Cerrado | 2026-10-10 | v1.5 | CP-UI-MED-001 |
| DEF-023 | 2026-10-10 | v1.3 | Interfaz (tablas) | Media | 73 botones con solo ícono (editar, eliminar) y 3 selectores no tienen nombre accesible para lectores de pantalla. | Abierto | | v1.5 | CP-UI-MED-001 |
| DEF-024 | 2026-10-10 | v1.3 | Interfaz (módulos) | Media | Solo el 29 % de los elementos táctiles mide 44 px o más en celular (botones pequeños de tablas, filtros y chips). Avance en v1.5 fase 1: 78,4 % con los componentes compartidos; faltan tablas, chips y campos de cada página (fases 2 y 5). | Abierto |  | v1.5 | CP-UI-MED-002 |
| DEF-025 | 2026-10-10 | v1.3 | Rendimiento | Media | El inicio tarda 5,7 s en cargar con red 4G lenta: un único paquete de JavaScript de 857 KB sin división por módulos. | Abierto | | v1.5 | CP-UI-MED-003 |
| DEF-026 | 2026-10-10 | v1.3 | Interfaz (módulos) | Baja | Si el servidor no responde, 8 de 9 pantallas muestran el error pero no ofrecen un botón para reintentar (solo el inicio lo tiene). | Abierto | | v1.5 | CP-UI-MED-004 |

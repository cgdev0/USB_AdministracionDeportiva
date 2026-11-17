# IMPLEMENTACION.md — Estado del frontend y hoja de ruta de Administración Deportiva

## 1. Base revisada

Revisado en la **v2.2** (5 de noviembre de 2026). La primera versión de este documento se escribió sobre `DTdeportivo_roles_personalizados_v2(2).zip`; desde entonces las verificaciones pendientes se convirtieron en pruebas automáticas (`pruebas/`) y sus resultados están en `docs/calidad/informes/`. La sección 6 indica el caso de prueba que cubre cada punto.

## 2. Módulos presentes en el frontend

| Módulo | Archivo |
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

El contexto de autenticación está en `frontend/src/context/AuthContext.jsx`; el menú por rol en `frontend/src/config/navegacion.js` y `frontend/src/components/Estructura.jsx` (menú lateral en computador, menú inferior y hoja "Más" en celular); las rutas en `frontend/src/App.jsx`. El perfil de cada deporte está en `frontend/src/config/deportes.js` y sus estadísticas en `backend/config/metricas_deportes.js`.

## 3. Roles contemplados

El código reconoce los roles `administrador`, `head_coach`, `entrenador`, `personal_salud` y `jugador`. El menú y las rutas protegidas salen de la misma lista (`config/navegacion.js`), y cada endpoint del backend valida el rol y el alcance del registro (`backend/utils/alcance.js`). Las cuentas definidas en el código, sus roles y permisos están en `docs/Inventario_usuarios_AdministracionDeportiva.pdf`.

En desarrollo, `AuthContext.jsx` contiene cuentas de demostración. Los tokens `demo:*` simulan la sesión en el frontend y **no constituyen prueba de autorización válida en la API**. No deben utilizarse como autenticación de producción.

## 4. Estado de avance

### Identificado en el código
- Páginas React para los módulos listados en la sección 2.
- Menú lateral que muestra opciones según el rol.
- Ruta específica `/head-coach`.
- Contexto de autenticación con roles y modo demo de desarrollo.
- Formularios y llamadas al cliente HTTP en distintos módulos.
- Código de cálculo antropométrico en `frontend/src/utils/anthropometry.js`.

### Validado con pruebas automáticas (v2.2)
- Cada formulario guarda a través del backend y el dato persiste en PostgreSQL (`modulos.test.js`, recorrido por rol en el navegador).
- Los endpoints comprueban el rol y la propiedad o asignación del registro (`permisos.test.js`, `seguridad.test.js`).
- El jugador consulta solo su propia antropometría, salud, asistencia, evaluaciones y estadísticas (CP-PER-002, CP-PER-007, CP-PER-010 a 012, CP-INI-008).
- Las cuentas creadas desde Usuarios se vinculan con el perfil deportivo; desde la v2.0 se crea también la ficha (CP-COR-005, CP-OBS-007).
- El entrenador ve solo sus deportistas y el head coach solo los de sus entrenadores (CP-PER-004, CP-PER-005, CP-INI-007).
- La app compila con `npm run build` (lo hace cada prueba de navegador antes de empezar).

### Pendiente
- Prueba con 5 usuarios reales e instalación desde cero por un integrante (`docs/calidad/casos/manuales.md`).
- Recorrido en celulares físicos (Android y iPhone); hoy se verifica con emulación.
- Las cuentas demo de `AuthContext.jsx` (solo en desarrollo) no entran en el build de producción, pero conviene retirarlas antes de la entrega final.

## 5. Prioridades recomendadas

1. **Acceso y privacidad:** comparar las reglas del menú, las rutas de `App.jsx`, los middleware y los controladores backend.
2. **Cuenta de jugador:** comprobar la relación entre `usuarios.jugador_id` y el perfil deportivo.
3. **Antropometría:** limitar la consulta a los registros propios para el rol `jugador`, tanto en frontend como en backend.
4. **Asignación deportiva:** verificar filtros de entrenador y Head Coach en jugadores, entrenamientos, partidos, asistencia y estadísticas.
5. **Salud:** revisar permisos de historia clínica, lesiones, controles y notificaciones.
6. **Persistencia:** probar crear/leer/editar/eliminar según corresponda y confirmar el resultado tras recargar.
7. **Regresión:** ejecutar `npm run build` y probar cada rol en una sesión separada.

## 6. Matriz de pruebas funcionales

| Prueba | Resultado esperado | Estado |
|---|---|---|
| Iniciar sesión por rol | Se identifica el rol correcto | Aprobado · CP-AUT-001, CP-ADM-001, CP-UI-REC-001 a 005 |
| Abrir una ruta no autorizada | Acceso denegado o redirección | Aprobado · CP-AUT-006, CP-PER-001, CP-UI-REC-001 a 005 |
| Jugador consulta antropometría | Solo aparecen datos propios | Aprobado · CP-PER-012 |
| Jugador intenta cambiar el ID consultado | Backend rechaza la petición ajena | Aprobado · CP-PER-002, CP-INI-011 |
| Administrador crea cuenta de jugador | Cuenta vinculada al perfil deportivo correcto | Aprobado · CP-COR-005, CP-OBS-007 |
| Entrenador consulta jugadores | Solo ve deportistas asignados | Aprobado · CP-PER-004 |
| Personal de salud consulta historia clínica | Acceso permitido según autorización | Aprobado · CP-PER-006 |
| Crear un registro y recargar | El registro sigue disponible si se guardó correctamente | Aprobado · `modulos.test.js` |
| Compilar frontend | `npm run build` termina sin errores | Aprobado (cada ejecución de `npm run test:ui`) |
| Estadísticas propias de cada deporte | Cada deporte pide y muestra sus métricas | Aprobado · CP-EST-001 a 004 |
| Fechas en hora de Colombia | "Mañana" es mañana también de noche | Aprobado · CP-ZON-001, CP-ZON-002 |

## 7. Base de datos y despliegue

Desde la v1.2 el único almacenamiento es PostgreSQL. Una base nueva se crea con `npm run db:init` (`backend/config/database.sql`); una base existente se actualiza con los scripts de `backend/migrations/` en orden (hasta `010_metricas_y_admin.sql`). No ejecutar migraciones en producción sin respaldo. En Railway la preparación es automática al desplegar (ver README, "Publicar en Railway").

Las cuentas demo del frontend sirven únicamente para revisar la interfaz en modo desarrollo. Para comprobar persistencia y seguridad se requieren cuentas y datos de prueba conectados al backend y al almacenamiento realmente utilizado.

## 8. Criterio para declarar una función terminada

Una función se considerará terminada cuando:
1. La interfaz permita realizar la operación prevista.
2. La API valide autenticación, rol y propiedad/asignación del registro.
3. La operación guarde o consulte el dato esperado.
4. El resultado se compruebe después de recargar.
5. Se prueben tanto el acceso permitido como el intento de acceso no autorizado.
6. Se actualice esta documentación con el resultado de las pruebas reales.

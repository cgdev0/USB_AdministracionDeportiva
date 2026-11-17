# Catálogo de requisitos — Administración Deportiva

Versión de referencia: **v1.3** (10 de octubre de 2026), actualizada en la **v2.2** (5 de noviembre de 2026) con los cambios de la v2.0 y la v2.1. Responsable: Carlos Gamboa.

Las historias de usuario y los casos de uso que se enlazan con estos requisitos están en `docs/analisis/historias_y_casos_de_uso.md` (v2.3).

Cambios de la v2.2 en este catálogo: RF-03, RF-06, RF-10, RF-11, RF-12 y RF-13 ampliados; RF-24 y RNF-11 nuevos; RNF-07 apunta al diseño "Cancha". Los identificadores anteriores no cambian, para conservar la trazabilidad con los informes de versiones pasadas.

Este catálogo es la base de la trazabilidad: cada caso de prueba se asocia a uno o más requisitos, y la métrica de funcionalidad se calcula sobre esta lista. Se construyó a partir de lo que la aplicación hace hoy (rutas de la API y pantallas), no de documentación anterior.

Prioridad: **A** = imprescindible para el uso del sistema, **M** = importante, **B** = deseable.

## Roles

| Rol | Descripción |
|---|---|
| Administrador | Gestiona usuarios, deportes y toda la información. La cuenta inicial es `admin1` (antes `robinson_meza`, renombrada en la v2.1). |
| Head coach | Supervisa a sus entrenadores asociados y a los deportistas de ellos. |
| Entrenador | Gestiona a sus deportistas, entrenamientos, asistencia, partidos y estadísticas. |
| Personal de salud | Gestiona lesiones, controles médicos, historias clínicas y antropometría. |
| Deportista | Consulta su propia información. |

## Requisitos funcionales

| ID | Requisito | Roles | Prioridad |
|---|---|---|---|
| RF-01 | Iniciar sesión con usuario o correo y contraseña; rechazar credenciales incorrectas con un mensaje claro; mantener la sesión con token renovable y permitir cerrarla. | Todos | A |
| RF-02 | Cambiar la propia contraseña validando la actual. | Todos | M |
| RF-03 | Gestionar usuarios: crear, editar, desactivar y **reactivar**, restablecer contraseña, asignar rol y crear en lote desde CSV. Al crear un deportista se crea también su ficha deportiva (deporte, equipo, posición y fecha de nacimiento). El administrador no puede desactivar su propia cuenta. | Administrador | A |
| RF-04 | Restringir menú, páginas y operaciones de la API según el rol. | Todos | A |
| RF-05 | Mostrar a cada rol solo los datos que le corresponden: el deportista los suyos, el entrenador los de sus deportistas y el head coach los de sus entrenadores. | Todos | A |
| RF-06 | Gestionar deportes (crear y eliminar, solo el administrador) y filtrar la información por deporte en toda la aplicación (también entrenamientos, partidos, salud y usuarios). El entrenador, el head coach y el deportista ven solo sus deportes (si tienen uno solo, queda fijo); el administrador puede asignar el deporte de cada entrenador. Cada deporte tiene su perfil: ícono, color, posiciones, formato del resultado y estadísticas. | Administrador, entrenador | M |
| RF-07 | Gestionar equipos: crear, editar, cargar escudo, eliminar, ver nómina y asignar o desvincular deportistas. | Administrador, entrenador (consulta: head coach, salud) | M |
| RF-08 | Gestionar deportistas: crear, editar, eliminar, subir foto, ver ficha, buscar, filtrar e importar desde CSV. | Administrador, entrenador | A |
| RF-09 | Asignar, cambiar y quitar el dorsal (0 a 99) de un deportista, sin repetirlo dentro de un equipo, y mostrarlo junto al nombre en todo el sistema. | Administrador, entrenador | M |
| RF-10 | Gestionar entrenamientos (fecha, hora, lugar, tipo, equipo y descripción). Solo el administrador crea actividades generales (sin equipo); el entrenador elige uno de sus equipos o de su deporte. | Administrador, entrenador | A |
| RF-11 | Registrar la asistencia de los deportistas a cada entrenamiento, uno por uno o todo el plantel de una vez, sin duplicar registros. | Administrador, entrenador | A |
| RF-12 | Gestionar partidos y competencias (fecha, rival, tipo: liga, amistoso, torneo o competencia, y resultado). El resultado se registra según el deporte: marcador, sets, tiempo o marca y puesto. Las fechas se muestran sin desfase de zona horaria. | Administrador, entrenador | M |
| RF-13 | Registrar estadísticas por deportista y partido con las **métricas propias de su deporte** (por ejemplo: fútbol, goles, asistencias, tarjetas y minutos; baloncesto, puntos, rebotes, asistencias y faltas; rugby, tries, conversiones, penales y tackles; voleibol, puntos, saques, bloqueos y recepciones; béisbol, carreras, hits, impulsadas y ponches). Los totales derivados (puntos del rugby, medallas) se calculan solos; un deporte nuevo usa métricas genéricas; los registros anteriores se muestran con las métricas de su deporte. Mostrar todos los deportes disponibles y la tabla de líderes de cada uno. | Administrador, entrenador (consulta: todos según RF-05) | M |
| RF-14 | Registrar y editar lesiones (personal de salud y administrador) y consultarlas según el rol. | Salud, administrador (consulta: todos según RF-05) | A |
| RF-15 | Gestionar historias clínicas, controles médicos con aptitud deportiva, seguimiento de lesiones y notificaciones. | Salud, administrador (deportista: consulta propia) | A |
| RF-16 | Registrar evaluaciones físicas de rugby y calcular puntajes normalizados. | Administrador, entrenador, salud | M |
| RF-17 | Registrar mediciones antropométricas ISAK y calcular automáticamente % de grasa, masas corporales y somatotipo, con su somatocarta. | Salud, administrador | A |
| RF-18 | Mostrar en el inicio el próximo partido, la disponibilidad del plantel, los avisos para revisar, la agenda de la semana, la asistencia reciente y los máximos anotadores, según el rol. | Todos | A |
| RF-19 | Mostrar al head coach el panel de supervisión con sus entrenadores y los deportistas de ellos. | Head coach | M |
| RF-20 | Armar y publicar la convocatoria de cada partido (titulares y suplentes), avisar a los convocados dentro de la app, recibir su confirmación hasta el día del partido y guardar el registro de cada cambio y respuesta. | Entrenador, administrador; consulta: todos | A |
| RF-21 | Enviar avisos del entrenador (o del administrador) a un equipo o a todos sus deportistas, con aviso en la campanita y registro en el inicio. | Entrenador, administrador; reciben: deportistas | M |
| RF-22 | Recordar automáticamente las actividades del día siguiente, las convocatorias sin responder y los controles médicos próximos, y permitir agregar entrenamientos y partidos al calendario del dispositivo. | Todos | M |
| RF-23 | Mostrar reconocimientos del plantel: asistencia perfecta del mes, máximo anotador y máximo asistidor de la temporada. | Todos | B |
| RF-24 | Gestionar categorías por deporte (por ejemplo: Sub-20, Femenino, Primera) y asignarlas a los equipos. Solo el administrador las crea y elimina. *(v2.0)* | Administrador (consulta: todos) | B |

## Requisitos no funcionales

| ID | Requisito | Característica ISO 9126 | Prioridad |
|---|---|---|---|
| RNF-01 | Las contraseñas se guardan con hash y sal; el acceso a la API exige token válido; las entradas no permiten inyección SQL. | Funcionalidad (seguridad de acceso) | A |
| RNF-02 | Los datos de salud solo los ven el personal autorizado y el propio deportista, en línea con la Ley 1581 de 2012 de protección de datos personales. | Funcionalidad (seguridad de acceso) | A |
| RNF-03 | Las entradas inválidas se rechazan con un mensaje claro y nunca dejan el sistema en un estado incorrecto. | Fiabilidad (tolerancia a fallos) | A |
| RNF-04 | Funciona en celular (360 a 430 px de ancho) y en computador (1024 px o más) sin desplazamiento horizontal de la página. | Portabilidad (adaptabilidad) | A |
| RNF-05 | Funciona en los motores de navegador Chromium (Chrome, Edge), Firefox y WebKit (Safari). | Portabilidad (adaptabilidad) | M |
| RNF-06 | Los botones y enlaces miden al menos 44 px para uso táctil; los textos cumplen contraste AA; el foco del teclado es visible. | Usabilidad (operabilidad) | M |
| RNF-07 | La interfaz sigue el sistema de diseño "Cancha" descrito en `docs/diseno/DESIGN.md`: alusivo al deporte y con la identidad de Unisimón (verdes y logos oficiales). | Usabilidad (atractivo) | M |
| RNF-08 | Las operaciones comunes de la API responden en menos de 500 ms y la pantalla de inicio carga en menos de 3 s. | Eficiencia (comportamiento temporal) | M |
| RNF-09 | El sistema se instala desde cero siguiendo el README con Node.js y PostgreSQL. | Portabilidad (instalabilidad) | M |
| RNF-10 | Todo cambio entra por Pull Request, queda en `CHANGELOG.md` y conserva las pruebas automáticas en verde. | Mantenibilidad (estabilidad) | M |
| RNF-11 | Las fechas ("hoy", "mañana", recordatorios, edades) se calculan en hora de Colombia (`America/Bogota`), aunque el servidor esté en otra zona horaria, como en Railway. *(v2.2)* | Funcionalidad (exactitud) / Portabilidad (adaptabilidad) | A |

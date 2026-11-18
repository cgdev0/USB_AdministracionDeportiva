# Catálogo de requisitos — Administración Deportiva

Versión de referencia: **v1.3** (10 de octubre de 2026), actualizada en la **v2.2** (5 de noviembre de 2026) con los cambios de la v2.0 y la v2.1, y en la **v2.7** (17 de noviembre de 2026) con la base de la historia clínica. Responsable: Carlos Gamboa.

Las historias de usuario y los casos de uso que se enlazan con estos requisitos están en `docs/analisis/historias_y_casos_de_uso.md` (v2.3).

Cambios de la v2.2 en este catálogo: RF-03, RF-06, RF-10, RF-11, RF-12 y RF-13 ampliados; RF-24 y RNF-11 nuevos; RNF-07 apunta al diseño "Cancha".

Cambios de la v2.7 (plan de historia clínica, `docs/plan/plan_historia_clinica.md`): RF-25 (identificación del deportista), RF-26 (historia clínica secuencial e identificación de quien atiende) RF-31 (bitácora de accesos), RNF-13 (archivos clínicos protegidos) y RNF-14 (conservación de la historia clínica) nuevos. Los identificadores anteriores no cambian, para conservar la trazabilidad con los informes de versiones pasadas.

Este catálogo es la base de la trazabilidad: cada caso de prueba se asocia a uno o más requisitos, y la métrica de funcionalidad se calcula sobre esta lista. Se construyó a partir de lo que la aplicación hace hoy (rutas de la API y pantallas), no de documentación anterior.

Prioridad: **A** = imprescindible para el uso del sistema, **M** = importante, **B** = deseable.

## Roles

| Rol | Descripción |
|---|---|
| Administrador | Gestiona usuarios, deportes y toda la información. La cuenta inicial es `admin1` (antes `robinson_meza`, renombrada en la v2.1). |
| Head coach | Supervisa a sus entrenadores asociados y a los deportistas de ellos. |
| Entrenador | Gestiona a sus deportistas, entrenamientos, asistencia, partidos y estadísticas. |
| Personal de salud | Gestiona lesiones, controles médicos, historias clínicas (valoraciones) y antropometría. Puede ser profesional, practicante o estudiante (v2.7). |
| Deportista | Consulta su propia información. |

## Requisitos funcionales

| ID | Requisito | Roles | Prioridad |
|---|---|---|---|
| RF-01 | Iniciar sesión con usuario o correo y contraseña; rechazar credenciales incorrectas con un mensaje claro; mantener la sesión con token renovable y permitir cerrarla. | Todos | A |
| RF-02 | Cambiar la propia contraseña validando la actual. | Todos | M |
| RF-03 | Gestionar usuarios: crear, editar, desactivar y **reactivar**, restablecer contraseña, asignar rol y crear en lote desde CSV. Al crear un deportista se crea también su ficha deportiva (deporte, equipo, posición y fecha de nacimiento). El administrador no puede desactivar su propia cuenta. | Administrador | A |
| RF-04 | Restringir menú, páginas y operaciones de la API según el rol. *(v2.7: las rutas clínicas usan `autorizarEstricto`, sin el pase libre del administrador; ver la matriz de acceso clínico.)* | Todos | A |
| RF-05 | Mostrar a cada rol solo los datos que le corresponden: el deportista los suyos, el entrenador los de sus deportistas y el head coach los de sus entrenadores. *(v2.7: además, la información clínica sigue la matriz de acceso clínico.)* | Todos | A |
| RF-06 | Gestionar deportes (crear y eliminar, solo el administrador) y filtrar la información por deporte en toda la aplicación (también entrenamientos, partidos, salud y usuarios). El entrenador, el head coach y el deportista ven solo sus deportes (si tienen uno solo, queda fijo); el administrador puede asignar el deporte de cada entrenador. Cada deporte tiene su perfil: ícono, color, posiciones, formato del resultado y estadísticas. | Administrador, entrenador | M |
| RF-07 | Gestionar equipos: crear, editar, cargar escudo, eliminar, ver nómina y asignar o desvincular deportistas. | Administrador, entrenador (consulta: head coach, salud) | M |
| RF-08 | Gestionar deportistas: crear, editar, eliminar, subir foto, ver ficha, buscar, filtrar e importar desde CSV. | Administrador, entrenador | A |
| RF-09 | Asignar, cambiar y quitar el dorsal (0 a 99) de un deportista, sin repetirlo dentro de un equipo, y mostrarlo junto al nombre en todo el sistema. | Administrador, entrenador | M |
| RF-10 | Gestionar entrenamientos (fecha, hora, lugar, tipo, equipo y descripción). Solo el administrador crea actividades generales (sin equipo); el entrenador elige uno de sus equipos o de su deporte. | Administrador, entrenador | A |
| RF-11 | Registrar la asistencia de los deportistas a cada entrenamiento, uno por uno o todo el plantel de una vez, sin duplicar registros. | Administrador, entrenador | A |
| RF-12 | Gestionar partidos y competencias (fecha, rival, tipo: liga, amistoso, torneo o competencia, y resultado). El resultado se registra según el deporte: marcador, sets, tiempo o marca y puesto. Las fechas se muestran sin desfase de zona horaria. | Administrador, entrenador | M |
| RF-13 | Registrar estadísticas por deportista y partido con las **métricas propias de su deporte** (por ejemplo: fútbol, goles, asistencias, tarjetas y minutos; baloncesto, puntos, rebotes, asistencias y faltas; rugby, tries, conversiones, penales y tackles; voleibol, puntos, saques, bloqueos y recepciones; béisbol, carreras, hits, impulsadas y ponches). Los totales derivados (puntos del rugby, medallas) se calculan solos; un deporte nuevo usa métricas genéricas; los registros anteriores se muestran con las métricas de su deporte. Mostrar todos los deportes disponibles y la tabla de líderes de cada uno. | Administrador, entrenador (consulta: todos según RF-05) | M |
| RF-14 | Registrar, editar y eliminar lesiones (solo el personal de salud) y consultarlas según el rol: el personal de salud y el propio deportista ven el detalle (tipo y descripción); el entrenador, el head coach y el administrador ven la disponibilidad (fechas, estado del seguimiento y retorno estimado). *(v2.7)* | Salud (consulta de disponibilidad: entrenador, head coach, administrador; detalle propio: deportista) | A |
| RF-15 | Gestionar historias clínicas, controles médicos con aptitud deportiva, seguimiento de lesiones y notificaciones. *(v2.7: ya no el administrador; la aptitud y las restricciones llegan al entrenador como disponibilidad.)* | Salud (deportista: consulta propia) | A |
| RF-16 | Registrar evaluaciones físicas de rugby y calcular puntajes normalizados. *(v2.7: las registra el entrenador; el personal de salud las consulta.)* | Entrenador, administrador (consulta: salud y según RF-05) | M |
| RF-17 | Registrar mediciones antropométricas ISAK y calcular automáticamente % de grasa, masas corporales y somatotipo, con su somatocarta. *(v2.7: hace parte de la historia clínica; ni el entrenador ni el administrador la registran ni la consultan.)* | Salud (deportista: consulta propia) | A |
| RF-18 | Mostrar en el inicio el próximo partido, la disponibilidad del plantel, los avisos para revisar, la agenda de la semana, la asistencia reciente y los máximos anotadores, según el rol. | Todos | A |
| RF-19 | Mostrar al head coach el panel de supervisión con sus entrenadores y los deportistas de ellos. | Head coach | M |
| RF-20 | Armar y publicar la convocatoria de cada partido (titulares y suplentes), avisar a los convocados dentro de la app, recibir su confirmación hasta el día del partido y guardar el registro de cada cambio y respuesta. | Entrenador, administrador; consulta: todos | A |
| RF-21 | Enviar avisos del entrenador (o del administrador) a un equipo o a todos sus deportistas, con aviso en la campanita y registro en el inicio. | Entrenador, administrador; reciben: deportistas | M |
| RF-22 | Recordar automáticamente las actividades del día siguiente, las convocatorias sin responder y los controles médicos próximos, y permitir agregar entrenamientos y partidos al calendario del dispositivo. | Todos | M |
| RF-23 | Mostrar reconocimientos del plantel: asistencia perfecta del mes, máximo anotador y máximo asistidor de la temporada. | Todos | B |
| RF-24 | Gestionar categorías por deporte (por ejemplo: Sub-20, Femenino, Primera) y asignarlas a los equipos. Solo el administrador las crea y elimina. *(v2.0)* | Administrador (consulta: todos) | B |
| RF-25 | Identificar a cada deportista con tipo y número de documento (códigos de la guía FHIR RDA: CC, TI, RC, CE, PA, PPT, PE), sin repetir el número aunque cambie el tipo; registrar teléfono, EPS, residencia, nacionalidad, contacto de emergencia y acudiente (nombre y teléfono obligatorios si es menor de edad). La pertenencia étnica y la discapacidad son datos sensibles (Ley 1581): solo las registra y las ve el personal de salud, y el propio deportista las consulta. Buscar por documento e importar estos datos por CSV. *(v2.7)* | Administrador, entrenador (datos sensibles: salud) | A |
| RF-26 | Cada registro clínico identifica a quien atiende: nombre, profesión y vínculo (profesional, practicante o estudiante). El registro profesional (RETHUS) y el docente supervisor son opcionales, porque los primeros usuarios son practicantes y estudiantes. El supervisor es un profesional de salud activo, distinto de la persona. La historia clínica es secuencial (Res. 1995 de 1999): cada atención es una valoración aparte con fecha, hora y quien atiende; el borrador lo edita solo quien lo abrió; al cerrarla queda firmada con una copia de los datos de quien atiende y un código de integridad, y ya no se modifica ni se borra (tampoco directamente en la base): se corrige con notas aclaratorias. El deportista consulta sus valoraciones cerradas; el administrador no accede. Las historias anteriores se migran como la primera valoración. *(v2.7)* | Salud (deportista: consulta propia; administrador: solo datos profesionales) | A |
| RF-31 | Llevar una bitácora de accesos a la historia clínica: cada vez que alguien consulta, registra, modifica, cierra, descarga o elimina un dato clínico (valoraciones, notas, archivos, controles, seguimientos, lesiones, antropometría, datos sensibles) queda quién (nombre y rol), qué, sobre qué registro, de qué deportista y cuándo, sin contenido clínico. Se registra antes de responder (si no se puede registrar, la consulta no se entrega). La consultan el personal de salud (por deportista), el deportista (la de su historia) y el administrador (vista general con filtros); no se modifica ni se borra. *(v2.7; los números RF-27 a RF-30 quedan para las fases 2 a 4.)* | Salud, deportista, administrador | A |

## Matriz de acceso a la información clínica (v2.7)

Acordada con el docente de salud: el entrenador maneja la condición física, no la rehabilitación; el administrador gestiona cuentas y no es parte del equipo de salud (Resolución 1995 de 1999, art. 14). La API la aplica, no solo la pantalla (pruebas CP-ROL-010 a 017).

| | Personal de salud | Entrenador / head coach | Administrador | Deportista |
|---|---|---|---|---|
| Valoraciones, notas y archivos clínicos | Crea y consulta | ✗ | ✗ | Consulta las suyas (cerradas) |
| Antropometría | Crea y consulta | ✗ | ✗ | Consulta la suya |
| Controles médicos y seguimientos de lesión | Crea y consulta | ✗ | ✗ | Consulta los suyos (controles) |
| Lesiones | Crea, edita y consulta el detalle | Disponibilidad (fechas, estado, retorno) | Disponibilidad | Detalle de las suyas |
| Datos sensibles (pertenencia étnica, discapacidad) | Registra y consulta | ✗ | ✗ | Consulta los suyos |
| Pruebas de condición física | Consulta | Crea y consulta | Crea y consulta | Consulta las suyas |
| Disponibilidad en el inicio (apto, restricciones, lesionado) | Con el tipo de lesión | Sin el tipo de lesión | Sin el tipo de lesión | La suya |
| Bitácora de accesos | Por deportista | ✗ | Vista general | La de su historia |

## Requisitos no funcionales

| ID | Requisito | Característica ISO 9126 | Prioridad |
|---|---|---|---|
| RNF-01 | Las contraseñas se guardan con hash y sal; el acceso a la API exige token válido; las entradas no permiten inyección SQL. | Funcionalidad (seguridad de acceso) | A |
| RNF-02 | Los datos de salud solo los ven el personal autorizado y el propio deportista, en línea con la Ley 1581 de 2012 de protección de datos personales y el art. 14 de la Resolución 1995 de 1999. *(v2.7: el administrador no es parte del equipo de salud; el entrenador recibe la disponibilidad, no el diagnóstico. A los 15 minutos sin uso, la pantalla del personal de salud se bloquea y pide la contraseña.)* | Funcionalidad (seguridad de acceso) | A |
| RNF-03 | Las entradas inválidas se rechazan con un mensaje claro y nunca dejan el sistema en un estado incorrecto. | Fiabilidad (tolerancia a fallos) | A |
| RNF-04 | Funciona en celular (360 a 430 px de ancho) y en computador (1024 px o más) sin desplazamiento horizontal de la página. | Portabilidad (adaptabilidad) | A |
| RNF-05 | Funciona en los motores de navegador Chromium (Chrome, Edge), Firefox y WebKit (Safari). | Portabilidad (adaptabilidad) | M |
| RNF-06 | Los botones y enlaces miden al menos 44 px para uso táctil; los textos cumplen contraste AA; el foco del teclado es visible. | Usabilidad (operabilidad) | M |
| RNF-07 | La interfaz sigue el sistema de diseño "Cancha" descrito en `docs/diseno/DESIGN.md`: alusivo al deporte y con la identidad de Unisimón (verdes y logos oficiales). | Usabilidad (atractivo) | M |
| RNF-08 | Las operaciones comunes de la API responden en menos de 500 ms y la pantalla de inicio carga en menos de 3 s. | Eficiencia (comportamiento temporal) | M |
| RNF-09 | El sistema se instala desde cero siguiendo el README con Node.js y PostgreSQL. | Portabilidad (instalabilidad) | M |
| RNF-10 | Todo cambio entra por Pull Request, queda en `CHANGELOG.md` y conserva las pruebas automáticas en verde. | Mantenibilidad (estabilidad) | M |
| RNF-11 | Las fechas ("hoy", "mañana", recordatorios, edades) se calculan en hora de Colombia (`America/Bogota`), aunque el servidor esté en otra zona horaria, como en Railway. *(v2.2)* | Funcionalidad (exactitud) / Portabilidad (adaptabilidad) | A |
| RNF-13 | Los archivos clínicos (consentimientos escaneados, fotos de postura, exámenes) se guardan fuera de la carpeta pública, con nombre aleatorio; solo se aceptan JPG, PNG o PDF de hasta 5 MB reconocidos por su contenido; se descargan únicamente con sesión, por el personal de salud o el propio deportista, sin caché; no se modifican ni se borran. En Railway viven en el volumen persistente. *(v2.7)* | Funcionalidad (seguridad de acceso) / Fiabilidad | A |
| RNF-14 | La historia clínica se conserva (Resolución 839 de 2017: mínimo 15 años desde la última atención): un deportista con historia clínica (valoraciones, controles, lesiones o antropometría) no se elimina, se retira del plantel actual y conserva todos sus registros; tampoco se elimina una lesión con seguimientos. La base de datos lo impide aunque se intente sin pasar por la aplicación. *(v2.7)* | Fiabilidad (madurez) / Funcionalidad (seguridad) | A |

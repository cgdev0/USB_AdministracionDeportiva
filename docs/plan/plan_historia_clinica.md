# Plan de trabajo: historia clínica de fisioterapia (v2.7 a v3.1)

**Origen:** reunión con el docente del área de salud (17 de noviembre de 2026) y el tablero de esa reunión.
**Objetivo general:** que el módulo de salud registre la valoración de un deportista como se hace en la práctica clínica. Debe cumplir la normativa colombiana y el estándar HL7 FHIR, y funcionar igual de bien en celular, tableta y computador.

**Cómo se usa este plan:**
- Cada fase es una versión y se trabaja en su propia rama, con Pull Request, CHANGELOG, defectos y etiqueta, como las versiones anteriores.
- Cada tarea tiene un objetivo, subtareas para marcar, un criterio de "Listo cuando" y sus pruebas.
- Se avanza tarea por tarea en el orden del plan. Una tarea se marca terminada cuando cumple su "Listo cuando" y sus pruebas pasan.
- 👤 marca los pasos que hace una persona del equipo (Railway, revisión con el docente). 🩺 marca el contenido clínico que debe aprobar el docente antes de darlo por terminado.

---

## 1. Marco que se cumple

| Norma o estándar | Qué exige al sistema |
|---|---|
| **Resolución 1995 de 1999** (MinSalud). En las notas aparece como "Ley 1995/1999" | Historia identificada con el documento de identidad. Secuencial: cada atención es un registro con fecha, hora y profesional. No se altera. Acceso solo del usuario, el equipo de salud y las autoridades (art. 14). |
| **Resolución 839 de 2017** | Se conserva **15 años** desde la última atención. |
| **Ley 1581 de 2012** | Los datos de salud son sensibles: autorización explícita, finalidad clara y derechos del titular. Los datos de menores tienen protección reforzada. |
| **Resolución 8430 de 1993** | Uso para investigación: consentimiento aparte y, en menores, asentimiento. |
| **Ley 528 de 1999** | Regula la fisioterapia; información y consentimiento previos a la atención. |
| **Decreto 2376 de 2010** (relación docencia-servicio) | Los practicantes y estudiantes del área de salud atienden bajo la supervisión de un docente. Por eso se puede registrar un supervisor, aunque es opcional (D1). |
| **CIE-10** (Res. 1442 de 2024 y Res. 1657 de 2025) | La CIE-10 sigue siendo obligatoria durante la transición a la CIE-11 (36 meses). Se guarda la CIE-10 y queda un campo para la CIE-11. |
| **HL7 FHIR R4, guía RDA de Colombia** (Res. 1888 de 2025, guía v1.0.3) | Formato de intercambio. Lo realista para el proyecto es **exportar** con esos perfiles; no se conecta a la plataforma del Ministerio, que es para IPS habilitadas. |

> En julio de 2026 el MinSalud publicó un borrador que reemplazaría las resoluciones 1995 y 839. Al 17 de noviembre de 2026 no se había expedido. El plan cumple la norma vigente y va en la misma dirección del borrador: historia electrónica, firma y RDA. Antes de cerrar la Fase 4 hay que revisar si ya salió.

## 2. Decisiones tomadas

Estas decisiones resuelven las preguntas que quedaron abiertas en el análisis. Se pueden cambiar; si alguna cambia, se ajustan las tareas que la citan.

| # | Decisión | Tareas afectadas |
|---|---|---|
| D1 ✔ | Hay **un solo rol de salud** (`personal_salud`). El **registro profesional (RETHUS) es opcional**: los primeros en usar el sistema serán practicantes de fisioterapia y estudiantes del área de salud, que todavía no lo tienen. Cada usuario indica si es profesional, practicante o estudiante, y puede tener un docente supervisor (también opcional). *Confirmada por el equipo.* | T0.2, T3.11, T3.12, T4.1 |
| D2 | **Sin consentimiento de atención firmado no se puede iniciar una valoración.** Para marcar un consentimiento como firmado hay que adjuntar la foto o el PDF del papel. *Queda programada pero apagada hasta que el docente apruebe los formatos (D12).* | T2.8 |
| D3 | **Los menores de edad se atienden desde el principio:** firma el acudiente y se registra el asentimiento del menor. | T0.1, T2.1 |
| D4 | El **entrenador y el head coach** ven de cada lesión solo la disponibilidad: estado, restricciones y fecha estimada de retorno. No ven el tipo, la descripción ni el diagnóstico. | T0.7 |
| D5 | El **administrador** gestiona cuentas y deportes, pero **no ve contenido clínico**. Sí ve la disponibilidad del plantel y la bitácora (quién, qué y cuándo, sin contenido). | T0.6, T0.7 |
| D6 | La **antropometría** la registra solo el personal de salud. Las **pruebas de condición física** las registra el entrenador y el personal de salud las consulta. | T0.7, T3.8 |
| D7 | Las "pruebas con tecnología" de las notas (dinamómetro, plataforma de salto, GPS…) entran en las pruebas específicas, con un campo *instrumento*. | T3.8 |
| D8 | **Ningún dato clínico se guarda en el navegador** (los dispositivos pueden ser compartidos). Los borradores se guardan en el servidor. | T1.2 |
| D9 ✔ | **Todo el personal acepta un compromiso de manejo de datos** antes de usar el sistema: administrador, head coach, entrenadores y salud. Se basa en la normativa colombiana de protección de datos, salud y deporte. Sin aceptarlo solo puede salir. Si el texto cambia, se acepta de nuevo. *Confirmada por el equipo (18-nov-2026).* | T2.4, T2.5 |
| D10 ✔ | **El deportista autoriza por dos vías:** quien lo registra declara que lo informó y que autorizó (obligatorio, también en las cargas masivas), y además el propio deportista acepta el aviso de privacidad. *Confirmada.* | T2.4, T2.6 |
| D11 ✔ | **Los datos cargados antes de la v2.9 son de demostración:** no se les exige autorización. Cuando empiecen los datos reales, se borran los de demostración en Railway. *Confirmada.* | T2.6 |
| D12 ✔ | **La regla D2 se programa y se prueba, pero queda apagada** hasta que el docente apruebe los formatos de consentimiento. *Confirmada.* | T2.8 |
| D13 ✔ | **El administrador tiene un módulo exclusivo de auditoría** con todos los registros: altas de personas (una por una y por CSV), cargas masivas, aceptaciones, gestión de cuentas y accesos a la historia clínica. *Pedida por el equipo.* | T2.7 |

## 3. Reglas de interfaz para el equipo de salud

Aplican a **todas** las tareas con pantalla. Se agregan al catálogo como RNF-12 y a `docs/diseno/DESIGN.md`.

**Dispositivos que se prueban:**
- celular de 360 a 430 px;
- tableta vertical de 768 px y horizontal de 1024 px;
- computador desde 1280 px.

**Cómo se ve un formulario largo en cada dispositivo:**

| Dispositivo | Formulario largo (valoración) |
|---|---|
| Celular | Una sección por pantalla, con barra de pasos ("3 de 9") y botones *Anterior* y *Siguiente* fijos abajo. |
| Tableta vertical | Un índice de secciones desplegable arriba y el formulario a todo el ancho. |
| Tableta horizontal y computador | Índice de secciones fijo a la izquierda, con el estado de cada una (completa, no evaluada o pendiente), y el formulario a la derecha. |

1. **Barra de acciones fija:** *Guardar borrador*, *Siguiente* y *Cerrar valoración* siempre a la mano, sin tener que desplazarse hasta el final.
2. **Guardado automático del borrador:** cada 20 segundos y al cambiar de sección, con un indicador de "Guardado hace 5 s". Si se pierde la conexión, aparece un aviso visible, se reintenta y no se pierde lo escrito mientras la pantalla siga abierta.
3. **Campos numéricos:**
   - teclado numérico (`inputmode="decimal"`), con la unidad siempre visible (kg, cm, lpm, mmHg, rpm, %);
   - un valor fuera de rango muestra un **aviso** pero no bloquea. Por ejemplo, una FC de 250 lpm muestra "Revisa el valor".
4. **Opciones como botones grandes** en lugar de listas desplegables:
   - Normal / Alterado
   - Positivo / Negativo / No concluyente
   - Derecho / Izquierdo / Bilateral
5. **Áreas táctiles de 44 px o más**, texto de 16 px en los campos (así iOS no hace zoom) y contraste AA. Debe funcionar en vertical y en horizontal.
6. **Cámara integrada:** botón *Tomar foto* que abre la cámara trasera del celular o la tableta. La imagen se comprime antes de subirla y se muestra una vista previa.
7. **Todo lo clínico es opcional,** salvo la identificación. Cada sección se puede marcar como **"No evaluado"**, y eso queda registrado.
8. **Antecedentes que se repiten:** la nueva valoración propone los de la anterior y basta con tocar *Sin cambios*.
9. **Tablas que pasan a tarjetas en el celular** (como ya se hace en otros módulos).
10. **Bloqueo por inactividad para el rol de salud:** a los 15 minutos sin uso se pide la contraseña otra vez.

---

## Fase 0. Base legal y de seguridad (v2.7)

**Objetivo de la fase:** corregir la base sobre la que se construye todo lo demás. La historia clínica debe ser secuencial e inalterable, conservarse, protegerse y mostrarse a cada rol solo en lo que le corresponde.

### T0.1 Identificación del deportista
> **Estado: ✅ terminada (17-nov-2026).**
> - `npm run test:api` contra PostgreSQL 16 local: **152 aprobadas, 0 fallidas**. Incluye CP-UNI-021 a 024 y CP-HC-001 a 004. Se omite 1, CP-MIG-002, porque falta la etiqueta `v1-original`.
> - Pruebas de interfaz en Chromium: **46 aprobadas, 0 fallidas**, incluidas CP-UI-HC-001 (celular de 360 px) y CP-UI-HC-002 (tableta).
> - Firefox y WebKit no están instalados, así que no se corrieron las pruebas `@compat`.

**Objetivo:** identificar a cada deportista con su tipo y número de documento, como exigen la Res. 1995 y el perfil de paciente del estándar RDA.
- [x] Migración `011`. Campos del deportista:
  - tipo y número de documento, con los códigos del RDA: CC, TI, RC, CE, PA, PPT, PE…;
  - EPS, teléfono, municipio de residencia, zona (urbana o rural), nacionalidad, pertenencia étnica y discapacidad (estos cuatro últimos son opcionales, pero los necesita la exportación FHIR);
  - contacto de emergencia: nombre, parentesco y teléfono;
  - acudiente: nombre, documento, parentesco y teléfono.
- [x] Índice único por **número** de documento, sin importar el tipo. Al cumplir 18 años la TI pasa a CC con el mismo número (NUIP); si el índice fuera por tipo y número, la misma persona podría quedar registrada dos veces.
- [x] Validaciones del documento:
  - CC, TI y RC solo admiten dígitos; PA, CE y PPT admiten letras y números.
  - Si el documento ya existe, responde 409 con un mensaje claro.
  - Si el deportista es menor de 18 años, el acudiente es obligatorio.
- [x] Campos nuevos en los formularios de crear y editar deportista y de crear usuario deportista. El componente es `CamposIdentificacion.jsx`:
  - secciones plegables;
  - teclado numérico o de teléfono según el campo;
  - el acudiente aparece solo si el deportista es menor de edad.
- [x] Columnas nuevas en la importación por CSV, con una plantilla actualizada. Las filas inválidas se informan con su motivo.
- [x] Documentos ficticios en los datos de demostración, incluido al menos un menor con acudiente (el #23). También se completan en el plantel que ya estaba en Railway.
- [x] *Agregado:* los datos sensibles (pertenencia étnica y discapacidad) solo los registra el personal de salud, por `PATCH /api/jugadores/:id/identificacion`. La API se los quita a los demás roles.
- [x] *Agregado:* búsqueda por número de documento en Deportistas, y tarjeta *Contacto y emergencia* en la ficha.
- [x] RF-25 en el catálogo de requisitos, CHANGELOG y clasificación de los casos `CP-HC` en `pruebas/reporte.js`.

**Listo cuando:** no se puede guardar un deportista con un documento repetido, la ficha muestra el tipo y el número, el CSV acepta las columnas nuevas y un menor sin acudiente se rechaza.
**Pruebas:** CP-UNI-021 a 024 (unitarias), CP-HC-001 a 004 (integración), y CP-UI-HC-001 (celular de 360 px) y CP-UI-HC-002 (tableta).

### T0.2 Datos de quien atiende
> **Estado: ✅ terminada (17-nov-2026).**
> - `npm run test:api`: **154 aprobadas, 0 fallidas** (1 omitida, CP-MIG-002).
> - Interfaz en Chromium: **47 aprobadas, 0 fallidas**.
> - La copia de estos datos al cerrar una valoración se hace en la T0.3 con `datosDeQuienAtiende`. Por ahora se comprobó con un control médico registrado por un practicante.

**Objetivo:** que cada registro clínico identifique a quien lo hizo. Los primeros usuarios serán practicantes de fisioterapia y estudiantes del área de salud, que todavía no tienen registro profesional, así que ese dato es **opcional** (D1).
- [x] Campos en el usuario del rol de salud (migración `012`):
  - `profesion`: fisioterapia, medicina, nutrición, psicología u otra;
  - `vinculo`: profesional, practicante o estudiante;
  - `registro_profesional`: RETHUS o tarjeta profesional, **opcional**;
  - `supervisor_id`: el docente o profesional que lo supervisa, **opcional**. Se elige entre los usuarios del rol de salud, así que el docente necesita una cuenta.
- [x] El administrador diligencia estos datos en *Usuarios* cuando el rol es personal de salud:
  - el vínculo se elige con botones grandes;
  - se ve una vista previa de cómo quedará identificada la persona;
  - la lista muestra esa descripción debajo del correo.
- [x] Ningún flujo exige el registro profesional: un practicante o estudiante puede registrar controles médicos, y desde la T0.3 también valoraciones.
- [ ] Al cerrarse, cada valoración guarda una copia de estos datos (nombre, vínculo, registro si lo hay y supervisor). Así no cambian si después se edita el usuario o el practicante termina su práctica. *Pasa a la T0.3: la función `datosDeQuienAtiende` ya está lista.*
- [x] *Agregado:* la sesión trae `quien_atiende`, y en *Salud* cada profesional ve "Registras como…".
- [x] *Agregado:* los controles médicos y los seguimientos de lesiones muestran quién los registró.
- [x] *Agregado:* la cuenta de salud de demostración queda como fisioterapeuta profesional.

**Listo cuando:** un practicante sin registro profesional crea y cierra una valoración, y en ella aparece "Practicante de fisioterapia · Supervisa: (nombre)" cuando tiene supervisor. *(La parte de la valoración se comprueba en la T0.3.)*
**Pruebas:** CP-UNI-025, CP-HC-005 y CP-UI-HC-003 (celular).

### T0.3 Historia secuencial e inalterable (valoraciones)
> **Estado: ✅ terminada (17-nov-2026).**
> - `npm run test:api`: **159 aprobadas, 0 fallidas** (1 omitida, CP-MIG-002).
> - Interfaz en Chromium: **48 aprobadas, 0 fallidas**.
> - Corrige DEF-052.
>
> **Decisión de diseño:** el contenido de cada valoración se guarda por secciones en una columna `contenido` (JSONB). Cada sección tiene su validación en `frontend/src/utils/valoracion.js`. La Fase 3 agrega las secciones nuevas ahí; los diagnósticos CIE-10 irán en una tabla aparte (T3.10) para poder buscarlos.

**Objetivo:** reemplazar la historia que se sobrescribía (una fila por deportista) por un registro de **valoraciones**. Cada atención queda con su fecha, hora y profesional, y una valoración cerrada no se modifica.
- [x] Tabla `valoraciones` (migración `013`):
  - deportista, profesional, tipo (inicial, control, pretemporada, después de lesión), fecha y hora;
  - estado (`borrador` o `cerrada`), fecha de cierre, código de integridad del cierre y número de versión para detectar ediciones simultáneas.
- [x] Tabla `notas_aclaratorias`: valoración, texto, profesional, fecha y hora. Es la única forma de corregir algo ya cerrado. Las notas tampoco se modifican ni se borran.
- [x] El servidor rechaza con 409 cualquier cambio o borrado de una valoración cerrada. Un *trigger* de la base de datos refuerza la misma regla; solo el modo de mantenimiento (`dt.mantenimiento`) lo salta.
- [x] Rutas (`/api/valoraciones`):
  - listar las valoraciones de un deportista, en orden cronológico;
  - crear una valoración;
  - guardar el borrador;
  - cerrarla;
  - agregar una nota aclaratoria.
- [x] Migración de lo que ya existe: cada fila de `historias_clinicas` pasa a ser una valoración cerrada llamada "Antecedentes registrados antes de la v2.7", conservando la fecha y el autor. No tiene código de integridad, porque se registró antes de que existiera. La tabla vieja queda solo de lectura hasta la v3.0.
- [x] Se retira el `ON CONFLICT DO UPDATE` de `salud.controller.js`: `POST /api/salud/historias` responde 410.
- [x] Al cerrar, la valoración guarda una copia de los datos de quien atiende con `datosDeQuienAtiende` (viene de la T0.2).
- [x] *Adelantado de la T3.11:* el cierre guarda un código de integridad SHA-256, y `GET /api/valoraciones/:id/integridad` y el botón *Verificar integridad* detectan si algo cambió.
- [x] *Agregado:* para abrir una valoración el deportista debe tener documento (Res. 1995), y una valoración vacía no se cierra.
- [x] *Agregado:* pantalla Salud con la sección *Historia clínica · Valoraciones*:
  - lista de atenciones y editor del borrador;
  - antecedentes que se proponen desde la última valoración cerrada;
  - confirmación antes de cerrar, vista de lectura con notas, y *Mis valoraciones* para el deportista.
- [x] *Agregado:* el administrador no accede a las valoraciones. El middleware `autorizar` lo dejaba pasar siempre; las rutas nuevas usan `autorizarEstricto`.

**Listo cuando:** editar una valoración cerrada responde 409, cada atención aparece como un registro aparte y las historias anteriores siguen visibles.
**Pruebas:** CP-HC-006 a 010 y CP-UI-HC-004 (celular).

### T0.4 Conservación: la información clínica no se borra
> **Estado: ✅ terminada (17-nov-2026).**
> - `npm run test:api`: **161 aprobadas, 0 fallidas** (1 omitida, CP-MIG-002).
> - Interfaz en Chromium: **49 aprobadas, 0 fallidas**.
> - Corrige DEF-053.

**Objetivo:** cumplir los 15 años de conservación de la Res. 839. Hoy, eliminar un deportista borra en cascada toda su información clínica.
- [x] Campos `activo`, `retirado_en` y `motivo_retiro` en el deportista (migración `014`).
  - *Retirar* lo saca del plantel actual, libera su dorsal y conserva todo. Se puede reactivar.
  - *Eliminar* queda solo para registros creados por error. Si tiene historia clínica, la API responde 409 y la pantalla ofrece retirarlo.
- [x] La base impide borrar a un deportista con historia clínica (valoraciones, controles, lesiones o antropometría) y una lesión con seguimientos. **Cambio respecto al plan:** se hizo con un *trigger* en lugar de cambiar las llaves a `RESTRICT`. Así el modo de mantenimiento puede seguir borrando en cascada para limpiar la base de pruebas. Las valoraciones ya tenían `RESTRICT` desde la T0.3. Los consentimientos (Fase 2) seguirán la misma regla.
- [x] Los listados del plantel actual ocultan a los retirados: deportistas, equipos, inicio, head coach, conteos y convocatorias (un retirado no se convoca). En Deportistas hay pestañas *Plantel actual* y *Retirados*. El personal de salud sigue viendo su historia.
- [x] *Agregado:* el listado del head coach dejaba ver los datos sensibles (pertenencia étnica y discapacidad), una falla de la T0.1. Ya está corregido.

**Listo cuando:** retirar un deportista con valoraciones conserva todos sus registros y la base de datos impide borrarlos aunque se intente directamente.
**Pruebas:** CP-HC-011 y 012 (integración) y CP-UI-HC-005 (celular).

### T0.5 Archivos clínicos protegidos
> **Estado: ✅ terminada (17-nov-2026).** El volumen de Railway se comprobó: la foto de un deportista sigue ahí después de un *Redeploy*.
> - `npm run test:api`: **164 aprobadas, 0 fallidas** (1 omitida, CP-MIG-002). Corrige DEF-054.
> - Falta comprobar en Railway que el archivo sigue disponible después de un nuevo despliegue, lo cual requiere el volumen.

**Objetivo:** que los consentimientos escaneados y las fotos de postura solo los vea quien tiene permiso. Hoy `/uploads` es público.
- [x] Carpeta `clinico/` fuera de la ruta pública `/uploads` (`CLINICO_DIR`; en Railway, `/data/clinico`), con nombres aleatorios. `/uploads/clinico` responde 404. La tabla es `archivos_clinicos` (migración `015`) y guarda la huella SHA-256 de cada archivo.
- [x] Ruta `GET /api/archivos-clinicos/:id` que exige sesión y valida el rol y el alcance:
  - la usan el personal de salud y el propio deportista;
  - no tiene caché;
  - cada descarga queda en la bitácora (conectado en la T0.6).
- [x] Solo se aceptan JPG, PNG y PDF de hasta 5 MB, validados por su contenido y no solo por la extensión.
- [x] *Agregado:* los archivos no se modifican ni se borran (trigger). Un deportista con archivos clínicos no se puede eliminar (regla de la T0.4). Se adjuntan solo a valoraciones en borrador del mismo deportista.
- [x] 👤 Crear en Railway un volumen y configurar `UPLOADS_DIR=/data/uploads`. Sin volumen, los archivos se pierden en cada despliegue. Los pasos están en el README, en *Publicar en Railway*. *El volumen se creó el 17-nov-2026 y la app siguió en línea (`/api/health` 200).*
- [x] 👤 Comprobarlo: subir una foto de deportista, hacer *Redeploy* en Railway y ver que la foto sigue ahí. *Comprobado el 17-nov-2026.*
- La pantalla para subir archivos llega con la Fase 1 (componente `CampoFoto`, T1.1) y la Fase 2 (consentimientos, T2.3).

**Listo cuando:** abrir un archivo clínico sin sesión responde 401, con el rol entrenador responde 403, y el archivo sigue disponible después de un nuevo despliegue.
**Pruebas:** CP-HC-013 a 015.

### T0.6 Bitácora de accesos
> **Estado: ✅ terminada (17-nov-2026).**
> - `npm run test:api`: **166 aprobadas, 0 fallidas** (1 omitida, CP-MIG-002).
> - Interfaz en Chromium: **50 aprobadas, 0 fallidas**.

**Objetivo:** saber quién vio o cambió cada historia y cuándo. Con eso se demuestra la confidencialidad que exigen la Res. 1995 y la Ley 1581.
- [x] Tabla `bitacora_clinica` (migración `016`):
  - usuario, con copia de su nombre y su rol;
  - deportista, acción (listar, ver, crear, editar, cerrar, descartar, descargar, verificar, exportar, eliminar), recurso, fecha, hora e IP.
  - Solo admite agregar registros; un trigger impide editarlos o borrarlos.
- [x] Función común `registrar` (`backend/utils/bitacora.js`). Se llama **antes de responder**: si no se puede registrar, la consulta no se entrega. La usan:
  - valoraciones y notas;
  - archivos clínicos (incluida la descarga de la T0.5);
  - controles, seguimientos, lesiones y antropometría;
  - historias anteriores y datos de identificación.
- [x] "Accesos a esta historia" para el personal de salud, por ahora en la sección de valoraciones de Salud; pasa a la ficha clínica en la T1.4.
- [x] Vista general para el administrador (Usuarios → *Bitácora clínica*), solo con quién, qué y cuándo, sin contenido clínico. Tiene filtros por acción, usuario y fechas, y muestra la IP.
- [x] *Agregado:* el deportista ve quién consultó su historia (*¿Quién consultó mi historia?*), por el derecho del titular a conocer el uso de sus datos (Ley 1581).

**Listo cuando:** abrir, cambiar o descargar cualquier registro clínico deja una entrada, y la bitácora no se puede alterar desde la aplicación.
**Pruebas:** CP-HC-016 y 017 (integración) y CP-UI-HC-006 (tableta y computador).

### T0.7 Cada rol ve solo lo que le corresponde
> **Estado: ✅ terminada (17-nov-2026).**
> - `npm run test:api`: **174 aprobadas, 0 fallidas** (1 omitida, CP-MIG-002).
> - Interfaz en Chromium: **51 aprobadas, 0 fallidas**.
> - Corrige DEF-055 (el administrador entraba a lo clínico) y DEF-056 (el entrenador veía el diagnóstico y la antropometría).
> - La matriz aplicada está en `docs/calidad/00_requisitos.md`.

**Objetivo:** aplicar la matriz de acceso que pidió el docente. El entrenador maneja la condición física, no la rehabilitación, y el personal de salud ve solo lo que le incumbe.

| | Personal de salud | Entrenador / head coach | Administrador | Deportista |
|---|---|---|---|---|
| Valoraciones, postura, pruebas semiológicas, diagnóstico | Crea y consulta | ✗ | ✗ | Consulta las suyas (cerradas) |
| Antropometría y signos vitales | Crea y consulta | ✗ | ✗ | Consulta los suyos |
| Pruebas de condición física | Consulta | Crea y consulta | Crea y consulta *(ajuste: no son datos clínicos)* | Consulta las suyas |
| Consentimientos | Gestiona | ✗ | ✗ | Consulta los suyos |
| Disponibilidad (apto, restricciones, fecha de retorno) | La define | Consulta | Consulta | Consulta la suya |
| Usuarios, deportes, equipos | ✗ | Equipos (consulta) | Gestiona | ✗ |
| Estadísticas, convocatorias, asistencia | ✗ (ya está así) | Gestiona | Gestiona | Consulta las suyas |

- [x] Quitar al administrador de las rutas y del menú clínicos: historias, controles y seguimientos (las valoraciones ya lo excluyen desde la T0.3). También se quitó de antropometría y del registro de lesiones.
  - **Ojo:** el middleware `autorizar` deja pasar siempre al administrador, aunque la ruta no lo nombre. Las rutas clínicas deben usar `autorizarEstricto` (creado en la T0.3), y hay que revisar en el controlador cada lugar que da trato especial al administrador.
- [x] Lesiones para el entrenador, el head coach y el administrador: la **API** solo devuelve las fechas, el estado del seguimiento y el retorno estimado, sin el tipo ni la descripción. Lo mismo en el inicio, también en la vista "como lo ve el deportista". Las restricciones de aptitud siguen llegando como disponibilidad.
- [x] Antropometría: en el servidor solo escribe el personal de salud, y solo la consultan salud y el propio deportista; la ficha ya no se la muestra al entrenador ni al administrador.
- [x] El deportista consulta sus valoraciones cerradas en modo lectura (desde la T0.3).
- [x] Actualizar RF-04, RF-05, RF-14, RF-15 y RNF-02 en `docs/calidad/00_requisitos.md` con esta matriz. También RF-16 y RF-17, y una sección con la matriz de acceso clínico.
- [x] *Agregado:* las pruebas físicas las registra el entrenador; el personal de salud ya no, solo las consulta.
- [x] *Agregado:* los avisos de controles vencidos y de antropometría pendiente son solo de salud, y los enlaces del inicio a Salud solo se muestran a quien puede entrar.
- [x] *Agregado:* la protección de páginas (`ProtectedRoute`) también dejaba pasar siempre al administrador. Salud y Antropometría quedan marcadas como `clinico` en el menú: si el administrador escribe la dirección, vuelve al inicio.

**Listo cuando:** cada combinación prohibida responde 403 o 404 en la API y la matriz quedó documentada.
**Pruebas:** CP-ROL-010 a 017 (integración), una por cada fila crítica de la matriz, y CP-UI-HC-007 (celular y tableta). Se ajustaron 9 pruebas anteriores que dependían de los permisos viejos.

### T0.8 Bloqueo por inactividad
> **Estado: ✅ terminada (17-nov-2026).**
> - `npm run test:api`: **175 aprobadas, 0 fallidas** (1 omitida, CP-MIG-002).
> - Interfaz en Chromium: **53 aprobadas, 0 fallidas**.

**Objetivo:** que una tableta olvidada en el consultorio no deje historias a la vista.
- [x] Para el rol de salud, a los 15 minutos **sin tocar la pantalla** (no de trabajo: cualquier toque o tecla reinicia la cuenta), una pantalla opaca cubre todo y pide la contraseña.
  - Un minuto antes avisa con el botón *Sigo aquí*.
  - **El borrador no se pierde:** el bloqueo no recarga la página, y al desbloquear la persona sigue donde iba, con lo escrito. Desde la T1.2, además, el borrador ya está guardado en el servidor cuando llega el bloqueo, así que recargar tampoco pierde nada.
- [x] El tiempo se define en una sola constante (`frontend/src/config/seguridad.js`), para ajustarlo si el docente lo pide.
- [x] *Agregado:* recargar no quita el bloqueo y se comparte entre pestañas; el resto de la página queda inerte; está la opción *No soy yo: cerrar sesión*.
- [x] *Agregado:* `POST /api/auth/desbloquear` usa el mismo límite de intentos del inicio de sesión (5 fallos → 15 minutos).

**Listo cuando:** pasados 15 minutos sin tocar la pantalla aparece el bloqueo y, al volver a entrar, el borrador sigue ahí.
**Pruebas:** CP-AUT-010 (integración), CP-UI-SAL-001 (tableta) y CP-UI-SAL-002 (celular), con el reloj simulado de Playwright.

### T0.9 Cierre de la v2.7
> **Estado: ✅ terminada y publicada (17-nov-2026).** Pull Request #40 con merge a `main` y etiqueta `v2.7`. Railway la desplegó en unos 45 segundos.

- [x] DEF-052 a DEF-056 en `docs/calidad/defectos.md`:
  - historia sobrescrita;
  - borrado en cascada;
  - `/uploads` público;
  - administrador con acceso clínico;
  - lesiones visibles para el entrenador.
- [x] CHANGELOG, requisitos RF-25 (identificación), RF-26 (historia secuencial) y RF-31 (bitácora), y RNF-13 (archivos clínicos) y RNF-14 (conservación). También la matriz de acceso clínico, el README y el informe `docs/calidad/informes/v2.7.md` (228 casos, índice 93/100).
- [x] Pruebas unitarias, de integración y de interfaz en verde: 175 de API y 53 de interfaz en Chromium. Además, un ensayo de migración sobre una base v2.6 con datos, sin pérdida de información.
- [x] Pull Request, merge y etiqueta `v2.7` (PR #40).
- [x] Verificar el despliegue en Railway:
  - `/api/health` responde 200;
  - las rutas nuevas (valoraciones, archivos clínicos, bitácora, desbloqueo) piden sesión (401);
  - `/uploads/clinico` responde 404;
  - las pantallas publicadas tienen las funciones de la v2.7.
  - 👤 Falta entrar con las cuentas y revisar los datos (no inicio sesión con las cuentas reales).

---

## Fase 1. Espacio de trabajo de salud adaptable (v2.8)

**Objetivo de la fase:** construir una sola vez las piezas de interfaz que usan todas las pantallas clínicas, y la ficha del deportista. Deben funcionar igual en celular, tableta y computador.

### T1.1 Componentes para formularios clínicos
> **Estado: ✅ terminada (17-nov-2026).**
> - Los componentes están en `frontend/src/components/clinico/`.
> - Se prueban en la página `/catalogo-clinico`, que solo existe en la compilación de pruebas (`VITE_CATALOGO=1`) y no se publica en Railway.
> - Pruebas CP-UI-SAL-003 a 007 en 5 anchos (360, 390, 768, 1024 y 1440 px).
> - Se revisaron capturas en celular y computador. Por eso, en el celular la barra de acciones quedó en una sola fila, con flechas de *Anterior* y *Siguiente*.
> - Todavía no los usa ninguna pantalla real: los usarán la ficha clínica (T1.4), los consentimientos (Fase 2) y la valoración (Fase 3).

**Objetivo:** tener los componentes que cumplen las reglas de la sección 3, para que cada formulario nuevo salga adaptable sin trabajo extra.
- [x] `FormularioPorSecciones`: pasos en el celular, índice desplegable en la tableta vertical e índice lateral en la tableta horizontal y el computador. Al cambiar de sección, el foco va al título.
- [x] `BarraAcciones` fija abajo en el celular y la tableta, encima del menú inferior.
- [x] `CampoMedida`: número con su unidad, teclado decimal, coma o punto, aviso de rango habitual (no bloquea) y error de rango imposible.
- [x] `OpcionesBoton` (opciones segmentadas de 48 px, con colores para positivo y negativo) y `SelectorLado` (derecho, izquierdo o bilateral).
- [x] `CampoFoto`: cámara trasera o galería, endereza la foto, la comprime a un máximo de 1600 px en JPG, muestra la vista previa y acepta PDF.
- [x] `EstadoGuardado` ("Guardado hace 5 s", "Guardando…", "Sin conexión").
- [x] `SeccionOpcional`, con el interruptor "No evaluado".

**Listo cuando:** una pantalla de prueba con todos los componentes pasa en 360, 390, 768, 1024 y 1440 px sin desplazamiento horizontal, con áreas táctiles de 44 px y sin problemas graves de accesibilidad (axe).
**Pruebas:** CP-UI-SAL-003 a 007.

### T1.2 Guardado automático y ediciones simultáneas
> **Estado: ✅ terminada (18-nov-2026).**
> - Hook reutilizable `frontend/src/components/clinico/usarGuardadoAutomatico.js`, aplicado al editor de valoraciones (`EditorValoracion.jsx`).
> - **Consecuencia para la T0.8:** el bloqueo llega tras 15 minutos sin uso, y para entonces el borrador ya se guardó. Recargar estando bloqueado ya no pierde lo escrito.

**Objetivo:** que no se pierda lo escrito si se cae la conexión o el celular se bloquea, y que dos dispositivos no se pisen.
- [x] El borrador se guarda cada 20 segundos si hay cambios, al ocultarse la página (cambiar de aplicación, bloquear el celular), al pulsar *Guardar borrador* y al cerrar la ventana. El cambio de sección llama a `guardarAhora` cuando la valoración use `FormularioPorSecciones` (Fase 3).
- [x] Control por número de versión: si la valoración cambió en otro dispositivo, el servidor responde 409 y aparece un aviso con dos opciones: *Usar la versión guardada* o *Guardar la mía encima*. Mientras tanto se detiene el guardado automático y no se puede cerrar.
- [x] Sin conexión, los cambios esperan en memoria (nunca en el almacenamiento del navegador, D8) y se reintentan cada 5 segundos y al volver la señal. El estado lo dice: "Sin conexión: se guardará cuando vuelva la señal".
- [x] Antes de salir con cambios sin guardar, se pide confirmación: el navegador al salir de la página, y la ventana al cerrarse si no se pudo guardar.

**Listo cuando:** si se corta la red a mitad de una sección y se reconecta, todo queda guardado. Si dos sesiones editan a la vez, la segunda recibe el aviso.
**Pruebas:** CP-HC-018 y CP-UI-SAL-008, con red simulada sin conexión.

### T1.3 Listado de pacientes
> **Estado: ✅ terminada (18-nov-2026).**
> - Pantalla `/pacientes` (solo personal de salud), en el menú inferior del celular. API `GET /api/pacientes`; cada consulta queda en la bitácora (migración `017_bitacora_paciente.sql`).
> - Por ahora, al tocar un paciente se abren sus valoraciones en *Salud* con el deportista ya elegido. La T1.4 cambia el destino a la ficha clínica.
> - **Pendiente para la Fase 2:** el filtro y el aviso "Falta el consentimiento", porque los consentimientos todavía no existen (T2.1).

**Objetivo:** que el personal de salud encuentre a un deportista en segundos desde el celular.
- [x] Búsqueda por nombre (sin importar tildes ni mayúsculas), documento (con o sin puntos, desde 3 cifras) o dorsal (`#10`).
- [x] Filtros: deporte (el selector general de la app), equipo, lesión activa, borrador sin cerrar, control vencido, sin documento e incluir retirados. Cada filtro rápido muestra cuántos deportistas cumplen. *Consentimiento pendiente: Fase 2.*
- [x] Vista en tarjetas en el celular y la tableta, y en tabla en el computador. Cada uno muestra foto, nombre y dorsal, documento, deporte y equipo, disponibilidad (la misma regla del inicio) y avisos: alergias (de la última valoración cerrada), lesión activa con retorno estimado, restricciones, borradores sin cerrar, control vencido, sin documento, menor de edad y retirado.

**Listo cuando:** en el celular se encuentra a un deportista por su documento con menos de 3 toques.
**Pruebas:** CP-UI-SAL-009.

### T1.4 Ficha clínica del deportista
> **Estado: ✅ terminada (18-nov-2026).**
> - Pantalla `/pacientes/:id`, que se abre al tocar un paciente de la lista. La API `GET /api/pacientes/:id` trae todo en una consulta, que queda en la bitácora una sola vez ("abrió la ficha clínica").
> - **Además de lo pedido:**
>   - los archivos clínicos aparecen en la historia y se descargan desde la ficha (hasta ahora no tenían pantalla);
>   - el botón *Continuar borrador* aparece si quien atiende tiene uno abierto.
> - **Pendiente para la Fase 2:** el aviso de consentimientos en el encabezado y la pestaña *Consentimientos* (T2.3), y que *Nueva valoración* exija el consentimiento firmado (D2, T2.8).

**Objetivo:** una sola pantalla con todo lo clínico del deportista y el botón para iniciar una valoración.
- [x] Encabezado con la identificación y avisos visibles en todas las pestañas: alergias, lesión activa, restricciones, borradores, control vencido, sin documento, menor de edad y retirado. *Consentimientos: T2.3.*
- [x] Línea de tiempo con valoraciones, controles, lesiones (con sus seguimientos), mediciones y archivos clínicos, con filtros por tipo y su conteo. Cada registro se abre desde la ficha.
- [x] Botón *Nueva valoración*, a 1 toque, que propone los antecedentes de la valoración anterior. *Exigir el consentimiento firmado (D2): T2.8.*
- [x] Organización por dispositivo:
  - celular y tableta vertical: pestañas *Resumen*, *Historia* y *Accesos* (la de *Consentimientos* llega con la T2.3), con *Nueva valoración* fija abajo;
  - tableta horizontal y computador: resumen a la izquierda, historia a la derecha y *Accesos* en una ventana.

**Listo cuando:** desde la ficha se llega a cualquier registro del deportista y se puede iniciar una valoración en 1 toque.
**Pruebas:** CP-UI-SAL-010 y 011.

### T1.5 Menú e inicio del rol de salud
> **Estado: ✅ terminada (18-nov-2026).**
> - El inicio del personal de salud abre con el panel *Pendientes de salud*: es lo primero en el celular y encabeza la columna principal en el computador.
> - Cada aviso lleva a su registro: la ficha clínica se abre con ese registro a la vista (`?abrir=`), o el formulario de control viene con el deportista ya elegido.
> - **Además de lo pedido:**
>   - tocar un dorsal de *Disponibilidad del plantel* abre la ficha clínica;
>   - el botón principal de *Mi sesión* pasa a ser *Buscar paciente*.
> - **Decisión:** el menú inferior conserva *Salud*, así que queda *Inicio, Pacientes, Lesiones, Salud* y *Más*. Es el mismo esquema de 4 secciones de los demás roles, y Salud es donde se registran los controles médicos. Si se prefiere el menú de 3 secciones que decía el plan, es cambiar una línea de `navegacion.js`.
> - **Pendiente para la Fase 2:** los consentimientos pendientes.

**Objetivo:** que el personal de salud entre directo a su trabajo.
- [x] Menú inferior: *Inicio*, *Pacientes*, *Lesiones*, *Salud* y *Más* (ver la decisión arriba).
- [x] El inicio muestra:
  - sus borradores sin cerrar → abre el borrador en la ficha;
  - consentimientos pendientes → *Fase 2 (T2.3)*;
  - controles vencidos y de los próximos 7 días → formulario de control con el deportista elegido;
  - deportistas no aptos o con restricciones → el control médico que lo dice;
  - lesiones activas → la lesión con sus seguimientos;
  - deportistas sin antropometría en el semestre → Antropometría.

**Listo cuando:** cada aviso del inicio lleva directamente al registro correspondiente.
**Pruebas:** CP-UI-SAL-012.

### T1.6 Pruebas en todos los anchos y cierre de la v2.8
> **Estado: ✅ terminada y publicada (18-nov-2026).** Pull Request #41 con merge a `main` y etiqueta `v2.8`. Railway la desplegó en menos de un minuto.
> - **Verificado en Railway:** `/api/health` responde 200; las rutas nuevas (`/api/pacientes`, `/api/pacientes/:id`) piden sesión (401); `/uploads/clinico` responde 404; la página publicada trae la ficha, los pendientes de salud y *Buscar paciente*, y no incluye el catálogo de pruebas.
> - 👤 **Falta entrar con la cuenta de salud y abrir *Pacientes*.** No inicio sesión con las cuentas reales. Si la lista carga, la migración 017 quedó aplicada: cada consulta escribe en la bitácora con el recurso nuevo.
> - **Encontrado al probar, y corregido:**
>   - Escape no cerraba las ventanas y el foco no volvía (DEF-059);
>   - la lista de pacientes desbordaba en 1024 px (DEF-060);
>   - un enlace del inicio de salud solo se distinguía por el color (DEF-061).
> - **Ensayo de migración:** una base creada con el despliegue de la v2.7 (plantel de demostración y datos clínicos) pasó dos veces por `preparar_despliegue.js` de la v2.8 con los mismos conteos antes y después. El recurso `paciente` de la bitácora quedó habilitado.

- [x] Agregar la tableta horizontal (1024 × 768) a `pruebas/ui/ayuda.js` y probar el cambio de orientación (CP-UI-PC-001). El recorrido de los 5 roles corre ahora en 5 anchos.
- [x] Repetir en **computador (1440 px)** los flujos clínicos que hoy se prueban en celular y tableta: identificación, valoración (abrir, guardar, cerrar, nota), retirar y reactivar (CP-UI-PC-002 a 004).
- [x] Uso con **teclado** en computador (hook `usarVentana` en todas las ventanas):
  - Tab recorre los campos en orden y con foco visible, sin salirse de la ventana;
  - Enter guarda (`onEnviar`) y Escape cierra la ventana de arriba;
  - Ctrl+S (Cmd+S en Mac) guarda el borrador de la valoración.
- [x] Extender el recorrido de `responsive.spec.js` a las pantallas nuevas (CP-UI-RES-005: lista y ficha en los 5 anchos).
- [x] Actualizar `DESIGN.md` con los patrones de formulario clínico (sección 10, con capturas) y RNF-12 en el catálogo.
- [x] CHANGELOG, informe `docs/calidad/informes/v2.8.md` (248 casos, índice 95/100), Pull Request #41, etiqueta `v2.8` y verificación en Railway.

---

## Fase 2. Consentimientos (v2.9)

**Objetivo de la fase:** registrar el consentimiento y el asentimiento firmados a mano, con su estado y la imagen del papel, separando la atención, el tratamiento de datos y el uso para investigación. Desde la v2.9, además, nadie usa el sistema ni se registra a nadie sin una aceptación del manejo de datos que quede registrada, y el administrador lo audita todo (D9 a D13).

### T2.1 Modelo y reglas
> **Estado: ✅ terminada (18-nov-2026).**
> - **Dónde está:** migración `018_consentimientos.sql`; reglas en `frontend/src/utils/consentimientos.js` (las mismas que usará la pantalla de la T2.3); API `/api/consentimientos`.
> - **Cómo se guarda el historial:** cada acto (firma, rechazo o revocación) es un registro aparte con su fecha, que no se modifica ni se borra (trigger, como las valoraciones cerradas). El estado de cada tipo es el de su último registro; sin registros, *pendiente*. Por eso "pendiente" no se guarda: es la falta de registro.
> - **El papel firmado** se guarda como archivo clínico (`tipo = consentimiento`) en la misma transacción. Si algo falla, no queda ni el consentimiento ni el archivo.
> - **Además:**
>   - lo firmado no se puede "rechazar" después, solo revocar con su motivo;
>   - para investigación con un menor, sin su asentimiento el consentimiento no autoriza (se aplicará en la T2.8);
>   - quien tiene consentimientos tampoco se puede eliminar (regla de la T0.4);
>   - la bitácora tiene la acción nueva "revocó".

**Objetivo:** guardar cada consentimiento con su historial completo.
- [x] Tabla `consentimientos`:
  - deportista y tipo (`atencion`, `datos_personales` o `investigacion`);
  - estado (`pendiente`, `firmado`, `rechazado` o `revocado`) y fecha de firma;
  - quién firma (el deportista o el acudiente), con nombre y documento;
  - asentimiento del menor (sí o no; vacío si es mayor de edad);
  - archivo del papel firmado, versión del formato y quién lo registró;
  - fecha y motivo de la revocación.
- [x] Reglas:
  - Para estar *firmado* hay que adjuntar el archivo.
  - Si el deportista es menor, firma el acudiente y debe registrarse el asentimiento.
  - Revocar no borra nada: crea un nuevo estado y deja el historial.
  - El consentimiento de investigación es opcional e independiente; negarlo no afecta la atención.

**Listo cuando:** las cuatro reglas se cumplen en la API con mensajes claros.
**Pruebas:** CP-CON-001 a 006.

### T2.2 Formatos para imprimir 🩺
> **Estado: 🟡 borradores listos (18-nov-2026), esperan la revisión del docente.**
> - **Para la reunión:** `docs/plan/formatos/` tiene los PDF (los cuatro en blanco y un ejemplo diligenciado con datos ficticios) y una guía de revisión con las 7 decisiones que conviene confirmar.
> - **En la aplicación** (solo personal de salud), sin el menú, para imprimir solo la hoja:
>   - `/pacientes/:id/formatos/:tipo`, con los datos del deportista;
>   - `/formatos-consentimiento/:tipo`, en blanco.
> - **Dónde están los textos:** `frontend/src/utils/formatosConsentimiento.js`. Lo que solo puede completar la universidad va resaltado como "[Completar: …]".

**Objetivo:** que el equipo tenga los formatos listos para imprimir y firmar, con los datos del deportista ya diligenciados.
- [x] Cuatro formatos:
  - consentimiento para la atención fisioterapéutica;
  - autorización de tratamiento de datos personales (Ley 1581), con su finalidad y los derechos del titular;
  - consentimiento para uso en investigación (Res. 8430);
  - asentimiento del menor.
- [x] Hoja de impresión en tamaño carta, con espacio para la firma, el documento y la huella (CP-UI-CON-001: cada uno cabe en una hoja, en blanco y diligenciado).
- [x] Los textos se entregan como **borrador** para que los revisen el docente o la universidad. No los damos por definitivos nosotros.
- [ ] 👤 Aprobación del docente y datos de la universidad (contacto de protección de datos, política, comité de ética).

**Listo cuando:** 👤 el docente aprobó los textos y se imprimen bien en una sola hoja cada uno.

### T2.3 Pantalla de consentimientos
> **Estado: ✅ terminada (18-nov-2026).**
> - **Dónde se ve:**
>   - en celular y tableta vertical, en la pestaña *Consentimientos* de la ficha;
>   - en tableta horizontal y computador, en un panel arriba de la columna izquierda.
>   - El componente es `frontend/src/components/clinico/Consentimientos.jsx`.
> - **"Falta firmar"** se refiere a la atención y a los datos personales. El de investigación es opcional y no cuenta como pendiente.
> - **En el celular** las 4 pestañas no caben en 360 px: la barra se desliza de lado y un desvanecido avisa que hay más.

**Objetivo:** registrar una firma en menos de un minuto desde la tableta.
- [x] Pestaña *Consentimientos* de la ficha clínica: una tarjeta por tipo, con su estado y fecha, y el historial de cada tipo.
- [x] Lo que quedó pendiente de la Fase 1:
  - aviso "Falta firmar" en el encabezado de la ficha (T1.4), que se toca y lleva a los consentimientos;
  - aviso y filtro "Consentimiento pendiente" en la lista de pacientes (T1.3);
  - consentimientos sin firmar en el inicio del personal de salud (T1.5), que llevan a la pestaña.
- [x] Acciones de cada tarjeta:
  - *Imprimir formato*;
  - *Registrar firma*: pregunta quién firma, toma la foto con la cámara, pide el asentimiento si es menor y guarda;
  - *Revocar*, con el motivo;
  - *Ver soporte*, que abre la imagen por la ruta protegida.

**Listo cuando:** en el celular se registra un consentimiento firmado con su foto, y la imagen solo la abre el personal de salud.
**Pruebas:** CP-UI-SAL-013 y 014.

### T2.4 Avisos de manejo de datos 🩺
> **Estado: ✅ terminada (18-nov-2026); los textos esperan la revisión del docente.**
> - **Dónde está:**
>   - textos en `frontend/src/utils/avisos.js`;
>   - tabla `aceptaciones` (migración `019_aceptaciones.sql`);
>   - API `GET /api/avisos/mios` y `POST /api/avisos/aceptar`.
> - **Para el docente:** `docs/plan/formatos/avisos-borrador.md` se genera desde el mismo archivo de textos.
> - **Cómo se guarda cada aceptación:** con el aviso, la versión y la huella SHA-256 del texto exacto. Aceptar una versión vieja responde 409 ("El texto cambió").
> - **Qué falta:** todavía no se exige. Lo exige la T2.5 (personal) y lo usa la T2.6 (deportistas).

**Objetivo:** los textos que todos aceptan, con su versión, y el registro de cada aceptación.
- [x] Textos, como **borradores** para el docente y la universidad (igual que los formatos de la T2.2), en `frontend/src/utils/avisos.js`:
  - **Compromiso del personal** (todos los roles):
    - confidencialidad y uso de los datos solo para su función;
    - veracidad de lo que registra;
    - protección de datos (Ley 1581 de 2012);
    - reserva de la historia clínica (Res. 1995 de 1999).
    - El de salud agrega la responsabilidad clínica (Ley 528 de 1999) y la supervisión de practicantes y estudiantes.
  - **Aviso de privacidad del deportista:** qué datos se guardan, para qué, quién los ve y sus derechos. Tiene una versión en lenguaje sencillo para menores de edad.
  - **Declaración de quien registra:** "Informé al deportista (o a su acudiente) y autorizó el registro y el uso de sus datos". Hay una para el registro individual y otra para la carga masiva.
- [x] Cada texto tiene versión. Si cambia, hay que aceptar de nuevo.
- [x] Tabla `aceptaciones`, que no se modifica ni se borra. Guarda:
  - quién aceptó y qué texto, con su versión;
  - sobre qué deportista o qué carga masiva;
  - cuándo y desde qué IP;
  - el testigo, si lo hubo.

**Listo cuando:** cada aceptación queda registrada con su versión. 👤 Los textos rigen como borradores hasta que el docente y la universidad los aprueben; al aprobarlos cambia la versión y todos aceptan de nuevo.
**Pruebas:** CP-AVI-001 a 003.

### T2.5 Aceptación del personal al iniciar sesión
> **Estado: ✅ terminada (18-nov-2026).**
> - **En la API:** el filtro `backend/middleware/aceptacion.js` va antes de todas las rutas, salvo `/api/auth` y `/api/avisos`.
>   - Responde 403 con `codigo: ACEPTACION_PENDIENTE` a quien no ha aceptado su aviso.
>   - Recuerda por 5 minutos a quien ya aceptó, para no consultar la base en cada petición.
> - **En la pantalla:** mientras falte la aceptación, en lugar de cualquier página aparece el aviso (`AceptarAviso.jsx`).
> - **También el deportista en su cuenta:** el mismo mecanismo le muestra su aviso de privacidad, que es la vía "en su cuenta" de la T2.6.
> - **Pruebas:**
>   - `token()` (API) y `entrar()` (navegador) aceptan el aviso, como lo haría la persona;
>   - las pruebas de navegador empiezan con las cuentas de prueba ya aceptadas (`pruebas/utilidades/avisos.js`);
>   - las pruebas del aviso usan cuentas nuevas.

**Objetivo:** que nadie del personal trabaje con datos sin haber aceptado su compromiso (D9).
- [x] **Cuándo aparece:** al entrar por primera vez, o cuando cambia la versión del texto, el usuario ve el compromiso de su rol y marca "Leí y acepto". Sin aceptar, solo puede salir.
- [x] **La API también lo exige:** quien no ha aceptado recibe 403 ("Acepta el compromiso de manejo de datos para continuar") en cualquier ruta, salvo las de la sesión.
- [x] **A quién aplica:** a todo usuario nuevo, se cree uno por uno o por CSV. *Que quien lo creó quede en la auditoría llega con la T2.7.*
- [x] **Diseño:** pantalla para celular y computador, con el texto completo a la vista y la casilla y el botón siempre a la mano.

**Listo cuando:** un usuario nuevo no puede consultar ni registrar nada hasta aceptar, y su aceptación queda registrada con la versión.
**Pruebas:** CP-AVI-004 a 006 y CP-UI-AVI-001.

### T2.6 Autorización del deportista
> **Estado: ✅ terminada (18-nov-2026).**
> - **Dónde está:**
>   - migración `020_autorizacion_deportista.sql` (tabla `cargas_masivas` y marca `autorizacion_previa`);
>   - reglas compartidas del backend en `backend/utils/autorizaciones.js`;
>   - en la pantalla, `DeclaracionCasilla.jsx` y `AceptacionDeportista.jsx`.
> - **La declaración se exige en los cuatro caminos que crean personas:**
>   - el formulario de Deportistas;
>   - la carga CSV de Deportistas;
>   - la cuenta de deportista con ficha nueva, desde Usuarios;
>   - la carga CSV de usuarios.
> - **Estado de cada deportista:** *completa*, *falta la aceptación propia*, *previa* (demostración) o *sin declaración*. Se ve en la ficha clínica, la lista de pacientes (con filtro) y la ficha de Deportistas.
> - **Decisión de paso:** un deportista registrado por error y sin historia clínica se puede seguir eliminando; sus declaraciones se borran con él. Nadie más las puede borrar.

**Objetivo:** que todo deportista nuevo entre al sistema con autorización y que él mismo sepa que se trabaja con su información (D10).
- [x] **Registro uno por uno:** casilla obligatoria con la declaración de quien registra. Sin ella no se guarda, sea quien sea el que registra.
- [x] **Carga masiva** (CSV de deportistas o de usuarios):
  - quien carga acepta la declaración de la carga;
  - queda registrada la carga: archivo, huella SHA-256 y filas creadas, actualizadas y rechazadas;
  - cada persona cargada queda con su propia aceptación pendiente.
- [x] **Aceptación propia del deportista**, por cualquiera de tres caminos:
  - en su cuenta, al entrar (con la versión para menores si aplica);
  - en la tableta del profesional: el deportista lee el aviso y marca "Acepto" con su nombre, y el profesional queda como testigo;
  - con la autorización de datos personales firmada en papel (T2.3).
- [x] **Mientras falte**, la ficha y la lista de pacientes muestran "Falta la aceptación del deportista", y se puede filtrar por eso.
- [x] **Datos de antes de esta versión** (de demostración, D11): quedan exentos, marcados como "Registrado antes de las autorizaciones".

**Decidido (18-nov-2026):** si falta la aceptación propia del deportista, **solo se avisa**; no se bloquea la atención. La declaración de quien registra ya es obligatoria, y muchos deportistas no tienen cuenta propia.

**Listo cuando:**
- no se puede registrar a nadie, ni uno por uno ni por CSV, sin la declaración;
- la aceptación propia del deportista queda registrada por cualquiera de los tres caminos.

**Pruebas:** CP-AVI-007 a 012 y CP-UI-AVI-003 a 004.

### T2.7 Módulo de auditoría del administrador
> **Estado: ✅ terminada (18-nov-2026).**
> - **Dónde está:**
>   - migración `021_auditoria.sql` (tablas `auditoria` y `ajustes`);
>   - `backend/utils/auditoria.js` y la API `/api/auditoria`;
>   - la pantalla `Auditoria.jsx`, en *Gestión*.
> - **Cómo se registra:** la auditoría se escribe antes de responder, como la bitácora. Solo los inicios de sesión fallidos no bloquean la respuesta si no se pueden registrar.
> - **Encontrado de paso:** *Pacientes* faltaba en el menú lateral del computador desde la v2.8 (DEF-062). Corregido.
> - **La bitácora de la historia clínica** sigue también en *Usuarios*, para no cambiar dos caminos a la vez.

**Objetivo:** que el administrador vea en un solo lugar quién hizo qué con los datos y cuándo (D13).
- [x] **Módulo *Auditoría***, exclusivo del administrador: ningún otro rol lo ve ni entra por la API.
- [x] **Registro de auditoría** (tabla `auditoria`), que no se modifica ni se borra y nunca guarda contenido clínico. Incluye:
  - altas de personas (deportistas y usuarios), una por una o por carga masiva;
  - cargas masivas, con su archivo, huella, resultado y declaración;
  - aceptaciones y declaraciones: quién, qué versión, cuándo, IP y testigo;
  - gestión de cuentas: crear, desactivar, cambiar de rol, restablecer la contraseña y desbloquear;
  - inicios de sesión fallidos y bloqueos;
  - accesos a la historia clínica: la bitácora de la T0.6, que pasa a este módulo.
- [x] **Pantalla:**
  - filtros por tipo de registro, persona y fechas;
  - el detalle de cada carga masiva;
  - *Aceptaciones pendientes*: personal y deportistas;
  - exportar a CSV, que también queda registrado.
  - En celular, una lista; en computador, una tabla.
- [x] **Ajuste "Exigir el consentimiento de atención para valorar"** (D2): está apagado y lo enciende el administrador cuando el docente apruebe los formatos. El cambio queda en la auditoría.

**Listo cuando:** cada alta, carga, aceptación, cambio de cuenta y acceso aparece en *Auditoría* con quién y cuándo, y ningún otro rol puede verlo.
**Pruebas:** CP-AUD-001 a 006 y CP-UI-AUD-001.

### T2.8 Reglas que dependen del consentimiento
> **Estado: ✅ terminada (18-nov-2026). La regla D2 queda apagada.**
> - **Dónde están las reglas:** `backend/utils/reglasConsentimiento.js` y `exportable()` en `frontend/src/utils/consentimientos.js`.
> - **Regla D2:** solo actúa con el ajuste del módulo de Auditoría encendido. La ficha avisa antes de abrir el editor, con el botón *Registrar el consentimiento*.
> - **Exportaciones:** todavía no existen (Fase 4). La regla `filtrarParaExportacion(ids, 'fhir' | 'investigacion')` queda lista y probada para usarse allí.

**Objetivo:** que el sistema haga cumplir lo firmado.
- [x] Sin el consentimiento de atención firmado, iniciar una valoración responde 409 con el mensaje "Falta el consentimiento de atención" y un botón para registrarlo (D2). **Queda apagada** con el ajuste de la T2.7 hasta que el docente apruebe los formatos (D12).
- [x] Sin la autorización de datos personales, el deportista queda fuera de la exportación FHIR (Fase 4).
- [x] Sin el consentimiento de investigación, queda fuera de cualquier exportación con fines de investigación. Si es menor, también sin su asentimiento.

**Listo cuando:** las tres reglas tienen su prueba en verde, también con el ajuste encendido y apagado.
**Pruebas:** CP-CON-007 a 009.

### T2.9 Cierre de la v2.9
> **Estado: lista para publicar (18-nov-2026).** La migración se ensayó desde la v2.8, dos veces y sin errores. Faltan el Pull Request, la etiqueta y la verificación en Railway.

- [x] En el catálogo de requisitos: RF-27 (consentimientos, ya está), RF-32 (avisos y aceptaciones) y RF-33 (auditoría).
- [x] CHANGELOG y datos de demostración con consentimientos y aceptaciones en distintos estados (CP-CON-010).
- [ ] Pull Request, etiqueta `v2.9` y verificación en Railway.

---

## Fase 3. Valoración fisioterapéutica (v3.0)

**Objetivo de la fase:** el formulario de valoración, en el mismo orden del tablero. Cada sección tiene su tabla, ligada a la valoración; todas son opcionales y se pueden marcar "No evaluado". Las secciones T3.1 a T3.9 se pueden hacer en cualquier orden, porque todas usan los componentes de T1.1.

### T3.1 Registro inicial
**Objetivo:** dejar el motivo por el que se atiende al deportista.
- [ ] Tipo de valoración, motivo de consulta, enfermedad actual y quién lo remite (entrenador, médico o el mismo deportista).

**Listo cuando:** la sección se guarda, aparece en el resumen y se puede marcar "No evaluado".

### T3.2 Anamnesis
**Objetivo:** registrar los antecedentes ordenados por tipo, en lugar de texto libre.
- [ ] Antecedentes personales:
  - patológicos, quirúrgicos y hospitalarios;
  - traumáticos y osteomusculares;
  - farmacológicos y alérgicos.
- [ ] Antecedentes familiares.
- [ ] Hábitos: sueño, tabaco, alcohol y alimentación.
- [ ] Historia deportiva: años de práctica, horas por semana, posición y lesiones previas.
- [ ] Cada nueva valoración propone los antecedentes de la anterior, con el botón *Sin cambios*.
- [ ] Las alergias registradas aparecen como alerta en la ficha.

**Listo cuando:** en una segunda valoración los antecedentes aparecen ya diligenciados y se confirman con un toque.
**Pruebas:** CP-HC-020.

### T3.3 Antecedentes ginecológicos (solo deportistas mujeres) 🩺
**Objetivo:** registrar la historia del ciclo menstrual, que es clave para detectar el riesgo de baja disponibilidad energética (RED-S, consenso del COI de 2023).
- [ ] Datos del ciclo:
  - edad de la menarquia y fecha de la última menstruación;
  - duración del ciclo y del sangrado, en días;
  - regularidad y dolor menstrual (escala de 0 a 10).
- [ ] Anticonceptivos hormonales (sí o no, y de qué tipo).
- [ ] Amenorrea (sí o no, y cuántos meses).
- [ ] Embarazos (opcional).
- [ ] Puntaje del cuestionario **LEAF-Q** (opcional), con el aviso "riesgo" cuando es 8 o más.
- [ ] La sección solo aparece si la deportista es mujer. La ven solo el personal de salud y la propia deportista.
- [ ] Se decide por el sexo registrado en la ficha (el mismo que usan las fórmulas de antropometría). Si no está registrado, la valoración pide registrarlo antes de mostrar o esconder la sección; nunca se asume.

**Listo cuando:** 👤 el docente validó los campos, la sección no aparece para los hombres y el puntaje LEAF-Q marca el riesgo.
**Pruebas:** CP-HC-021.

### T3.4 Observación postural (Kendall) 🩺
**Objetivo:** registrar la evaluación postural con plomada por vistas y segmentos.
- [ ] Vistas anterior, posterior y laterales.
- [ ] Segmentos: cabeza, hombros, escápulas, columna (cervical, dorsal y lumbar), pelvis, rodillas y pies.
- [ ] Cada segmento se marca *Normal* o *Alterado*. Si está alterado, se elige el hallazgo de una lista sugerida (por ejemplo: hombro elevado, escápula alada, hiperlordosis, genu valgo, pie plano) o se escribe una nota.
- [ ] Fotos opcionales de cada vista, por la ruta protegida.
- [ ] Resumen automático: "Hallazgos: …".
- [ ] Organización por dispositivo: en el celular, una vista por paso; en la tableta, la foto a la izquierda y la lista a la derecha.

**Listo cuando:** 👤 el docente aprobó la lista de hallazgos y una evaluación completa en el celular toma menos de 3 minutos sin las fotos.
**Pruebas:** CP-HC-022 y CP-UI-SAL-015.

### T3.5 Signos vitales
**Objetivo:** registrar la frecuencia cardiaca, la presión arterial y la frecuencia respiratoria del tablero.
- [ ] FC en lpm, PA sistólica y diastólica en mmHg, FR en rpm y, de forma opcional, SpO₂ (%) y temperatura.
- [ ] Condición de la toma (reposo o después del esfuerzo).
- [ ] Avisos de rango. Por ejemplo: FC fuera de 30–220, o PA sistólica menor que la diastólica.
- [ ] Gráfica de la evolución en la ficha.

**Listo cuando:** un valor imposible se rechaza, uno raro solo muestra un aviso, y la evolución se ve en la ficha.
**Pruebas:** CP-HC-023.

### T3.6 Composición corporal: pliegues e impedanciometría
**Objetivo:** registrar la composición por los dos métodos del tablero y mostrar de qué método sale cada valor.
- [ ] Desde la valoración se crea una medición ISAK o se enlaza una existente (el módulo actual).
- [ ] Impedanciometría, registrada a mano desde el equipo:
  - nombre del equipo;
  - % de grasa, masa muscular (kg), agua corporal (%), grasa visceral y metabolismo basal (opcional).
- [ ] La comparación muestra lado a lado los dos métodos, con su nombre ("Pliegues: Yuhasz-Carter" e "Impedancia: equipo X").

**Listo cuando:** una valoración puede tener los dos métodos y nunca se mezclan sus resultados.
**Pruebas:** CP-HC-024.

### T3.7 Longitud de segmentos 🩺
**Objetivo:** medir los miembros superiores e inferiores. Esto **no existía**: hoy solo hay perímetros y diámetros.
- [ ] MMSS: longitud total, brazo, antebrazo y mano.
- [ ] MMII:
  - longitud real (EIAS al maléolo medial) y aparente (ombligo al maléolo medial);
  - muslo y pierna.
- [ ] Cada medida se toma en el lado derecho y el izquierdo, y se calcula la diferencia.
- [ ] Se resaltan las diferencias desde 1 cm. El umbral se ajusta a lo que defina el docente.

**Listo cuando:** 👤 el docente validó los puntos de referencia y el umbral, y la diferencia se calcula y resalta.
**Pruebas:** CP-UNI-025 (cálculo) y CP-HC-025.

### T3.8 Pruebas específicas (opcional)
**Objetivo:** registrar pruebas de fuerza, flexibilidad, velocidad y resistencia sin cerrar la lista, porque el docente las dejó opcionales por ser muy amplias.
- [ ] Registro abierto:
  - categoría (fuerza, flexibilidad, velocidad, resistencia u otra) y prueba (con sugerencias: dinamometría manual, *sit and reach*, sprint de 30 m, *Course Navette*, salto CMJ);
  - resultado y unidad, lado, instrumento o tecnología (D7) y observación.
- [ ] Muestra, en modo de solo lectura, las pruebas de condición física que registró el entrenador.

**Listo cuando:** se puede registrar cualquier prueba sin que el sistema exija una lista fija.
**Pruebas:** CP-HC-026.

### T3.9 Pruebas semiológicas 🩺
**Objetivo:** registrar las pruebas clínicas por región, con su lado y resultado.
- [ ] Catálogo sugerido por región, más la opción de escribir otra:
  - rodilla: Lachman, cajón anterior y posterior, McMurray, estrés en valgo y en varo;
  - hombro: Neer, Hawkins-Kennedy, Jobe, Speed;
  - tobillo: cajón anterior, inclinación talar;
  - columna y cadera: Lasègue, Thomas, Ober.
- [ ] Para cada prueba: lado, resultado (positivo, negativo o no concluyente) y observación.
- [ ] Organización por dispositivo: en el celular, primero la región y luego la lista con los botones de resultado; en la tableta, región y pruebas en dos columnas.

**Listo cuando:** 👤 el docente aprobó el catálogo y una prueba se registra con 3 toques.
**Pruebas:** CP-HC-027.

### T3.10 Diagnóstico CIE-10 y plan
**Objetivo:** cerrar la valoración con una observación final y un diagnóstico codificado en CIE-10, como pidió el docente.
- [ ] Cargar la tabla de referencia CIE-10 del MinSalud (SISPRO) en la tabla `cie10`, con su fecha y fuente.
- [ ] Buscador que, mientras se escribe, encuentra por código o por palabras sin importar las tildes, y muestra primero los capítulos osteomusculares y de traumatismos.
- [ ] Diagnósticos:
  - un diagnóstico principal y hasta tres relacionados;
  - tipo de diagnóstico: impresión diagnóstica, confirmado nuevo o confirmado repetido;
  - campo CIE-11 opcional, que queda vacío durante la transición.
- [ ] Diagnóstico fisioterapéutico (texto) y observación final.
- [ ] Plan y conducta: objetivos, tratamiento y recomendaciones.
- [ ] Aptitud deportiva (apto, apto con restricciones o no apto temporal). Al cerrar, actualiza la disponibilidad que ve el entrenador.

**Listo cuando:** en el celular se encuentra "M23" o "menisco" en menos de 1 segundo, y el entrenador ve la nueva aptitud pero no el diagnóstico.
**Pruebas:** CP-HC-028 a 030.

### T3.11 Revisión, cierre y firma de la valoración
**Objetivo:** que el profesional revise todo y firme. Desde ese momento la valoración no se puede alterar.
- [ ] Resumen de revisión con todas las secciones; las marcadas "No evaluado" se ven como tales.
- [ ] Para cerrar se exige el consentimiento firmado. El registro profesional **no** se exige (D1).
- [ ] Al cerrar se guardan la fecha y la hora, la copia de los datos de quien atendió (vínculo, registro si lo hay y supervisor, T0.2) y un **código de integridad** (SHA-256 del contenido).
- [ ] Botón "Verificar integridad" que confirma que la valoración no cambió.

**Listo cuando:** una valoración cerrada no se puede editar y la verificación de integridad detecta cualquier cambio hecho directamente en la base de datos.
**Pruebas:** CP-HC-031 y 032.

### T3.12 Impresión de la valoración
**Objetivo:** tener una copia para el archivo físico o para entregarle al deportista.
- [ ] Hoja de impresión (imprimir y guardar como PDF desde el navegador, sin agregar librerías pesadas).
- [ ] Contiene: encabezado con la identificación, todas las secciones, los diagnósticos con su código y las notas aclaratorias.
- [ ] Al final, quién atendió: su registro profesional si lo tiene, o su condición de practicante o estudiante y el nombre del supervisor. Hay espacio para la firma de quien atendió y, si lo hay, del supervisor.

**Listo cuando:** se imprime correctamente desde el computador y desde la tableta.
**Pruebas:** CP-UI-SAL-016.

### T3.13 Datos de demostración y cierre de la v3.0
- [ ] Valoraciones completas de demostración para un hombre, una mujer (con antecedentes ginecológicos) y un menor de edad (con acudiente y asentimiento).
- [ ] Requisitos RF-28 (valoración) y RF-29 (CIE-10), CHANGELOG, `PLAN_CALIDAD` e informe de la versión.
- [ ] Se retira la tabla vieja `historias_clinicas`, que ya se migró en T0.3.
- [ ] 👤 Recorrido completo con el docente, en tableta y en celular.
- [ ] Pull Request, etiqueta `v3.0` y verificación en Railway.

---

## Fase 4. Interoperabilidad HL7 FHIR (v3.1)

**Objetivo de la fase:** exportar la historia de un deportista en HL7 FHIR R4, siguiendo los perfiles de la guía RDA de Colombia.

### T4.1 Mapeo de datos a FHIR
**Objetivo:** documentar cómo se traduce cada dato del sistema a FHIR.

| Del sistema | Recurso FHIR (perfil RDA cuando existe) |
|---|---|
| Deportista | `Patient` (PatientRDA: documento con su código de tipo y sistema RNEC, nacionalidad, etnia, discapacidad, residencia) |
| Quien atendió y su supervisor | `Practitioner` (PractitionerRDA: documento, y RETHUS si lo tiene). Si el perfil exige RETHUS, la valoración de un practicante se exporta con el supervisor como responsable; si no hay supervisor, queda como advertencia documentada en T4.3. |
| Valoración | `Encounter` (EncounterAmbulatoryRDA) |
| Diagnóstico | `Condition` (ConditionRDA, sistema `http://hl7.org/fhir/sid/icd-10`) |
| Signos vitales, peso, talla, IMC, % de grasa | `Observation`, perfil de signos vitales de FHIR con códigos LOINC: FC 8867-4, FR 9279-1, PA 85354-9 (8480-6 y 8462-4), peso 29463-7, talla 8302-2, IMC 39156-5, % de grasa 41982-0. El RDA no tiene un perfil propio para esto. |
| Postura, pruebas, longitudes | `Observation` |
| Consentimientos | `Consent`, de FHIR base (el RDA no lo define) |
| La historia completa | `Composition` y `Bundle` de tipo documento |

- [ ] Documentarlo en `docs/interoperabilidad/fhir.md`, con un ejemplo de datos ficticios.

### T4.2 Exportación
**Objetivo:** que el personal de salud descargue la historia en FHIR con un botón.
- [ ] Ruta `GET /api/fhir/pacientes/:id` que devuelve un `Bundle` JSON. Solo la usa el personal de salud y requiere la autorización de datos personales (T2.8).
- [ ] Botón *Exportar FHIR* en la ficha clínica, que deja registro en la bitácora.

**Listo cuando:** el archivo se descarga en el celular y en el computador, y un deportista sin autorización no se puede exportar.
**Pruebas:** CP-FHIR-001 a 003.

### T4.3 Validación con el validador oficial
**Objetivo:** demostrar que la exportación cumple el estándar.
- [ ] Script `npm run validar:fhir` con el validador oficial de HL7 y el paquete `minsalud.fhir.co.rda#1.0.3`.
- [ ] Corregir los errores y documentar lo que queda por fuera del RDA, con su motivo.

**Listo cuando:** el ejemplo de demostración pasa sin errores. Las advertencias que queden deben estar documentadas.

### T4.4 Cierre del proyecto (v3.1)
- [ ] Revisar si ya se expidió la resolución que reemplaza la 1995 y la 839, y ajustar si hace falta.
- [ ] RF-30 (FHIR), informe de calidad de la v3.1 y `DESIGN.md`.
- [ ] Manual corto para el equipo de salud: cómo hacer una valoración desde la tableta.
- [ ] Pull Request, etiqueta `v3.1` y verificación en Railway.

---

## 4. Resumen del avance

| Fase | Versión | Tareas | Terminadas |
|---|---|---|---|
| 0. Base legal y de seguridad | v2.7 | 9 | **9 ✅ (publicada)** |
| 1. Espacio de trabajo de salud adaptable | v2.8 | 6 | **6 ✅ (publicada)** |
| 2. Consentimientos, avisos y auditoría | v2.9 | 9 | 7 (T2.1, T2.3 a T2.8; T2.2 espera al docente) |
| 3. Valoración fisioterapéutica | v3.0 | 13 | 0 |
| 4. Interoperabilidad HL7 FHIR | v3.1 | 4 | 0 |
| **Total** | | **41** | **22** |

**Puntos de revisión con el docente** 🩺:
- textos de los consentimientos (T2.2);
- antecedentes ginecológicos (T3.3);
- hallazgos posturales (T3.4);
- puntos de referencia y umbral de las longitudes (T3.7);
- catálogo de pruebas semiológicas (T3.9);
- recorrido final (T3.13).

Conviene reunir los cinco primeros en una sola reunión antes de empezar la Fase 3.

## Fuentes
- Res. 1995 de 1999 y concepto de la Supersalud: https://normograma.supersalud.gov.co/compilacion/docs/concepto_supersalud_0149773_2020.htm
- Borrador de 2026 que reemplazaría las resoluciones 1995 y 839: https://www.minsalud.gov.co/Normativa/proyactadm/PR%20HISTORIA%20CLINICAAJUSTADO22072026_20260722151143.pdf
- Res. 839 de 2017: https://www.minsalud.gov.co/Normatividad_Nuevo/Resolucion%20No%20839%20de%202017.pdf
- Res. 1888 de 2025 (RDA): https://lector.ramajudicial.gov.co/SIDN/NORMATIVA/TEXTOS_COMPLETOS/8_RESOLUCIONES/RESOLUCIONES%202025/MSPS%20Resolucion%20000018888%20de%202025.pdf
- Guía FHIR RDA v1.0.3: https://vulcano.ihcecol.gov.co/ (perfiles PatientRDA, ConditionRDA, PractitionerRDA y CompositionRDA)
- Res. 1442 de 2024 (CIE-11): https://www.alcaldiabogota.gov.co/sisjur/normas/Norma1.jsp?i=160237&dt=S
- Res. 1657 de 2025 (transición de 36 meses): https://www.alcaldiabogota.gov.co/sisjur/normas/Norma1.jsp?i=189413&dt=S
- Ley 1581 de 2012: https://www.unidadvictimas.gov.co/wp-content/uploads/Documentos/ley/Ley_1581_2012.pdf
- Res. 8430 de 1993 y asentimiento: https://www.redalyc.org/pdf/1892/189232131006.pdf
- Ley 528 de 1999: https://www.funcionpublica.gov.co/eva/gestornormativo/norma_pdf.php?i=66199
- LEAF-Q y RED-S: https://e-space.mmu.ac.uk/635778/1/s40279-024-02108-y.pdf
- Evaluación postural de Kendall: https://www.elsevier.es/es-revista-revista-iberoamericana-fisioterapia-kinesiologia-176-pdf-download-S1138604509000276

# Historial de versiones

Registro de cambios y autoría de cada versión del sistema.
Cada versión está marcada con una etiqueta (tag) en el repositorio.

## v2.9 — Consentimientos, avisos de datos y auditoría

**Etiqueta:** `v2.9` · Fase 2 del plan `docs/plan/plan_historia_clinica.md` · Migraciones `018_consentimientos.sql` a `021_auditoria.sql`.

**Al publicarla:**
- **Avisos de manejo de datos:** cada cuenta, incluidas las de administrador, ve su aviso en el próximo inicio de sesión y debe aceptarlo antes de seguir.
- **Formatos y avisos:** son **borradores** (`borrador-2026-11`) hasta que el docente los apruebe. Cuando cambie el texto, se acepta de nuevo.
- **Regla D2** (consentimiento de atención para valorar): queda **apagada**.
- **Datos anteriores:** los deportistas cargados antes de esta versión son de demostración y quedan exentos de la autorización (D11).

**T2.1 · Modelo y reglas de los consentimientos** (RF-27)
- **Tres tipos separados**, cada uno con su estado:
  - atención fisioterapéutica;
  - tratamiento de datos personales (Ley 1581 de 2012);
  - uso en investigación (Res. 8430 de 1993), que es opcional: negarlo no afecta la atención.
- **Cada firma, rechazo o revocación es un registro aparte** que no se modifica ni se borra; lo impide también la base de datos. El estado es el del último registro; sin registros, *pendiente*.
- **Firmado solo con el papel:** la foto o el PDF se guarda como archivo clínico protegido, en la misma operación.
- **Menores de edad:**
  - firma el acudiente, por defecto el registrado en la identificación del deportista, o se escribe otro con su nombre y documento;
  - se registra el asentimiento del menor (sí o no);
  - para investigación, sin el asentimiento del menor el consentimiento no autoriza.
- **Revocar** pide el motivo y crea un registro nuevo; el firmado queda en el historial. Lo firmado no se "rechaza" después: se revoca.
- **Quién:** los registra el personal de salud y los consulta también el propio deportista. El administrador, el entrenador y el head coach no tienen acceso.
- **Bitácora:** cada consulta, registro y revocación queda registrada, con la acción nueva "revocó".
- **Conservación:** un deportista con consentimientos no se elimina, se retira (regla de la T0.4).
- **Código:** la subida de archivos clínicos y su entrada en la bitácora van ahora en una sola transacción: si una falla, no queda la otra.

Pruebas: CP-UNI-026 a 030 (reglas) y CP-CON-001 a 006 (API: papel obligatorio, menor de edad, revocación sin borrar, investigación independiente, permisos y bitácora).

**T2.2 · Formatos de consentimiento para imprimir (borradores)**
- **Cuatro formatos en hoja carta:**
  - atención fisioterapéutica (con casilla aparte para las fotos de la postura);
  - tratamiento de datos personales;
  - uso en investigación;
  - asentimiento del menor, en lenguaje para él.
- **Cada hoja lleva** los datos del deportista ya diligenciados y, si es menor, los de su acudiente, que es quien firma. Tiene espacio para la firma, el documento, la huella y quien explica.
- **Dónde se abren:** `/pacientes/:id/formatos/:tipo` (diligenciado) y `/formatos-consentimiento/:tipo` (en blanco). Solo los abre el personal de salud; se muestran sin el menú y con el bloqueo por inactividad activo.
- **Son borradores:** lo dice cada hoja, y lo que debe completar la universidad va resaltado. Los PDF y la guía de revisión para el docente están en `docs/plan/formatos/`.

Pruebas: CP-UI-CON-001 (cada formato cabe en una hoja carta: en blanco, de un mayor y de un menor) y CP-UI-CON-002 (datos diligenciados, asentimiento solo para menores, la barra no se imprime, sin acceso para el administrador ni el entrenador).

**T2.3 · Pantalla de consentimientos**
- **Dónde:** en la ficha clínica, una tarjeta por tipo con su estado y su fecha. En celular y tableta vertical, en la pestaña *Consentimientos*; en pantallas amplias, arriba de la columna izquierda.
- **Acciones de cada tarjeta:**
  - *Registrar firma*: firmó o no aceptó; quién firma (si es menor, el acudiente ya diligenciado); asentimiento del menor; fecha; y la foto del papel con la cámara o un PDF.
  - *Ver papel*: se abre por la ruta protegida y solo vive en memoria mientras se ve.
  - *Revocar*, con el motivo.
  - *Imprimir formato*.
- **Historial** de cada tipo: lo anterior, plegado.
- **Las reglas se revisan en la pantalla** con la misma lógica de la API, así el mensaje sale de inmediato.
- **"Falta firmar"** (atención y datos personales; investigación es opcional) aparece en:
  - el encabezado de la ficha, como aviso que lleva a los consentimientos;
  - la lista de pacientes, con aviso y filtro *Consentimiento pendiente*;
  - el inicio del personal de salud, en el grupo *Consentimientos sin firmar*.
- **El papel firmado** aparece también en la historia de la ficha, como archivo clínico.

Pruebas:
- **CP-UI-SAL-013 (celular, menor de edad):** filtro de la lista, aviso de la ficha, firma con foto y asentimiento, ver el papel y revocar con historial.
- **CP-UI-SAL-014:** quién abre el papel (solo salud), el inicio que lleva a la pestaña y el panel en computador.
- **CP-HC-021 (API):** estado de los consentimientos en la lista, la ficha y el inicio.

**T2.4 · Avisos de manejo de datos** (RF-32; decisiones D9 a D13 del plan)
- **Tres textos, como borradores para el docente y la universidad:**
  - *compromiso de confidencialidad y manejo de datos* para todo el personal: Ley 1581 de 2012, Res. 1995 de 1999 y Ley 181 de 1995. Cada rol suma lo propio; salud, la responsabilidad clínica (Ley 528 de 1999) y la supervisión de practicantes;
  - *aviso de privacidad* del deportista, con versión en lenguaje sencillo para menores;
  - *declaraciones* de quien registra a un deportista o carga un archivo con varios.
- **Cada aceptación se guarda** con el aviso, su versión, la huella SHA-256 del texto exacto, quién, cómo (cuenta, tableta, papel, registro o carga), cuándo y desde qué IP. No se modifica ni se borra. Si el texto cambia, cambia la versión y se acepta de nuevo.
- **API:** `GET /api/avisos/mios` (el aviso que le toca a cada uno) y `POST /api/avisos/aceptar`. Todavía no se exige: eso llega con la T2.5.
- **Para el docente:** `docs/plan/formatos/avisos-borrador.md`, generado desde los mismos textos.
- **Migración:** `019_aceptaciones.sql`.

Pruebas: CP-UNI-031 y 032 (textos por rol, versión para menores y huella) y CP-AVI-001 a 003 (aviso de cada rol; aceptación con versión, huella e IP sin duplicarse; el deportista en su cuenta; no se modifican ni se borran).

**T2.5 · Nadie trabaja con datos sin aceptar su aviso**
- **Cuándo aparece:** al entrar por primera vez, o cuando cambia el texto, en lugar de la aplicación aparece el aviso que le corresponde:
  - el personal, su compromiso de confidencialidad;
  - el deportista en su cuenta, su aviso de privacidad.
- **Cómo se acepta:** la casilla y el botón *Aceptar y continuar* están siempre a la vista; sin aceptar solo se puede *Salir*. Funciona en celular, tableta y computador.
- **La API también lo exige:** sin la aceptación, cualquier ruta responde 403 ("Acepta el compromiso…"), salvo la sesión y el aviso mismo. Si un texto nuevo se publica durante una sesión, la pantalla lo muestra en cuanto la API lo pide.
- **A quién aplica:** a todo usuario nuevo, creado uno por uno o por carga CSV.
- **Al publicar esta versión, todas las cuentas** (también las de demostración en Railway) verán su aviso al entrar.

Pruebas:
- **CP-AVI-004 a 006 (API):** sin aceptar no se consulta ni se registra; usuarios nuevos uno por uno y por CSV; un texto con versión nueva se acepta de nuevo.
- **CP-UI-AVI-001 y 002:** el aviso al entrar en 360 px (sin problemas graves de accesibilidad), *Salir*, el aviso del deportista en computador y las cuentas que ya aceptaron entran directo.

**T2.6 · Autorización de cada deportista**
- **Declaración obligatoria de quien registra:** "Declaro que informé al deportista, o a su acudiente si es menor de edad, sobre el aviso de privacidad, y que autorizó…". Sin marcarla no se guarda, en ninguno de los cuatro caminos que crean personas:
  - el formulario de Deportistas;
  - la carga CSV de Deportistas;
  - la cuenta de deportista con ficha nueva, desde Usuarios;
  - la carga CSV de usuarios.
- **Cada carga masiva queda registrada** (tabla nueva `cargas_masivas`, que no se modifica ni se borra): quién la hizo, el archivo y su huella SHA-256, las filas creadas y rechazadas con su motivo, y la declaración de la carga. Cada deportista creado queda ligado a ella.
- **Aceptación propia del deportista**, por tres vías:
  - en su cuenta, al entrar (T2.5);
  - en la tableta del profesional: lee el aviso (en lenguaje sencillo si es menor), escribe su nombre y acepta, con el profesional como testigo;
  - con la autorización de datos personales firmada en papel (T2.3).
- **Si falta, solo se avisa:** "Falta la aceptación del deportista" en la ficha clínica (se toca y abre la aceptación), en la lista de pacientes (con el filtro *Falta aceptación*) y en la ficha de Deportistas, para el entrenador. No bloquea la atención.
- **Los deportistas registrados antes de esta versión** (de demostración) quedan exentos.
- **Un deportista registrado por error y sin historia clínica** se puede seguir eliminando; sus declaraciones se borran con él.

Pruebas:
- **CP-AVI-007 a 012 (API):** registro uno por uno; cargas de deportistas y de usuarios con su registro y huella; cuenta de deportista; tableta con testigo, alcance y versión para menores; papel; eliminar un deportista sin historia.
- **CP-UI-AVI-003 (celular):** el formulario y la carga CSV no guardan sin la declaración.
- **CP-UI-AVI-004:** salud en la tableta y el entrenador en su celular registran la aceptación del deportista.

**T2.7 · Módulo de Auditoría** (solo el administrador; RF-33)
- **Nuevo módulo *Auditoría*** en *Gestión*. Ningún otro rol entra, ni por la API. Tiene seis pestañas:
  - *Actividad:* altas de deportistas y usuarios; cambios de rol; contraseñas restablecidas; cuentas desactivadas y reactivadas; retiros, reincorporaciones y eliminaciones de deportistas; cargas masivas; inicios de sesión fallidos y bloqueos (con el usuario intentado, nunca la contraseña); cambios de ajustes y exportaciones;
  - *Cargas masivas:* cada una con su archivo, huella, resultado, lo creado, las filas rechazadas y la declaración de quien cargó;
  - *Aceptaciones:* quién aceptó qué aviso, cómo, con qué versión y testigo;
  - *Pendientes:* personal que no ha aceptado su compromiso y deportistas a los que les falta su aceptación;
  - *Historia clínica:* la bitácora general de accesos;
  - *Ajustes.*
- **Filtros** por persona, acción y fechas, y **exportación a CSV**, que también queda registrada.
- **Registro** en la tabla nueva `auditoria`, que no se modifica ni se borra y nunca guarda contenido clínico.
- **Ajuste "Exigir el consentimiento de atención firmado para iniciar una valoración"** (regla D2): está apagado y se enciende con confirmación cuando el docente apruebe los formatos. Cada cambio queda registrado.
- **Corrección (DEF-062):** *Pacientes* no aparecía en el menú lateral del computador desde la v2.8.

Pruebas:
- **CP-AUD-001 a 006 (API):** solo el administrador; gestión de cuentas y deportistas; cargas con su detalle; aceptaciones y pendientes; inicios fallidos y bloqueos sin la contraseña; ajuste, exportación y que nada se modifique.
- **CP-UI-AUD-001:** el recorrido del módulo en computador y en un celular de 360 px, y que otro rol no entre.

**T2.8 · Reglas que dependen del consentimiento**
- **Regla D2: sin el consentimiento de atención firmado y vigente no se inicia una valoración.**
  - La API responde 409 "Falta el consentimiento de atención".
  - En la ficha, *Nueva valoración* avisa antes de abrir el editor y lleva a registrarlo.
  - **Solo actúa con el ajuste encendido** en *Auditoría → Ajustes*. Queda **apagada** hasta que el docente apruebe los formatos (D12), así que por ahora nada cambia en el uso diario.
- **Exportaciones** (llegan en la Fase 4), con la regla ya lista y probada:
  - FHIR, solo para deportistas con la autorización de datos personales firmada y vigente;
  - investigación, solo para quienes firmaron su consentimiento y, si son menores, dieron su asentimiento.

Pruebas:
- **CP-UNI-033:** la regla de exportación.
- **CP-CON-007:** la regla D2 encendida y apagada, firmar y revocar.
- **CP-CON-008:** la exportación FHIR.
- **CP-CON-009:** la exportación para investigación, con menores con y sin asentimiento.
- **CP-UI-CON-003:** el aviso de la ficha.

**T2.9 · Cierre de la versión**
- **Datos de demostración con consentimientos en distintos estados.** Cada uno trae un PDF ficticio como papel firmado, para que *Ver papel* funcione:
  - #2: atención y datos personales firmados;
  - #9: lo mismo, y rechazó el de investigación;
  - #10: firmó atención y luego lo revocó;
  - #15: firmó atención y aceptó el aviso en la tableta del profesional;
  - #23 (menor): firmó su acudiente; asintió a la atención, pero no a la investigación.
  - En Railway se agregan una sola vez al plantel ya cargado.
- **Ensayo de la migración:** una base creada con la v2.8 se actualizó dos veces con esta versión. Sin errores, conserva todos sus datos y pasa de 26 a 31 tablas.

Pruebas:
- **CP-CON-010:** los consentimientos y aceptaciones de demostración, y que no se repiten.

## v2.8 — Espacio de trabajo de salud adaptable

**Etiqueta:** `v2.8` · Fase 1 del plan `docs/plan/plan_historia_clinica.md` · Pull Request #41 · Migración `017_bitacora_paciente.sql`.

**T1.1 · Componentes para formularios clínicos** (`frontend/src/components/clinico/`)
- **`FormularioPorSecciones`:** en el celular, una sección por pantalla ("Paso 2 de 9" con barra de avance); en la tableta vertical, índice desplegable; en la tableta horizontal y el computador, índice lateral con el estado de cada sección (completa, no evaluada o pendiente).
- **`BarraAcciones`:** fija abajo, encima del menú inferior. En el celular queda en una sola fila: flechas de Anterior y Siguiente, y la acción principal grande.
- **`CampoMedida`:** número con su unidad visible, teclado numérico y coma decimal. Muestra un aviso, sin bloquear, si el valor sale del rango habitual, y un error si es imposible.
- **`OpcionesBoton` y `SelectorLado`:** opciones como botones grandes (Normal/Alterado, Positivo/Negativo/No concluyente, Derecho/Izquierdo/Bilateral).
- **`CampoFoto`:** tomar foto con la cámara trasera o elegir un archivo. Endereza la foto, la reduce a 1600 px en JPG antes de subirla, muestra la vista previa y acepta PDF.
- **`EstadoGuardado`:** "Guardado hace 5 s", "Guardando…", "Sin conexión".
- **`SeccionOpcional`:** interruptor "No evaluado", que deja constancia de lo que no se evaluó.
- **Página `/catalogo-clinico`:** solo existe en la compilación de pruebas (`VITE_CATALOGO=1`); en Railway no se compila.

Pruebas: CP-UI-SAL-003 a 007 en 5 anchos (360, 390, 768, 1024 y 1440 px), con objetivos táctiles de 44 px y accesibilidad (axe).

**T1.2 · Guardado automático del borrador y ediciones simultáneas**
- **Cuándo se guarda la valoración en borrador:**
  - sola, cada 20 segundos si hay cambios;
  - al ocultarse la página (cambiar de aplicación o bloquear el celular);
  - al pulsar *Guardar borrador*;
  - al cerrar la ventana.
- **Estado visible arriba:** "Cambios sin guardar", "Guardando…", "Guardado hace 5 s" o "Sin conexión: se guardará cuando vuelva la señal".
- **Sin señal:** lo escrito espera en memoria, nunca en el almacenamiento del navegador, y se guarda en cuanto vuelve la conexión (se reintenta cada 5 segundos).
- **Dos dispositivos:**
  - si el borrador cambió en otro, el servidor responde 409 y aparece el aviso con *Usar la versión guardada* o *Guardar la mía encima*;
  - nunca se pisa en silencio;
  - si se cerró en el otro dispositivo, se abre la valoración cerrada.
- **Al salir con cambios sin guardar:** el navegador pide confirmación al salir de la página; la ventana primero intenta guardar y, si no puede, pregunta.
- **Consecuencia para el bloqueo por inactividad (T0.8):** cuando llega el bloqueo, el borrador ya está guardado, así que recargar no pierde nada.
- **Código:** hook reutilizable `usarGuardadoAutomatico` y editor separado en `EditorValoracion.jsx`.

Pruebas: CP-HC-018 (dos dispositivos con la misma cuenta) y CP-UI-SAL-008 (celular, con reloj simulado y red cortada). Las pruebas del bloqueo limpian los borradores que ahora quedan guardados.

**T1.3 · Lista de pacientes** (`/pacientes`, solo personal de salud)
- **Para qué:** encontrar a un deportista en segundos desde el celular. *Pacientes* aparece en el menú inferior del personal de salud.
- **Búsqueda:**
  - por nombre, sin importar tildes ni mayúsculas ("tomas" encuentra a Tomás);
  - por documento, con o sin puntos;
  - por dorsal (`#10`).
- **Filtros rápidos con conteo:** lesión activa, borrador sin cerrar, control vencido, sin documento e incluir retirados; además, equipo y el selector de deporte de la app.
- **Cada paciente muestra:** foto, documento, deporte y equipo, disponibilidad (con la misma regla del inicio) y avisos: alergias de la última valoración cerrada, lesión con retorno estimado, restricciones, borradores, control vencido, sin documento, menor de edad y retirado.
- **Vista:** tarjetas grandes en el celular y la tableta; tabla en el computador.
- **Al tocar un paciente:** se abren sus valoraciones en *Salud* con el deportista ya elegido. La ficha clínica llega con la T1.4.
- **Bitácora:** cada consulta de la lista queda registrada (migración `017_bitacora_paciente.sql`, que agrega el recurso `paciente`).
- **Informe de calidad:** la aplicación pasa de 13 a 14 módulos. M-R1 y M-M3 ya no tienen el 13 fijo: cuentan los módulos del catálogo del informe.

Pruebas: CP-HC-019 (API: datos, retirados, permisos y bitácora) y CP-UI-SAL-009 (celular: documento encontrado en 2 toques, búsqueda sin tildes y por dorsal, filtro de lesión activa; computador: tabla).

**T1.4 · Ficha clínica del deportista** (`/pacientes/:id`, solo personal de salud)
- **Para qué:** todo lo clínico del deportista en una pantalla. Se abre al tocar un paciente de la lista.
- **Encabezado:** foto, nombre, documento, edad, deporte, equipo, disponibilidad y los avisos (alergias, lesión activa, restricciones, borradores, control vencido, sin documento, menor de edad y retirado). Se ve en todas las pestañas.
- **Resumen:**
  - estado (lesión activa con retorno estimado, último y próximo control);
  - antecedentes de la última valoración cerrada;
  - última medición antropométrica;
  - identificación y contacto, con los teléfonos listos para llamar desde el celular.
- **Historia:**
  - valoraciones, controles, lesiones con sus seguimientos, mediciones y archivos clínicos, del más reciente al más antiguo, con filtros por tipo;
  - cada registro se abre desde aquí, y los archivos clínicos se descargan (hasta ahora no tenían pantalla).
- **Accesos:** quién consultó la historia, desde la misma ficha.
- **Nueva valoración:** a 1 toque, fija abajo en el celular y en el encabezado en el computador. Propone los antecedentes de la valoración anterior. Si quien atiende tiene un borrador abierto, aparece *Continuar borrador*.
- **Por dispositivo:**
  - celular y tableta vertical: pestañas *Resumen*, *Historia* y *Accesos*, que se recorren también con las flechas del teclado;
  - tableta horizontal y computador: resumen a la izquierda e historia a la derecha.
- **Bitácora:** abrir la ficha trae todo en una sola consulta y deja una sola entrada: "abrió la ficha clínica".
- **Arreglo de paso:** el borrador de otra persona ya no se muestra como "Cerrada el…". Ahora dice que es un borrador y que solo quien lo abrió puede editarlo o cerrarlo.
- **Pendiente para la Fase 2:** el aviso y la pestaña de consentimientos, y exigir el consentimiento firmado para iniciar una valoración (D2).

Pruebas:
- **CP-HC-020 (API):** identificación, estado, cada tipo de registro, una sola entrada en la bitácora y permisos.
- **CP-UI-SAL-010 (celular):**
  - avisos;
  - abrir cada tipo de registro y descargar un archivo;
  - accesos;
  - *Nueva valoración* en 1 toque;
  - sin desborde en 360 px.
- **CP-UI-SAL-011 (computador y tableta):**
  - dos columnas;
  - teclado (Enter y flechas);
  - borrador que se continúa;
  - administrador y entrenador sin acceso.
- **Mediciones:** la ficha entra en la medición de accesibilidad (axe: 0 problemas graves) y de objetivos táctiles (15 de 15 de 44 px).

**T1.5 · Inicio del personal de salud**
- **Pendientes de salud:** primero en el celular y arriba de la columna principal en el computador. Agrupa:
  - sus borradores sin cerrar;
  - los controles médicos vencidos y los de los próximos 7 días;
  - los deportistas no aptos o con restricciones;
  - las lesiones activas;
  - cuántos deportistas no tienen antropometría este semestre.
- **Cada aviso lleva a su registro:**
  - el borrador se abre listo para seguir escribiendo;
  - la lesión, con sus seguimientos;
  - la restricción, con el control médico que la puso;
  - el control vencido, en el formulario con el deportista ya elegido y el cursor en el primer campo.
- **Listas largas:** cada grupo muestra 5 avisos, con un botón *Ver los N* para el resto.
- **Ficha clínica:** acepta `?abrir=lesion-12` (o `valoracion-`, `control-`, `medicion-`) para abrir ese registro al entrar; el parámetro se quita de la dirección.
- **Disponibilidad del plantel:** para el personal de salud, tocar un dorsal abre la ficha clínica.
- **Mi sesión:** el botón principal ahora es *Buscar paciente*.
- **Menú inferior:** queda *Inicio, Pacientes, Lesiones, Salud* y *Más*. Salud se conserva porque ahí se registran los controles médicos.
- **Otros roles:** siguen con *Para revisar* y no reciben los pendientes clínicos.
- **Pendiente para la Fase 2:** los consentimientos pendientes.

Pruebas:
- **CP-INI-012 (API):** borradores propios, controles con los vencidos primero, aptitud y lesiones con el registro que abren; los demás roles no los reciben.
- **CP-UI-SAL-012 (celular):** cada tipo de aviso lleva a su registro; en el computador el dorsal abre la ficha; el entrenador no ve los pendientes clínicos.

**T1.6 · Computador, teclado y tableta horizontal**
- **Ventanas con teclado** (todas, no solo las clínicas):
  - Escape cierra la ventana de arriba; una confirmación sobre un formulario se cierra sola;
  - Tab no se sale a la página de atrás;
  - al cerrar, el foco vuelve al botón que la abrió;
  - se anuncian como diálogo a los lectores de pantalla (DEF-059).
- **Enter guarda** en las ventanas de Deportistas (registrar o editar, identificación y retirar); en un texto largo, Enter sigue siendo salto de línea.
- **Ctrl+S (Cmd+S en Mac)** guarda el borrador de la valoración, en lugar de abrir "Guardar página como…".
- **Tableta horizontal (1024 × 768)** en todas las pruebas de anchos, incluido el recorrido de los 5 roles por todos los módulos, y el giro de vertical a horizontal: la ficha pasa de pestañas a dos columnas y el formulario por secciones, de índice desplegable a índice lateral.
- **Lista de pacientes:** tarjetas hasta 1279 px y tabla desde 1280 px. En la tableta horizontal la tabla desbordaba la página (DEF-060).
- **Arreglo de paso:** las tablas ya no dejan salir los textos ocultos para lectores de pantalla.
- **Requisitos:** RNF-12 nuevo (pantallas del personal de salud en celular, tableta y computador, también con teclado). `DESIGN.md` tiene una sección nueva con las reglas, los componentes y los patrones del espacio de salud, con capturas.
- **Defectos registrados y cerrados:** DEF-057 (toque perdido en el aviso de bloqueo, de la T1.2), DEF-058 (borrador ajeno mostrado como cerrado, de la T1.4), DEF-059, DEF-060 y DEF-061 (enlace del panel de pendientes que solo se distinguía por el color).
- **Ensayo de migración:** una base creada con el despliegue de la v2.7 (plantel de demostración y datos clínicos) pasó dos veces por el despliegue de la v2.8 sin perder registros.

Pruebas:
- **CP-UI-PC-001:** giro de la tableta.
- **CP-UI-PC-002 a 004:** identificación, valoración (abrir, Ctrl+S, Escape, firmar y nota) y retirar y reactivar, en computador con teclado.
- **CP-UI-RES-005:** lista y ficha en los 5 anchos.
- **CP-UI-HC-008:** borrador de otra persona.

**Informe de calidad:** la métrica M-E3 ahora mide lo que se descarga **al abrir** la aplicación (unos 121 KB en la v2.7), en lugar del total del build (309 KB en la v2.7), que se sigue mostrando como dato. Las pantallas se cargan por partes; con la definición anterior, cada pantalla nueva castigaba la métrica aunque el inicio siguiera igual de liviano. Detalle en `docs/calidad/02_metricas.md`.

**Corrección del bloqueo por inactividad (T0.8):** el primer contacto del dedo con *Sigo aquí* hacía desaparecer el aviso antes de que el botón recibiera el toque, y según la velocidad del equipo el toque se perdía. Ahora el contacto solo marca actividad: el aviso se quita con su botón o, como mucho, un segundo después. Lo detectó la corrida completa de pruebas; se confirmó repitiendo la prueba 4 veces.

## v2.7 — Historia clínica: base legal y de seguridad

**Etiqueta:** `v2.7` · Fase 0 del plan `docs/plan/plan_historia_clinica.md` · Migraciones `011_identificacion.sql` a `016_bitacora.sql`.

Primera versión del plan acordado con el docente de salud el 17 de noviembre de 2026. Se basa en la Resolución 1995 de 1999 (historia clínica), la Resolución 839 de 2017 (conservación), la Ley 1581 de 2012 (datos sensibles) y la guía FHIR RDA del MinSalud.

**Despliegue:**
- Railway aplica las migraciones solo al arrancar. Se ensayó sobre una base v2.6 con datos: no se pierde nada y la historia anterior pasa a ser una valoración cerrada.
- **Requiere el volumen en `/data` con `UPLOADS_DIR=/data/uploads`**, porque los archivos clínicos van a `/data/clinico`.

**Defectos corregidos:**
- DEF-052: la historia clínica se sobrescribía.
- DEF-053: eliminar un deportista borraba su historia.
- DEF-054: los archivos subidos eran públicos.
- DEF-055: el administrador entraba a la información clínica.
- DEF-056: el entrenador veía el diagnóstico y la antropometría.

**T0.1 · Identificación del deportista (RF-25)**
- El deportista tiene tipo y número de documento. Los tipos son los códigos de la guía RDA: CC, TI, RC, CE, PA, PPT y PE.
  - El número se guarda sin puntos ni espacios y **no se repite aunque cambie el tipo**: al cumplir 18 años la TI pasa a CC con el mismo número.
  - CC, TI y RC solo admiten dígitos.
  - El documento se puede dejar para después.
- Nuevos datos:
  - teléfono, EPS, municipio, zona (urbana o rural) y nacionalidad;
  - contacto de emergencia;
  - acudiente.
- **Si es menor de edad, el acudiente es obligatorio** (nombre y teléfono).
  - Se exige al crear al deportista, al crear su cuenta en *Usuarios*, al importarlo por CSV y al editar su edad o su acudiente.
  - Asignarle equipo o dorsal a un menor registrado antes de esta versión no queda bloqueado.
- **Pertenencia étnica y discapacidad son datos sensibles.**
  - Solo los registra el personal de salud, con la nueva ruta `PATCH /api/jugadores/:id/identificacion`, que no cambia el equipo, el dorsal ni el entrenador.
  - Solo los ven el personal de salud y el propio deportista. La API se los quita al entrenador, al head coach y al administrador.
- **Interfaz pensada para celular y tableta:**
  - secciones plegables y teclado numérico o de teléfono según el campo;
  - zona de residencia con botones grandes;
  - el acudiente aparece solo si el deportista es menor de edad.
- **Ficha del deportista:** muestra el documento y la tarjeta *Contacto y emergencia*, con teléfonos que se marcan con un toque.
- **Personal de salud:** tiene el botón *Datos de identificación* para completar todos los datos.
- **Búsqueda e importación:**
  - Deportistas se busca también por número de documento.
  - El CSV acepta `tipo_documento`, `numero_documento`, `fecha_nacimiento`, `telefono`, `eps` y las columnas del acudiente y del contacto de emergencia.
  - Las filas inválidas no se importan y se informan con su motivo.
- **Datos de demostración:** documentos ficticios para todo el plantel, y el #23 queda como menor de edad con acudiente.
- Las reglas viven en un solo archivo, `frontend/src/utils/identificacion.js`, que usan tanto los formularios como la API.

Pruebas: CP-UNI-021 a 024 (unitarias), CP-HC-001 a 004 (integración) y CP-UI-HC-001 y 002 (celular y tableta). Las pruebas de interfaz que usaban el texto anterior del buscador quedaron actualizadas.

**T0.2 · Datos de quien atiende (RF-26)** · Migración `012_quien_atiende.sql`
- Las cuentas del personal de salud tienen:
  - profesión (fisioterapia, medicina, enfermería, nutrición, psicología u otra);
  - **vínculo** (profesional, practicante o estudiante);
  - **registro profesional (RETHUS) opcional**: decisión D1, porque los primeros en usar el sistema serán practicantes de fisioterapia y estudiantes del área de salud;
  - **docente supervisor opcional**.
- Reglas del supervisor: debe ser un profesional de salud activo (no un practicante ni un estudiante) y nadie se supervisa a sí mismo.
- Si una cuenta deja de ser de salud, sus datos profesionales se borran. Si se edita sin enviarlos, se conservan.
- En *Usuarios*:
  - el administrador llena estos datos con botones grandes para el vínculo;
  - ve cómo quedará identificada la persona (por ejemplo, "Practicante de fisioterapia · Supervisa: …");
  - la lista muestra esa descripción debajo del correo.
- La sesión (`/auth/login` y `/auth/me`) incluye `quien_atiende`. En *Salud*, cada profesional ve "Registras como…".
- Los controles médicos y los seguimientos de lesiones muestran quién los registró (columna *Atendió*).
- La cuenta de salud de demostración queda como fisioterapeuta profesional.
- Reglas compartidas en `frontend/src/utils/profesionales.js`. La función `datosDeQuienAtiende` (`backend/utils/quienAtiende.js`) la usará la T0.3 para guardar una copia al cerrar cada valoración.

Pruebas: CP-UNI-025, CP-HC-005 y CP-UI-HC-003 (celular).

**T0.3 · Historia clínica secuencial e inalterable (RF-26, DEF-052)** · Migración `013_valoraciones.sql`
- **Corrige DEF-052:** antes la historia clínica era una sola fila por deportista y cada guardado reemplazaba la anterior. Ahora **cada atención es una valoración aparte**, con fecha, hora, tipo (inicial, control, pretemporada o después de lesión) y quien atiende.
- **Ciclo de una valoración:**
  - *Borrador:* lo edita solo quien lo abrió, con número de versión. Si otro dispositivo la cambió, responde 409 en lugar de pisar los cambios. Se puede descartar.
  - *Cerrar y firmar:* guarda una copia de los datos de quien atiende (T0.2) y un **código de integridad SHA-256**. Desde ese momento no se modifica ni se borra.
  - *Notas aclaratorias:* son la única forma de corregir una valoración cerrada. Tampoco se modifican ni se borran.
- **La base de datos también lo impide:** unos *triggers* bloquean cualquier cambio a lo cerrado aunque se intente sin pasar por la API. Solo el modo de mantenimiento (`dt.mantenimiento`) lo permite, por ejemplo para limpiar la base de pruebas.
- **Verificar integridad:** `GET /api/valoraciones/:id/integridad` detecta si una valoración cambió después de cerrarse.
- **Requisitos para abrir una valoración:** el deportista debe tener documento de identidad (Res. 1995) y la valoración no puede estar vacía.
- **Acceso:**
  - solo el personal de salud registra y consulta;
  - el deportista ve sus valoraciones cerradas;
  - **el administrador no accede**.
  - El middleware `autorizar` dejaba pasar siempre al administrador; las rutas nuevas usan `autorizarEstricto`. La T0.7 lo extiende al resto de rutas clínicas.
- **Migración:**
  - las historias anteriores pasan a ser la primera valoración de cada deportista ("Antecedentes registrados antes de la v2.7"), cerradas, con su fecha y su autor;
  - no tienen código de integridad, porque se registraron antes de que existiera;
  - `POST /api/salud/historias` responde 410.
- **Pantalla Salud:**
  - la sección *Historia clínica · Valoraciones* reemplaza el formulario anterior y muestra la lista de atenciones de cada deportista;
  - el editor tiene botones grandes para el tipo, antecedentes plegables que se proponen desde la última valoración cerrada, y la barra de acciones fija abajo;
  - antes de cerrar pide confirmación;
  - la vista de la valoración cerrada incluye las notas aclaratorias y el botón *Verificar integridad*;
  - el deportista ve *Mis valoraciones*.

Pruebas: CP-HC-006 a 010 (integración) y CP-UI-HC-004 (celular). CP-MOD-011 ahora comprueba que el formulario anterior ya no existe y CP-MIG-001 cuenta 24 tablas.

**T0.4 · Conservación de la historia clínica (RNF-14, DEF-053)** · Migración `014_conservacion.sql`
- **Corrige DEF-053:** eliminar un deportista ya no borra su historia. Antes, sus lesiones, controles, seguimientos y antropometría se borraban en cascada, y la Resolución 839 de 2017 exige conservarlos mínimo 15 años.
- **Retirar en lugar de eliminar:**
  - nuevos `PATCH /api/jugadores/:id/retirar` (con motivo opcional) y `PATCH /api/jugadores/:id/reactivar`;
  - el retirado sale del plantel actual y libera su dorsal;
  - conserva sus valoraciones, lesiones, asistencia y estadísticas.
- **Plantel actual sin retirados:** listado de deportistas (`?retirados=incluir|solo` para verlos), nómina y conteo de equipos, inicio, panel del head coach, conteos por deporte, estadísticas y tablero. **Un retirado no se puede convocar.**
- **La base de datos lo impide:** un trigger bloquea borrar a un deportista con historia clínica (valoraciones, controles, lesiones o antropometría) y una lesión con seguimientos, aunque se intente sin pasar por la API. La API responde 409 con un mensaje claro.
- **En Deportistas:**
  - pestañas *Plantel actual* y *Retirados*;
  - botones *Retirar* (con motivo) y *Reactivar*;
  - si se intenta eliminar a alguien con historia, se explica por qué no y se ofrece retirarlo;
  - la ficha muestra la fecha y el motivo del retiro.
- **Historia de los retirados:** en Salud, el personal de salud la sigue viendo; en el selector de valoraciones aparecen marcados como retirados.
- **Corrección de la T0.1:** el listado de deportistas del head coach (`/api/head-coach/jugadores`) devolvía la pertenencia étnica y la discapacidad; ya no.
- **Pruebas:** la limpieza de la base de pruebas usa el modo de mantenimiento (`sqlMantenimiento` en `pruebas/utilidades/api.js`).

Pruebas: CP-HC-011 y 012 (integración) y CP-UI-HC-005 (celular).

**T0.5 · Archivos clínicos protegidos (RNF-13, DEF-054)** · Migración `015_archivos_clinicos.sql`
- **Base para los consentimientos escaneados (Fase 2) y las fotos de postura (T3.4):**
  - `POST /api/archivos-clinicos`: subida multipart, solo para el personal de salud;
  - `GET /api/archivos-clinicos`: lista;
  - `GET /api/archivos-clinicos/:id`: descarga.
- **Corrige DEF-054:** los archivos clínicos van a `CLINICO_DIR`, fuera de `/uploads` (que es pública), con un nombre aleatorio que nunca se envía al navegador. `/uploads/clinico` responde 404.
- **Formatos:** solo JPG, PNG o PDF de hasta 5 MB, **reconocidos por su contenido**. Un texto renombrado como `.jpg` se rechaza. Se guarda la huella SHA-256 de cada archivo.
- **Descarga:**
  - con sesión, por el personal de salud o el propio deportista; el administrador, el entrenador y el head coach no;
  - sin caché (`no-store`) y con `nosniff`;
  - si el archivo se perdió del servidor (por ejemplo, sin volumen), responde 410 con un mensaje claro.
- **Inalterables:** los archivos clínicos no se modifican ni se borran (trigger), y un deportista que tenga alguno tampoco se puede eliminar (regla de la T0.4). Se pueden adjuntar a una valoración en borrador del mismo deportista, no a una cerrada.
- **Despliegue:** en Railway viven en el volumen, en `/data/clinico`. Documentado en el README y en `.env.example` (`CLINICO_DIR`, opcional). Las pruebas los escriben en una carpeta temporal que se borra al terminar.

Pruebas: CP-HC-013 a 015 (integración).

**T0.6 · Bitácora de accesos a la historia clínica (RF-31)** · Migración `016_bitacora.sql`
- **Qué se registra:** cada consulta, registro, cambio, cierre, verificación, descarga o eliminación de un dato clínico, con quién (copia de su nombre y su rol), qué, sobre qué registro, de qué deportista, cuándo y desde qué IP. **Sin contenido clínico.**
- **Dónde:** valoraciones, notas aclaratorias, archivos clínicos, controles, seguimientos, lesiones, antropometría, historias anteriores y datos de identificación.
- **Antes de responder:** el registro se hace antes de entregar la respuesta, así que, si la bitácora no se puede escribir, la consulta tampoco se entrega.
- **Inalterable:** la bitácora no se modifica ni se borra (trigger) y no hay ruta para borrarla. Leerla no deja registro.
- **`GET /api/bitacora`:**
  - el personal de salud la consulta por deportista;
  - el deportista ve quién consultó su historia (derecho del titular, Ley 1581);
  - el administrador ve la vista general con filtros por acción, usuario y fechas, e IP;
  - el entrenador y el head coach no tienen acceso.
- **Pantallas:**
  - en Salud: *Accesos a esta historia* (personal de salud) y *¿Quién consultó mi historia?* (deportista);
  - en Usuarios: *Bitácora clínica* (administrador);
  - los registros se muestran en lenguaje claro ("Personal Salud cerró y firmó la valoración #12") y en lista, para que quepan en el celular.

Pruebas: CP-HC-016 y 017 (integración) y CP-UI-HC-006 (tableta y computador).

**T0.7 · Cada rol ve solo lo que le corresponde (DEF-055, DEF-056)**
- **Matriz de acceso acordada con el docente:** está documentada en `docs/calidad/00_requisitos.md` y la API la aplica, no solo la pantalla.
- **El administrador ya no entra a la información clínica:** historias, controles, seguimientos, valoraciones, archivos y antropometría. Tampoco registra lesiones. Salud y Antropometría salen de su menú.
  - La causa era que `autorizar` (servidor), `tienePermiso` y `ProtectedRoute` (pantalla) dejan pasar siempre al administrador. Las rutas clínicas usan `autorizarEstricto`, las pantallas clínicas comparan el rol directamente, y Salud y Antropometría están marcadas como `clinico` en el menú: si el administrador escribe su dirección, vuelve al inicio.
  - Conserva la disponibilidad del plantel, sus notificaciones y la bitácora general.
- **Lesiones:** solo el personal de salud las registra, edita o elimina. El entrenador, el head coach y el administrador ven la **disponibilidad** (desde cuándo, hasta cuándo, estado del seguimiento y retorno estimado) **sin el tipo ni la descripción**; en la pantalla de Lesiones, la columna *Retorno estimado* reemplaza a *Tipo*. El personal de salud y el propio deportista ven el detalle.
- **Inicio:**
  - el tipo de lesión ya no aparece para el entrenador, el head coach ni el administrador, ni siquiera en la vista "como lo ve el deportista";
  - los avisos de controles vencidos y de antropometría pendiente son solo del personal de salud;
  - los enlaces a Salud se muestran solo a quien puede entrar.
- **Antropometría:** la registra y la consulta solo el personal de salud, y el deportista la suya. Antes el entrenador también podía registrarla. La ficha del deportista no se la muestra al entrenador ni al administrador.
- **Pruebas de condición física:** las registra el entrenador (y el administrador); el personal de salud las consulta.
- **Pruebas actualizadas:** CP-MOD-001, CP-MOD-005, CP-PER-006, CP-PER-012, CP-INI-006, CP-OBS-005, CP-DOR-008, CP-SEG-003 y CP-HC-005, porque dependían de los permisos anteriores. Además, CP-UI-REC-001 (el recorrido del administrador) ya no espera entrar a los módulos clínicos.

Pruebas: CP-ROL-010 a 017 (integración) y CP-UI-HC-007 (celular y tableta).

**T0.8 · Bloqueo por inactividad (RNF-02)**
- **Para quién:** el personal de salud, en cualquier dispositivo. Así una tableta o un computador olvidado no deja historias clínicas a la vista.
- **Cuándo:** a los **15 minutos sin tocar la pantalla** se bloquea. Cuenta la inactividad, no la duración del trabajo: cualquier toque, tecla o desplazamiento reinicia la cuenta.
- **Aviso:** un minuto antes aparece "La pantalla se bloqueará en 1 minuto" con el botón *Sigo aquí*.
- **La pantalla de bloqueo:**
  - es opaca y tapa todo, sin recargar;
  - el resto de la página queda inerte (no se puede usar con teclado ni con lectores de pantalla);
  - pide la contraseña: al desbloquear, la persona sigue donde iba, con lo que había escrito;
  - tiene la opción *No soy yo: cerrar sesión*.
- **No se puede saltar:** el bloqueo se mantiene aunque se recargue la página y se comparte entre pestañas. Recargar sí pierde lo escrito y no guardado, hasta que la T1.2 agregue el guardado automático.
- **`POST /api/auth/desbloquear`:** comprueba la contraseña de quien tiene la sesión, con el mismo límite de intentos del inicio de sesión (5 fallos → 15 minutos).
- **Configurable:** el tiempo y los roles están en `frontend/src/config/seguridad.js`, por si el docente pide más tiempo durante las pruebas físicas.

Pruebas: CP-AUT-010 (integración) y CP-UI-SAL-001 y 002 (tableta y celular, con reloj simulado).

## v2.6 — Fechas y horas disponibles en entrenamientos y partidos

**Etiqueta:** `v2.6` · Sin cambios en la base de datos.

- No se pueden programar entrenamientos ni partidos en una fecha pasada, ni hoy a una hora que ya pasó. Un registro antiguo se puede seguir editando si no se cambia su fecha (por ejemplo, para anotar el resultado de un partido jugado).
- La fecha y la hora ya no usan el selector del navegador: el sistema muestra un calendario propio (los días pasados aparecen bloqueados) y botones con las horas disponibles, de 6:00 a. m. a 10:00 p. m. cada 30 minutos, agrupadas en mañana, tarde y noche. No aparecen las horas que ya pasaron ni las que el equipo ya tiene ocupadas con otro entrenamiento o partido.
- Nuevo `GET /api/entrenamientos/horas-disponibles` y `GET /api/partidos/horas-disponibles` (`fecha`, `equipo_id`, `id` del registro que se edita). El servidor aplica las mismas reglas al guardar: fecha pasada o hora fuera de la lista → 400; hora ocupada por el mismo equipo → 409.
- Componente `frontend/src/components/SelectorFechaHora.jsx`; validación en `backend/utils/agenda.js`.

Pruebas: CP-AGE-007 a 010 nuevas; CP-UI-AGE-001 usa el calendario y los botones de hora; las pruebas que creaban actividades con fechas fijas (ya pasadas) usan fechas relativas a hoy (`pruebas/utilidades/fechas.js`).

## v2.5 — Fórmulas de antropometría revisadas

**Etiqueta:** `v2.5` · Sin cambios en la base de datos. Los registros guardados antes conservan sus valores; al editarlos y pulsar "Recalcular" se actualizan.

Correcciones (revisión de las fórmulas antes de la auditoría de fisioterapia)
- DEF-049 · Masa ósea de Rocha con el diámetro **biestiloideo (muñeca)** y el del fémur; antes usaba el del húmero (sobreestimaba la masa ósea ~1,5 kg y subestimaba la masa muscular en lo mismo). Sin diámetros ya no se estima como 14,5 % del peso.
- DEF-050 · Somatotipo Heath-Carter solo con mediciones reales: sin diámetros de húmero y fémur, brazo contraído y pierna no hay mesomorfia (antes usaba 6,8 y 9,5 cm por defecto y el brazo relajado). La somatocarta solo dibuja somatotipos completos.
- DEF-051 · % de grasa: Yuhasz-Carter exige los 6 pliegues; se retira la "estimación 3 pliegues" sin respaldo; Durnin-Womersley usa los coeficientes por sexo y edad del deportista (o la ecuación general si no se conoce la edad); masa residual de Würch 24,1 % en hombres.
- La tarjeta "Somatotipo" del cálculo en vivo siempre salía vacía (leía campos que no existían).

Mejora técnica
- Una sola fuente de las fórmulas: el backend importa `frontend/src/utils/anthropometry.js` en lugar de tener su propia copia. La pantalla indica qué ecuación de % de grasa se usó.

Pruebas: CP-UNI-004 y CP-MOD-013 con valores corregidos; nuevas CP-UNI-017 a 020 (incluida una que compara el cálculo del servidor con el de la pantalla).

## v2.4 — Documento del proyecto y dos correcciones de interfaz

**Etiqueta:** `v2.4` · Sin cambios en la base de datos.

Correcciones (encontradas al ejecutar los casos de prueba del documento del proyecto)
- DEF-047 · La convocatoria y su aviso mostraban el partido un día antes: el controlador convertía la fecha (texto desde la v2.0) con `new Date()`. Ahora se usa tal cual. Prueba nueva CP-CNV-011.
- DEF-048 · En computador, la ventana de avisos de la campanita quedaba corrida hacia arriba y ocultaba los avisos más recientes: la barra superior tiene `backdrop-filter`, que cambia la referencia de `position: fixed`. `Modal` y `ConfirmModal` ahora se dibujan en el `body` con un portal de React.

Documentación
- `docs/entrega/Documento_proyecto_Administracion_Deportiva.docx`: documento completo del proyecto, con roles, requisitos (RF, RNF, RU, RS y RD), casos de uso, historias, cronograma, Poker Planning, costos, EVM, reglas de negocio, riesgos, planificación del Sprint 1, burndown, 20 casos de prueba con capturas, incidencias, calidad y funcionalidades.

Pruebas: 137 de API (136 aprobadas y 1 omitida) y 44 de navegador, todas en verde.

## v2.3 — Historias de usuario y casos de uso

**Etiqueta:** `v2.3` · Solo documentación; sin cambios en el código ni en la base de datos.

- Nuevo `docs/analisis/historias_y_casos_de_uso.md`, con:
  - los 6 actores y sus permisos;
  - el diagrama de 16 casos de uso (`docs/analisis/diagrama_casos_de_uso.png`);
  - la especificación completa de CU-01, CU-03, CU-08, CU-09, CU-10 y CU-12;
  - 20 historias de usuario con criterios de aceptación;
  - la matriz de trazabilidad hacia requisitos y casos de prueba.
- `DOCUMENTACION.html`: el diagrama de casos de uso se reemplaza por el actual (antes tenía 7 casos y 2 actores).

## v2.2 — Documentación al día y hora de Colombia

**Etiqueta:** `v2.2` · Sin cambios en la base de datos.

Corrección
- DEF-045 · Con el servidor en UTC (Railway), de 7 p. m. a medianoche de Colombia "hoy" y "mañana" se calculaban con el día siguiente y el recordatorio "Mañana tienes entrenamiento" no salía. Ahora la app y PostgreSQL trabajan en `America/Bogota` (`backend/config/db.js`, variable opcional `ZONA_HORARIA`) y las validaciones de fecha usan `backend/utils/hoy.js`.

Accesibilidad · DEF-046 (recupera lo que bajó con el rediseño de la v2.0)
- Contraste AA en el contador del filtro de deporte, el avatar del rol jugador y el dorsal del deportista ausente en la planilla de asistencia.
- Título principal (h1) en Lesiones, Salud y Evaluaciones, y orden correcto de títulos en Equipos.
- En pantallas táctiles, la campana, los buscadores, los selectores, las pestañas y los encabezados ordenables miden 44 px.

Pruebas
- Casos nuevos CP-ZON-001 y CP-ZON-002. Los casos de la v2.0 y la v2.1 pasan a llamarse CP-COR-001 a 006, CP-EST-001 a 004 y CP-ADM-001, con sus requisitos, para que aparezcan en el catálogo y en el informe.
- CP-MIG-002 se marca como omitido (con el motivo) cuando el repositorio no tiene la etiqueta `v1-original`, en lugar de quedarse colgado.
- El informe cuenta RF-01 a RF-24, no cuenta como aprobado un caso omitido y describe el entorno real de la ejecución.

Documentación
- `docs/diseno/DESIGN.md` reescrito para el diseño "Cancha" (tokens, tipografía Barlow, estructura, componentes y perfil de cada deporte). Capturas nuevas en `docs/diseno/capturas/`; las de la v1.3 pasan a `capturas/v1.3/`.
- `docs/calidad/00_requisitos.md`: RF-03, RF-06, RF-10 a RF-13 ampliados; nuevos RF-24 (categorías por deporte) y RNF-11 (hora de Colombia).
- Plan de pruebas, plan de calidad, catálogo de casos e informe de ejecución v2.2 con sus conclusiones.

## v2.1 — Estadísticas por deporte y usuario admin1

**Etiqueta:** `v2.1` · Base de datos: `backend/migrations/010_metricas_y_admin.sql` (incluida en `database.sql`; Railway la aplica al desplegar).

- Estadísticas propias de cada deporte (`backend/config/metricas_deportes.js`): fútbol (goles, asistencias, tarjetas amarillas y rojas, minutos), fútbol sala, baloncesto (puntos, rebotes, asistencias, robos, faltas), rugby (tries, conversiones, penales, drops, pases de try, tackles; puntos calculados), voleibol (puntos, aces, bloqueos, recepciones, errores de saque, sets), béisbol y sóftbol (carreras, hits, impulsadas, jonrones, ponches), natación y atletismo (pruebas, medallas, finales, marcas personales), tenis, ajedrez, balonmano y hockey. "Partidos jugados" se calcula solo. Un deporte nuevo usa un perfil general.
- Pantalla Estadísticas: todos los deportes aparecen al entrar y se eligen con un toque; cada uno muestra sus totales, líderes ordenables por métrica, gráfica y registros, y el formulario pide solo las métricas de ese deporte.
- Se guardan en la columna nueva `estadisticas_jugador.metricas` (JSONB). Las columnas goles / asistencias / minutos_jugados se siguen llenando, así el inicio y los reconocimientos no cambian. Los registros anteriores se muestran con las métricas de su deporte sin modificarlos.
- El servidor valida cada métrica (entero ≥ 0 con tope razonable) y solo deja registrar estadísticas de deportistas del propio alcance.
- El administrador inicial pasa de `robinson_meza` a **`admin1`** (`admin1@dtdeportivo.com`). Conserva id, datos y contraseña. Inicia sesión con `admin1` o con el correo.
- En celular, el nombre y el rol vuelven a verse en la barra superior (observación de la v1.9).
- Documento `Inventario_usuarios_AdministracionDeportiva.pdf` con las cuentas definidas en el código, roles y permisos.

## v2.0 — Errores en ejecución y nuevo diseño "Cancha"

**Etiqueta:** `v2.0` · Base de datos: `backend/migrations/009_correcciones_v2.sql` (también incluida en `database.sql`, se aplica sola al desplegar en Railway).

Errores corregidos (documento "Errores en ejecución")
- DEF-040 · Las fechas se guardaban y mostraban un día antes (12 oct → 11 oct): `pg` ahora devuelve las columnas DATE como texto y todas las pantallas usan `utils/fechas.js`.
- DEF-041 · Asistencia: marcar "Presente" no quedaba a la vista (la columna es booleana y la pantalla comparaba con `=== 1`). Además, un solo registro por deportista y sesión (índice único + upsert) y "Todos presentes/ausentes" en una sola petición.
- DEF-042 · El entrenador podía crear entrenamientos y partidos "Generales (todos los equipos)", que les aparecían a otros deportes. Ahora solo el administrador; el entrenador elige entre los equipos de su deporte (también validado en el servidor).
- DEF-043 · Un usuario desactivado no se podía volver a activar: nueva pestaña "Inactivos" y botón "Reactivar".
- DEF-044 · "Todos mis deportistas" en los avisos del entrenador llega solo a sus deportistas de su deporte, y la opción lo dice ("Todos mis deportistas de Rugby").
- El deportista ve solo su propia antropometría ("Mi antropometría"), sin selector de compañeros.

Mejoras
- Resultado según el deporte: marcador (fútbol, rugby, baloncesto), sets (voleibol) y tiempo/marca + puesto (natación, atletismo). Tipos de evento: liga, torneo, amistoso y competencia.
- Posiciones propias de cada deporte (`config/deportes.js`).
- Categorías por deporte administrables (Inicio → Deportes y categorías, y al crear un equipo). Tabla `categorias`, `equipos.categoria_id`.
- Al crear un deportista en Usuarios se crea también su ficha: deporte, equipo, posición, género, entrenador y fecha de nacimiento. La edad se calcula y se actualiza sola.
- Equipos: filtro desplegable por deporte y categoría (pensado para celular).
- Convocatoria: "Confirmaron / Sin responder / No pueden" son botones que filtran.
- Panel del Head Coach: tarjetas por entrenador que filtran sus deportistas.
- El entrenador de un solo deporte ya no ve el selector de deporte en Deportistas.

Diseño
- Nuevo sistema visual "Cancha": menú lateral verde noche con líneas de cancha, tipografía de marcador (Barlow Condensed), tableros de cifras, color e ícono por deporte, fixture de partidos con marcador, asistencia con fichas tipo camiseta, portada deportiva en el inicio de sesión y banner de próximo partido con cuenta regresiva.

## v1.9 — Observaciones del tester (primera entrega)

**Autor:** Carlos Gamboa · **Etiqueta:** `v1.9`

Correcciones a partir de las primeras pruebas de Alejandro Guevara en PC y celular.

Acceso por deporte y por rol
- El entrenador, el head coach y el deportista ven solo sus deportes, no los de toda la universidad. Con un solo deporte, la cabecera lo muestra fijo, sin lista.
- El administrador puede asignar el deporte de cada entrenador o head coach en Usuarios. Si no tiene, se usa el deporte de sus deportistas.
- Solo el administrador crea y elimina deportes (antes también el entrenador).
- El personal de salud ya no ve Estadísticas ni los máximos anotadores y reconocimientos del inicio.

Filtro por deporte donde faltaba
- Entrenamientos y Partidos: muestran las actividades del deporte elegido más las generales (sin equipo).
- Salud y controles: controles, historias clínicas y listas de deportistas.
- Usuarios: nueva columna Deporte y filtro por el deporte de la cabecera, junto al filtro por rol.

Inicio de sesión y contraseñas
- DEF-031: con la sesión abierta, el botón Atrás ya no muestra el formulario de inicio de sesión; si se llega al login con sesión, va directo al inicio.
- Botón del ojo para ver la contraseña en Cambiar contraseña y en los formularios de Usuarios.

Celular
- El nombre y el rol se ven arriba, debajo de la cabecera.
- Mi sesión va justo debajo del próximo partido.

Además
- DEF-032: editar un usuario desde Usuarios ya no borra su vínculo con el perfil de deportista.

Datos: migración `008_deporte_entrenador.sql` (deporte asignado en usuarios). Railway la aplica sola al arrancar.

Pruebas: CP-OBS-001 a 007 (API) y CP-UI-OBS-001 a 005 (navegador). CP-UI-NAV-002 pasa a usar el administrador.

## v1.8.2 — Apagado limpio en Railway y lista para el tester

**Autor:** Carlos Gamboa · **Etiqueta:** `v1.8.2`

- Railway enviaba un correo de "crash" en cada despliegue: al apagar la versión anterior con SIGTERM, npm lo reportaba como "command failed". Ahora la app arranca directamente con Node (`backend/config/iniciar_railway.js`) y el servidor cierra ordenadamente (termina las peticiones en curso, cierra la base y sale con código 0).
- `docs/calidad/casos/lista-tester.html`: lista de 60 pruebas manuales por rol (PC, celular o ambos), con casillas que se guardan en el navegador, formulario de fallas (rol, dispositivo, pantalla, pasos, resultado, gravedad y captura) e informe descargable.

## v1.8.1 — Lista de avisos y desborde en celular

**Autor:** Carlos Gamboa · **Etiqueta:** `v1.8.1`

- Lista de avisos de la campanita sin la franja de color al borde: filas con separador y el ícono del tipo de aviso (convocatoria, aviso del entrenador, recordatorio); los no leídos van en negrita con el ícono en verde y la marca "Nuevo".
- DEF-030: en celular, al abrir la campanita la página se desbordaba 27 px y el botón de cerrar quedaba cortado.

## v1.8 — Publicación en Railway

**Autor:** Carlos Gamboa · **Etiqueta:** `v1.8`

El sistema queda publicado con HTTPS en https://app-production-d293.up.railway.app (versión de pruebas, con el plantel de demostración), para que el tester y el equipo lo usen desde cualquier celular.

Despliegue
- `railway.json`: Railway compila el frontend, arranca con `npm run railway:iniciar` (prepara la base y luego inicia el servidor) y verifica `/api/health` antes de dirigir el tráfico a la versión nueva.
- La preparación es idempotente: crea o actualiza el esquema, crea las cuentas base y, con `DATOS_DEMO=1`, carga el plantel de demostración una sola vez. Si falla, Railway mantiene la versión anterior.
- Railway no ejecutó el `preDeployCommand` en el primer despliegue (la base quedó sin tablas); por eso la preparación pasó al arranque.
- Detrás del proxy de Railway el freno de intentos de login funciona por usuario y se reconoce HTTPS. Fotos y logos se guardan en un volumen (`UPLOADS_DIR=/data/uploads`).
- Cada fusión en `main` despliega una versión nueva sin perder los datos.

Pendiente: Railway reemplazará `railway.json` por su formato nuevo (`.railway/railway.ts`) el 2026-12-01; hay que migrarlo antes.

## v1.7 — Agenda por equipo, avisos del entrenador, recordatorios y app instalable

**Autor:** Carlos Gamboa · **Etiqueta:** `v1.7`

Funciones para que el plantel use la app a diario, antes de publicarla en Railway.

Agenda por equipo
- Cada entrenamiento y partido puede tener equipo, hora y lugar. Sin equipo es general y la ven todos; con equipo la ven solo quienes tienen ese equipo a su cargo y sus deportistas.
- El administrador asigna cualquier equipo; el entrenador, solo los equipos donde tiene deportistas (el servidor aplica la misma regla).
- "Esta semana" en el inicio muestra el lugar y la hora de cada actividad.

Avisos del entrenador
- Panel "Avisos del equipo" en el inicio: el entrenador escribe a un equipo o a todos sus deportistas; el administrador, a un equipo o a todo el sistema.
- Cada destinatario recibe el aviso en la campanita y lo ve en su inicio. El autor (o el administrador) puede eliminarlo.

Recordatorios automáticos
- Al deportista: entrenamientos y partidos del día siguiente con hora y lugar, convocatoria sin responder (3 horas después de publicada, para no repetir el aviso) y control médico próximo o vencido.
- Al entrenador: partido de mañana sin convocatoria publicada o con convocados que aún no responden.
- Se generan al abrir la app, sin tareas programadas, y nunca se repiten. Cuando el sistema esté publicado con HTTPS podrán enviarse como notificación push.

Reconocimientos
- Panel sobrio en el inicio: asistencia perfecta del mes (mínimo 3 sesiones), máximo anotador y máximo asistidor de la temporada. El deportista solo ve los reconocimientos propios.

Agregar al calendario e instalar como app
- Cada actividad de "Esta semana" y la convocatoria se pueden agregar al calendario del celular (archivo .ics, con recordatorio 2 horas antes) o a Google Calendar.
- La app se puede instalar: en Android y PC con el botón "Instalar la app"; en iPhone, desde Safari con Compartir → Agregar a pantalla de inicio (el panel "Mi sesión" muestra los pasos).

Velocidad
- El servidor envía los archivos comprimidos y el navegador guarda un año los que no cambian: en celular con 4G lento el inicio carga en 1,9 s (antes 3,0 s).

Datos: migraciones `006_agenda_equipos.sql` (equipo, hora y lugar en entrenamientos y partidos) y `007_comunicados_recordatorios.sql` (comunicados, destinatarios y clave única de recordatorios). Nuevos requisitos RF-21, RF-22 y RF-23.

Pruebas: CP-AGE-001 a 006, CP-COM-001 a 002, CP-REC-001 a 003, CP-RCN-001, CP-UNI-015 y 016 (API y unitarias, 116 de 116); CP-UI-AGE-001, CP-UI-COM-001 y 002, CP-UI-RCN-001 (navegador, 43 de 43).

## v1.6 — Convocatoria de partidos y avisos

**Autor:** Carlos Gamboa · **Etiqueta:** `v1.6`

Para que el plantel use la app: la convocatoria oficial de cada partido se publica en el sistema.

Convocatoria
- El entrenador arma la convocatoria desde el partido o desde el inicio: elige titulares y suplentes entre sus deportistas, viendo el estado médico de cada uno (disponible, con restricciones o no disponible), y agrega hora, lugar e indicaciones.
- Mientras es borrador solo la ve el cuerpo técnico. Al publicarla, la plantilla queda visible en el partido y cada convocado recibe un aviso.
- Es editable después de publicada: quien entra, sale o cambia de titular a suplente recibe un aviso, y si cambia la hora o el lugar se avisa a todos.
- Cada convocado confirma o avisa que no puede (con motivo) hasta el día del partido. El entrenador ve las respuestas y recibe un aviso cuando alguien no puede ir.
- Registro digital: cada acción (publicar, convocar, retirar, cambiar rol, confirmar, no poder ir) queda guardada con quién la hizo y cuándo.
- Botón para compartir la convocatoria por WhatsApp con el enlace a la app.

Avisos
- Campanita en la cabecera para todos los roles, con el número de avisos sin leer; cada aviso lleva directo a la convocatoria.
- Por primera vez el sistema genera avisos (antes la tabla existía pero nada los creaba).

Datos: migración `005_convocatorias.sql` (convocatorias, convocados, convocatoria_historial y enlace en notificaciones). Nuevo requisito RF-20.

Pruebas: CP-CNV-001 a CP-CNV-010 (API) y CP-UI-CNV-001 a 003 (navegador, de punta a punta en celular).

## v1.5.2 — Privacidad de los datos de los deportistas

**Autor:** Carlos Gamboa · **Etiqueta:** `v1.5.2`

Corrige tres fallas de privacidad encontradas al escribir la guía del sistema (datos protegidos por la Ley 1581 de 2012):
- **Asistencia (DEF-027):** cada rol ve solo la asistencia de los deportistas de su alcance; antes un deportista veía la de todo el plantel.
- **Evaluaciones físicas (DEF-028):** se filtran por rol; antes la API las devolvía todas a cualquier usuario.
- **Antropometría (DEF-029):** las medidas de un deportista solo las ve quien puede ver a ese deportista; si no, la API responde "no encontrado".

La regla de alcance (deportista → él mismo, entrenador → los suyos, head coach → los de sus entrenadores, administrador y salud → todos) queda en un solo lugar: `backend/utils/alcance.js`.

Pruebas: CP-PER-010 a CP-PER-012. API 92 de 92, navegador 36 de 36.

## v1.5.1 — Vista del deportista desde el inicio

**Autor:** Carlos Gamboa · **Etiqueta:** `v1.5.1`

- En el plantel del inicio, cada número es un botón: al tocarlo se abre el inicio tal como lo ve ese deportista en su cuenta (su estado, retorno estimado y su asistencia).
- La API acepta `GET /api/dashboard/inicio?jugador_id=N` para el personal. Solo funciona con deportistas a los que ese rol ya tiene acceso (si no, responde 404); un deportista no puede ver la vista de otro.
- Pruebas: CP-INI-010, CP-INI-011 y CP-UI-INI-002.

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

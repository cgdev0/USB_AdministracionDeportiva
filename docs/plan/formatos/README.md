# Formatos de consentimiento: borradores para revisión

Tarea T2.2 del plan de historia clínica (`docs/plan/plan_historia_clinica.md`). Los textos son **borradores** preparados por el equipo de desarrollo. Ninguno se usa con deportistas hasta que el docente de salud y la universidad los aprueben.

## Archivos

| Archivo | Qué es |
|---|---|
| `borrador-formatos-consentimiento.pdf` | Los cuatro formatos en blanco, uno por hoja carta |
| `ejemplo-diligenciado-menor-demo.pdf` | Los mismos formatos con los datos de un deportista menor de edad del plantel de demostración (datos ficticios), para ver cómo quedan diligenciados |
| `avisos-borrador.md` | *(T2.4)* Los textos que se aceptan en la aplicación con una casilla: el compromiso de confidencialidad del personal (con lo propio de cada rol), el aviso de privacidad del deportista (también en versión para menores) y las declaraciones de quien registra o carga un archivo |

Los formatos son:
1. consentimiento para la valoración y la atención fisioterapéutica;
2. autorización para el tratamiento de datos personales;
3. consentimiento para el uso de datos en investigación;
4. asentimiento del menor de edad.

## Qué revisar en cada formato

- **Contenido y lenguaje:** que sea correcto, completo y claro para un deportista o su acudiente.
- **Normas citadas:**
  - Ley 528 de 1999;
  - Resolución 1995 de 1999;
  - Ley 1581 de 2012 y Decreto 1377 de 2013;
  - Resolución 8430 de 1993.
- **Riesgos y procedimientos:** que lo descrito en *En qué consiste* y *Beneficios y riesgos* corresponda a lo que hace el equipo.

## Lo que debe completar la universidad

Está resaltado en amarillo y entre corchetes en los formatos:
- dirección, teléfono y correo del área encargada de la protección de datos personales;
- enlace o lugar donde se consulta la política de tratamiento de datos de la universidad;
- nombre del comité de ética que aprueba los estudios;
- contacto del grupo o del comité de investigación.

## Decisiones que conviene confirmar

| # | Decisión del borrador | Pregunta |
|---|---|---|
| 1 | La atención la pueden hacer estudiantes o practicantes supervisados por un docente, y el formato lo dice. | ¿Se describe así la supervisión? |
| 2 | Las fotografías de la postura se autorizan aparte, dentro del consentimiento de atención. | ¿Basta esa casilla o debe ser un formato propio? |
| 3 | El entrenador solo conoce la disponibilidad para entrenar (apto, con restricciones o lesionado), no el diagnóstico. | ¿Es lo acordado? |
| 4 | Si el menor no da su asentimiento para investigación, sus datos no se usan, aunque el acudiente lo haya autorizado. | ¿Se confirma? |
| 5 | Si el menor no da su asentimiento para la atención, queda registrado, pero decide el acudiente. | ¿Cómo se procede en ese caso? |
| 6 | Cada formato lleva espacio para la firma, el documento y la huella del índice derecho, y la firma de quien explica. | ¿Falta algún dato, como un testigo? |
| 7 | La investigación se presenta como "sin riesgo", porque solo usa datos ya registrados y no hace pruebas adicionales. | ¿Lo confirma el comité de ética? |
| 8 | *(Avisos)* Todo el personal acepta el compromiso antes de usar el sistema, y el de salud incluye la responsabilidad clínica y la supervisión. | ¿Los textos cubren lo que exige la universidad? |
| 9 | *(Avisos)* El aviso del deportista menor de edad está en lenguaje sencillo y dice que su acudiente ya autorizó. | ¿Es adecuado para deportistas de 12 a 17 años? |

## Después de la revisión

1. Los cambios se aplican en `frontend/src/utils/formatosConsentimiento.js`, que es la única fuente de los textos.
2. Se quita la marca de borrador y se cambia `VERSION_FORMATO` (en `frontend/src/utils/consentimientos.js`), por ejemplo a `v1-2026-12`. Cada consentimiento firmado guarda la versión del formato con que se firmó.
3. Se generan de nuevo los PDF.
4. La prueba CP-UI-CON-001 comprueba que cada formato siga cabiendo en una hoja carta.

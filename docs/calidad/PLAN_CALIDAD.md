# Plan de calidad y pruebas — Administración Deportiva

Estado: **pendiente de iniciar**. Registrado el 10 de octubre de 2026 a partir de lo pedido en clase.

## Norma de referencia

Se trabaja con la **ISO/IEC 9126**, como lo exige el docente.

Existe una versión más actual, la ISO/IEC 25010, que reemplazó a la 9126 y agrega seguridad y compatibilidad como características propias. **No se usa en este proyecto**, aunque se puede mencionar en la justificación como contexto.

## Qué se debe entregar

| # | Parte | Contenido |
|---|---|---|
| 1 | Características de calidad | Las seis características de la ISO 9126, sus factores (subcaracterísticas) y la justificación de cuáles son relevantes para este software y por qué. |
| 2 | Métricas e indicadores | Para cada característica elegida: métrica cuantificable, fórmula de cálculo, valor esperado o criterio de aceptación, e indicador para visualizar el resultado. |
| 3 | Plan de pruebas | Documento formal: alcance, módulos y funciones a evaluar, tipos de prueba, responsables, recursos, herramientas, criterios de entrada y salida, y criterios para aprobar o rechazar. |
| 4 | Casos de prueba | Cada caso con identificador, nombre, requisito relacionado, precondiciones, datos de entrada, pasos, resultado esperado, resultado obtenido, estado (aprobado o fallido) y evidencias. |
| 5 | Informe de ejecución | Pruebas diseñadas y ejecutadas, aprobadas y fallidas, porcentaje de aprobación, defectos encontrados, evidencias, conclusiones y recomendaciones. |
| 6 | Documentación en el repositorio | Todo lo anterior en esta carpeta (`docs/calidad/`), más el registro de defectos y los tableros de GitHub Projects actualizados. |

### Características de la ISO/IEC 9126

| Característica | Qué evalúa | Ejemplo de métrica |
|---|---|---|
| Funcionalidad | Si el software cumple las funciones requeridas | % de requisitos funcionales aprobados |
| Fiabilidad | Si funciona correctamente y mantiene su estabilidad | % de pruebas ejecutadas sin fallos |
| Usabilidad | Si es fácil de aprender y usar | % de usuarios que completan una tarea correctamente |
| Eficiencia | Si aprovecha bien el tiempo y los recursos | Tiempo promedio de respuesta |
| Mantenibilidad | Si es fácil de corregir, modificar y actualizar | Tiempo promedio para corregir un defecto |
| Portabilidad | Si se adapta a distintos entornos | % de entornos compatibles verificados (navegadores, celular y computador) |

## Cuándo se hace cada parte

| Momento | Partes | Qué se hace |
|---|---|---|
| **Una sola vez, al iniciar** | 1, 2 y 3 | Definir características, métricas y plan de pruebas. Son el marco y casi no cambian entre versiones. |
| **En cada cambio (cada Pull Request)** | 4, 5 y 6 en pequeño | Agregar o actualizar los casos de prueba de lo que se modificó, ejecutarlos, anotar resultados y defectos, y mover el tablero. |
| **Al cierre del proyecto** | 5 completo | Consolidar el informe general con todas las ejecuciones acumuladas y calcular los indicadores finales. |

Así no hay que reconstruir al final qué se probó en cada versión, y las evidencias quedan guardadas desde el principio.

### Lista de verificación para cada Pull Request

- [ ] Casos de prueba nuevos o actualizados para lo que cambió.
- [ ] Pruebas ejecutadas, con resultado anotado en el informe de esa versión.
- [ ] Defectos encontrados registrados (y su corrección, si se hizo).
- [ ] Evidencias guardadas (capturas, salida de las pruebas).
- [ ] Tablero de GitHub Projects actualizado.
- [ ] Entrada en `CHANGELOG.md`.

## Material que ya existe y se puede reutilizar

Las versiones 1.2 y 1.3 ya se verificaron con pruebas automáticas. Esas pruebas pueden convertirse en casos de prueba formales y en las primeras evidencias del informe:

- **Backend, regresión:** 48 casos contra PostgreSQL (inicio de sesión, lectura y escritura de todos los módulos, intento de inyección SQL bloqueado y filtros por rol).
- **Backend, dorsal:** 14 casos (dorsal repetido, cambio rápido, actualización parcial, importación CSV).
- **Navegador (Playwright):** recorrido de 5 roles por 13 módulos, en celular (390 px) y computador (1440 px), revisando errores, desbordes y permisos. Además, 6 casos de la edición del dorsal en la tabla.

**Pendiente:** hoy esos scripts viven fuera del repositorio. Al iniciar este plan hay que **pasarlos al repositorio** (por ejemplo, a una carpeta `pruebas/`) para que cualquier integrante pueda ejecutarlos y repetir los resultados.

## Estructura propuesta de esta carpeta

```
docs/calidad/
├── PLAN_CALIDAD.md            ← este archivo
├── 01_caracteristicas.md      ← características ISO 9126, factores y justificación
├── 02_metricas.md             ← matriz de características, factores, métricas y criterios
├── 03_plan_de_pruebas.md      ← plan de pruebas formal
├── casos/                     ← casos de prueba por módulo
├── informes/                  ← un informe de ejecución por versión (v1.4, v1.5…) y el informe final
└── defectos.md                ← registro de defectos
```

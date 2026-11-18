// Componentes de los formularios clínicos (v2.8, T1.1 del plan de historia clínica).
// Cumplen las reglas de interfaz del plan (sección 3): celular, tableta y computador; botones de 44 px o más;
// teclado numérico en las medidas; opciones como botones grandes; cámara integrada; secciones "No evaluado".
export { default as FormularioPorSecciones } from './FormularioPorSecciones'
export { default as BarraAcciones } from './BarraAcciones'
export { default as CampoMedida, numeroDe, errorDeMedida } from './CampoMedida'
export { default as OpcionesBoton, SelectorLado, LADOS } from './OpcionesBoton'
export { default as CampoFoto, comprimirFoto } from './CampoFoto'
export { default as EstadoGuardado, haceCuanto } from './EstadoGuardado'
export { default as SeccionOpcional } from './SeccionOpcional'
export { default as usarModoPantalla } from './usarModoPantalla'
export { default as usarGuardadoAutomatico } from './usarGuardadoAutomatico'

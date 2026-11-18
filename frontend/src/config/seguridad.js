// Bloqueo por inactividad (v2.7, T0.8 del plan de historia clínica).
// Para que una tableta o un computador olvidado en el consultorio no deje historias clínicas a la vista.
// Cuenta el tiempo SIN TOCAR la pantalla (cualquier toque, tecla o desplazamiento la reinicia), no la duración del
// trabajo: registrar datos durante una hora nunca bloquea. Un minuto antes avisa con un botón "Sigo aquí".
// Si se bloquea no se pierde nada: la pantalla de bloqueo tapa la página sin recargarla.
// Para ajustar el tiempo (por ejemplo, si el docente lo pide más largo durante las pruebas) basta cambiar `minutos`.
export const BLOQUEO = {
  roles: ['personal_salud'],
  minutos: 15,
  avisoSegundos: 60,
}

// Claves del navegador: el bloqueo se mantiene si recargan la página y se comparte entre pestañas
export const CLAVE_BLOQUEO = 'dt_bloqueo_inactividad'
export const CLAVE_ACTIVIDAD = 'dt_ultima_actividad'

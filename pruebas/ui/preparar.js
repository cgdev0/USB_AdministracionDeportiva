// Antes de las pruebas de navegador: base de pruebas limpia con el plantel de demostración.
// v2.9 (T2.5): las cuentas de prueba empiezan con su aviso de manejo de datos aceptado.
const { prepararBaseDePruebas } = require('../utilidades/bd');
const { aceptarAvisosDePrueba } = require('../utilidades/avisos');

module.exports = async () => {
  await prepararBaseDePruebas();
  await aceptarAvisosDePrueba();
};

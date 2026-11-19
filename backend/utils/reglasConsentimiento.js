// Reglas que dependen del consentimiento (v2.9, T2.8 del plan de historia clínica; D2 y D12).
//  - Exigir el consentimiento de atención firmado para iniciar una valoración: solo con el ajuste encendido por el
//    administrador (módulo de Auditoría), cuando el docente apruebe los formatos.
//  - Quién puede salir en una exportación: FHIR (Fase 4) con la autorización de datos personales; investigación con
//    su consentimiento y, si es menor, con su asentimiento. La regla está en frontend/src/utils/consentimientos.js.
const path = require('path');
const { pathToFileURL } = require('url');
const db = require('../config/db');
const { leerAjuste } = require('./auditoria');

const reglas = import(pathToFileURL(path.join(__dirname, '..', '..', 'frontend', 'src', 'utils', 'consentimientos.js')).href);

const exigeConsentimientoAtencion = async () => (await leerAjuste('exigir_consentimiento_atencion', false)) === true;

async function estadoDe(jugadorIds) {
  const { estadoActual } = await reglas;
  const { rows } = await db.query(
    'SELECT * FROM consentimientos WHERE jugador_id = ANY($1) ORDER BY registrado_en DESC, id DESC', [jugadorIds]);
  return new Map(jugadorIds.map(id => [Number(id), estadoActual(rows.filter(c => Number(c.jugador_id) === Number(id)))]));
}

async function consentimientoAtencionFirmado(jugadorId) {
  const { autoriza } = await reglas;
  return autoriza((await estadoDe([jugadorId])).get(Number(jugadorId)).atencion);
}

// De una lista de deportistas, los que pueden salir en una exportación para ese fin ('fhir' o 'investigacion')
async function filtrarParaExportacion(jugadorIds, fin) {
  const { exportable } = await reglas;
  const ids = jugadorIds.map(Number).filter(Number.isInteger);
  if (!ids.length) return [];
  const estados = await estadoDe(ids);
  return ids.filter(id => exportable(estados.get(id), fin));
}

module.exports = { exigeConsentimientoAtencion, consentimientoAtencionFirmado, filtrarParaExportacion };

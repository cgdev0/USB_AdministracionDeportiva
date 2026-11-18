const db = require('../config/db');
const { responderError } = require('../utils/errores');
const { condicionAlcance } = require('../utils/alcance');
const { registrar, jugadorDeLaConsulta } = require('../utils/bitacora'); // v2.7 (T0.6): bitácora de accesos
const { columnasQuienAtiende, conQuienAtiende } = require('../utils/quienAtiende');
// v2.7 (T0.2): cada control y seguimiento muestra quién lo registró, con su vínculo y su supervisor
const QA = columnasQuienAtiende('pr');
// v2.7 (T0.7): solo el personal de salud (antes también el administrador)
const puedeVerSaludCompleta = rol => rol === 'personal_salud';

exports.getHistorias = async (req,res) => {
  if (!puedeVerSaludCompleta(req.usuario.rol)) return res.status(403).json({error:'Solo el personal de salud autorizado puede consultar historias clínicas'});
  try { const {rows}=await db.query(`SELECT h.*,j.nombre AS jugador_nombre,j.dorsal AS jugador_dorsal,j.disciplina_id FROM historias_clinicas h JOIN jugadores j ON j.id=h.jugador_id ORDER BY j.nombre`); await registrar(req,{accion:'listar',recurso:'historia'}); res.json(rows); }
  catch(e){responderError(res, e);}
};
// v2.7 (T0.3, DEF-052): la historia ya no se sobrescribe. Antes, cada guardado reemplazaba la historia anterior
// (una fila por deportista con ON CONFLICT DO UPDATE). Ahora cada atención es una valoración (/api/valoraciones).
// La tabla historias_clinicas queda solo de lectura: su contenido se migró como la primera valoración de cada deportista.
exports.saveHistoria = async (_req,res) => res.status(410).json({error:'La historia clínica ya no se sobrescribe: registra una valoración nueva desde Salud.'});
exports.getControles = async (req,res) => {
  try {
    // Misma regla de alcance que el resto del sistema (la ruta ya limita los roles; esto es una segunda barrera)
    const params=[];
    const cond=condicionAlcance(req.usuario,params,'j');
    const {rows}=await db.query(`SELECT c.*,j.nombre AS jugador_nombre,j.dorsal AS jugador_dorsal,j.disciplina_id,${QA.columnas} FROM controles_medicos c
      JOIN jugadores j ON j.id=c.jugador_id LEFT JOIN usuarios pr ON pr.id=c.profesional_id ${QA.join}
      ${cond?`WHERE ${cond}`:''} ORDER BY c.fecha DESC`,params);
    await registrar(req,{accion:'listar',recurso:'control',jugador_id:jugadorDeLaConsulta(req)});
    res.json(await conQuienAtiende(rows));
  } catch(e){responderError(res, e);}
};
exports.createControl = async (req,res) => {
  if(!puedeVerSaludCompleta(req.usuario.rol)) return res.status(403).json({error:'Solo personal de salud autorizado puede registrar controles'});
  const {jugador_id,fecha,proxima_fecha,tipo,resultado,restricciones,aptitud}=req.body;
  if(!jugador_id||!tipo) return res.status(400).json({error:'Deportista y tipo de control son obligatorios'});
  try { const {rows}=await db.query(`INSERT INTO controles_medicos(jugador_id,fecha,proxima_fecha,tipo,resultado,restricciones,aptitud,profesional_id) VALUES($1,COALESCE($2::date,CURRENT_DATE),$3,$4,$5,$6,$7,$8) RETURNING *`,[jugador_id,fecha||null,proxima_fecha||null,tipo,resultado||null,restricciones||null,aptitud||'pendiente',req.usuario.id]); await registrar(req,{accion:'crear',recurso:'control',recurso_id:rows[0].id,jugador_id}); res.status(201).json(rows[0]); }
  catch(e){responderError(res, e);}
};
exports.getNotificaciones = async(req,res)=>{try{const {rows}=await db.query('SELECT * FROM notificaciones WHERE usuario_id=$1 ORDER BY created_at DESC LIMIT 100',[req.usuario.id]);res.json(rows);}catch(e){responderError(res, e);}};
exports.leerNotificacion = async(req,res)=>{try{const {rowCount}=await db.query('UPDATE notificaciones SET leida=true WHERE id=$1 AND usuario_id=$2',[req.params.id,req.usuario.id]);if(!rowCount)return res.status(404).json({error:'Notificación no encontrada'});res.json({ok:true});}catch(e){responderError(res, e);}};

exports.getSeguimientos = async (req,res)=>{
 if(!puedeVerSaludCompleta(req.usuario.rol)) return res.status(403).json({error:'Solo personal de salud autorizado puede consultar el detalle clínico de lesiones'});
 try { const {rows}=await db.query(`SELECT s.*,l.jugador_id,j.nombre AS jugador_nombre,j.dorsal AS jugador_dorsal,l.tipo AS lesion_tipo,${QA.columnas}
   FROM seguimiento_lesiones s JOIN lesiones l ON l.id=s.lesion_id JOIN jugadores j ON j.id=l.jugador_id
   LEFT JOIN usuarios pr ON pr.id=s.profesional_id ${QA.join} ORDER BY s.fecha_seguimiento DESC`); await registrar(req,{accion:'listar',recurso:'seguimiento'}); res.json(await conQuienAtiende(rows)); } catch(e){responderError(res, e);}
};
exports.createSeguimiento = async(req,res)=>{
 if(!puedeVerSaludCompleta(req.usuario.rol)) return res.status(403).json({error:'Solo personal de salud autorizado puede registrar seguimientos clínicos'});
 const {lesion_id,zona_corporal,gravedad,diagnostico,tratamiento,evolucion,fecha_seguimiento,fecha_retorno_estimada,fecha_retorno_real,estado}=req.body;
 if(!lesion_id) return res.status(400).json({error:'La lesión es obligatoria'});
 try {const {rows}=await db.query(`INSERT INTO seguimiento_lesiones(lesion_id,zona_corporal,gravedad,diagnostico,tratamiento,evolucion,fecha_seguimiento,fecha_retorno_estimada,fecha_retorno_real,estado,profesional_id) VALUES($1,$2,$3,$4,$5,$6,COALESCE($7::date,CURRENT_DATE),$8,$9,$10,$11) RETURNING *`,[lesion_id,zona_corporal||null,gravedad||null,diagnostico||null,tratamiento||null,evolucion||null,fecha_seguimiento||null,fecha_retorno_estimada||null,fecha_retorno_real||null,estado||'activa',req.usuario.id]);const {rows:[l]}=await db.query('SELECT jugador_id FROM lesiones WHERE id=$1',[lesion_id]);await registrar(req,{accion:'crear',recurso:'seguimiento',recurso_id:rows[0].id,jugador_id:l?.jugador_id});res.status(201).json(rows[0]);}catch(e){responderError(res, e);}
};

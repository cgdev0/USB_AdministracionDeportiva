// Consentimientos en la ficha clínica (v2.9, T2.3 del plan de historia clínica; RF-27).
// Objetivo: registrar una firma en menos de un minuto desde la tableta. Una tarjeta por tipo con su estado y sus
// acciones: imprimir el formato, registrar la firma (quién firma, foto del papel con la cámara, asentimiento si es
// menor), revocar con el motivo y ver el papel firmado, que se abre por la ruta protegida (solo personal de salud y
// el propio deportista). Las reglas son las mismas de la API (utils/consentimientos.js): el mensaje sale de inmediato.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../services/api'
import Modal from '../Modal'
import CampoFoto from './CampoFoto'
import OpcionesBoton from './OpcionesBoton'
import { TIPOS_CONSENTIMIENTO, validarConsentimiento, validarRevocacion, autoriza } from '../../utils/consentimientos'
import { TIPOS_DOCUMENTO, PARENTESCOS, documentoLegible } from '../../utils/identificacion'
import { fechaTabla, hoyISO } from '../../utils/fechas'

const ICONO = { atencion: 'fa-hand-holding-medical', datos_personales: 'fa-user-lock', investigacion: 'fa-flask' }
const INSIGNIA = {
  firmado: ['badge-green', 'fa-circle-check', 'Firmado'],
  pendiente: ['badge-orange', 'fa-hourglass-half', 'Pendiente'],
  rechazado: ['badge-red', 'fa-circle-xmark', 'No aceptó'],
  revocado: ['badge-red', 'fa-rotate-left', 'Revocado'],
}

function quien(c) {
  if (!c.firmante_nombre) return ''
  const rol = c.firma_quien === 'acudiente' ? ` (acudiente${c.firmante_parentesco ? `, ${c.firmante_parentesco.toLowerCase()}` : ''})` : ''
  return `${c.firmante_nombre}${rol}`
}
export function detalleConsentimiento(c) {
  if (c.estado === 'pendiente') return c.tipo === 'investigacion' ? 'Opcional: se pregunta al deportista y no afecta la atención.' : 'Falta la firma.'
  if (c.estado === 'firmado') {
    const asentimiento = c.asentimiento === null || c.asentimiento === undefined ? '' : ` · asentimiento del menor: ${c.asentimiento ? 'sí' : 'no'}`
    return `Firmado el ${fechaTabla(c.fecha)} por ${quien(c)}${asentimiento}`
  }
  if (c.estado === 'rechazado') return `No aceptó el ${fechaTabla(c.fecha)}${quien(c) ? ` (${quien(c)})` : ''}${c.motivo ? `: ${c.motivo}` : ''}`
  return `Revocado el ${fechaTabla(c.fecha)}: ${c.motivo}`
}
function Insignia({ estado }) {
  const [clase, icono, texto] = INSIGNIA[estado] || INSIGNIA.pendiente
  return <span className={`badge ${clase}`}><i className={`fa-solid ${icono}`} aria-hidden="true"></i> {texto}</span>
}
const formulario = (campos, archivo) => {
  const f = new FormData()
  for (const [k, v] of Object.entries(campos)) if (v !== undefined && v !== null && v !== '') f.append(k, String(v))
  if (archivo) f.append('archivo', archivo, archivo.name || 'consentimiento.jpg')
  return f
}
const enviar = (ruta, campos, archivo) => api.post(ruta, formulario(campos, archivo), { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 })

// ── Registrar la firma (o el rechazo) ──
function Registrar({ tipo, etiqueta, paciente, onClose, onGuardado }) {
  const menor = !!paciente.menor
  const [estado, setEstado] = useState('firmado')
  const [fecha, setFecha] = useState(hoyISO())
  const [archivo, setArchivo] = useState(null)
  const [asentimiento, setAsentimiento] = useState('')
  const [motivo, setMotivo] = useState('')
  const [acudiente, setAcudiente] = useState({
    nombre: paciente.acudiente_nombre || '', tipo_documento: paciente.acudiente_tipo_documento || 'CC',
    numero_documento: paciente.acudiente_numero_documento || '', parentesco: paciente.acudiente_parentesco || '',
  })
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const cambiarAcudiente = (campo) => (e) => setAcudiente(a => ({ ...a, [campo]: e.target.value }))

  const guardar = async () => {
    if (guardando) return
    const datos = {
      jugador_id: paciente.id, tipo, estado, fecha, motivo: estado === 'rechazado' ? motivo : '',
      asentimiento: menor && estado === 'firmado' ? asentimiento : '',
      ...(menor ? { firma_quien: 'acudiente', firmante_nombre: acudiente.nombre, firmante_tipo_documento: acudiente.tipo_documento,
        firmante_numero_documento: acudiente.numero_documento, firmante_parentesco: acudiente.parentesco } : { firma_quien: 'deportista' }),
    }
    // Las mismas reglas de la API: el mensaje sale de inmediato, sin esperar al servidor
    const v = validarConsentimiento(datos, paciente, hoyISO(), { conArchivo: !!archivo })
    if (!v.ok) { setError(v.error); return }
    setError(null)
    setGuardando(true)
    try {
      const { data } = await enviar('/consentimientos', datos, archivo)
      toast.success(estado === 'firmado' ? `${etiqueta}: firmado` : `${etiqueta}: registrado que no aceptó`)
      onGuardado(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal title={`${etiqueta}: ${paciente.nombre}`} onClose={onClose} onEnviar={guardar}
      footer={<>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn btn-primary" onClick={guardar} disabled={guardando}>
          <i className="fa-solid fa-signature" aria-hidden="true"></i> {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </>}>
      <OpcionesBoton id="cons-estado" etiqueta="¿Qué decidió?" valor={estado} onCambio={setEstado} permitirVacio={false}
        opciones={[['firmado', 'Firmó', { tono: 'ok', icono: 'fa-signature' }], ['rechazado', 'No aceptó', { tono: 'alerta', icono: 'fa-xmark' }]]} />
      {menor ? (
        <fieldset className="cons-acudiente">
          <legend>Firma el acudiente (es menor de edad)</legend>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="cons-acu-nombre">Nombre del acudiente *</label>
              <input id="cons-acu-nombre" value={acudiente.nombre} onChange={cambiarAcudiente('nombre')} autoComplete="off" />
            </div>
            <div className="form-group">
              <label htmlFor="cons-acu-parentesco">Parentesco</label>
              <select id="cons-acu-parentesco" value={acudiente.parentesco} onChange={cambiarAcudiente('parentesco')}>
                <option value="">Sin indicar</option>
                {[...new Set([acudiente.parentesco, ...PARENTESCOS].filter(Boolean))].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="cons-acu-tipo">Tipo de documento *</label>
              <select id="cons-acu-tipo" value={acudiente.tipo_documento} onChange={cambiarAcudiente('tipo_documento')}>
                {TIPOS_DOCUMENTO.map(t => <option key={t.codigo} value={t.codigo}>{t.nombre}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="cons-acu-numero">Número de documento *</label>
              <input id="cons-acu-numero" value={acudiente.numero_documento} onChange={cambiarAcudiente('numero_documento')} inputMode="numeric" autoComplete="off" />
            </div>
          </div>
        </fieldset>
      ) : (
        <p className="cons-firmante"><i className="fa-solid fa-user-pen" aria-hidden="true"></i> Firma el deportista: <strong>{paciente.nombre}</strong> · {documentoLegible(paciente.tipo_documento, paciente.numero_documento) || 'sin documento'}</p>
      )}
      {menor && estado === 'firmado' && (
        <OpcionesBoton id="cons-asentimiento" etiqueta="¿El menor dio su asentimiento? *" valor={asentimiento} onCambio={setAsentimiento} permitirVacio={false}
          ayuda={tipo === 'investigacion' ? 'Si dice que no, queda registrado y sus datos no se usan en investigación.' : 'Se registra con el formato de asentimiento.'}
          opciones={[['si', 'Sí', { tono: 'ok' }], ['no', 'No', { tono: 'alerta' }]]} />
      )}
      <div className="form-group">
        <label htmlFor="cons-fecha">{estado === 'firmado' ? 'Fecha de la firma' : 'Fecha'}</label>
        <input id="cons-fecha" type="date" value={fecha} max={hoyISO()} onChange={e => setFecha(e.target.value)} />
      </div>
      <CampoFoto id="cons-papel" etiqueta={estado === 'firmado' ? 'Foto del papel firmado *' : 'Foto del papel (opcional)'} aceptaPdf onCambio={setArchivo}
        ayuda="Con buena luz y de frente, que se lean la firma y el documento. También sirve un PDF escaneado." />
      {estado === 'rechazado' && (
        <div className="form-group">
          <label htmlFor="cons-motivo">Motivo (opcional)</label>
          <textarea id="cons-motivo" rows="2" maxLength={500} value={motivo} onChange={e => setMotivo(e.target.value)} />
        </div>
      )}
      {error && <p className="alerta alerta-error" role="alert"><i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> {error}</p>}
    </Modal>
  )
}

// ── Revocar lo firmado: un registro nuevo, con su motivo ──
function Revocar({ registro, etiqueta, paciente, onClose, onGuardado }) {
  const [motivo, setMotivo] = useState('')
  const [fecha, setFecha] = useState(hoyISO())
  const [archivo, setArchivo] = useState(null)
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const guardar = async () => {
    if (guardando) return
    const v = validarRevocacion({ motivo, fecha }, registro, hoyISO())
    if (!v.ok) { setError(v.error); return }
    setError(null)
    setGuardando(true)
    try {
      const { data } = await enviar(`/consentimientos/${registro.id}/revocar`, { motivo, fecha }, archivo)
      toast.success(`${etiqueta}: revocado`)
      onGuardado(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setGuardando(false)
    }
  }
  return (
    <Modal title={`Revocar · ${etiqueta}: ${paciente.nombre}`} onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn btn-danger" onClick={guardar} disabled={guardando}>
          <i className="fa-solid fa-rotate-left" aria-hidden="true"></i> {guardando ? 'Guardando…' : 'Revocar'}
        </button>
      </>}>
      <p className="ayuda-campo">El consentimiento firmado no se borra: queda en el historial y se registra la revocación con su motivo.</p>
      <div className="form-group">
        <label htmlFor="rev-motivo">Motivo de la revocación *</label>
        <textarea id="rev-motivo" rows="3" maxLength={500} value={motivo} onChange={e => setMotivo(e.target.value)} />
      </div>
      <div className="form-group">
        <label htmlFor="rev-fecha">Fecha</label>
        <input id="rev-fecha" type="date" value={fecha} max={hoyISO()} onChange={e => setFecha(e.target.value)} />
      </div>
      <CampoFoto id="rev-papel" etiqueta="Papel de la revocación (opcional)" aceptaPdf onCambio={setArchivo} />
      {error && <p className="alerta alerta-error" role="alert"><i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> {error}</p>}
    </Modal>
  )
}

// ── Ver el papel firmado: se trae por la API con sesión y solo vive en memoria mientras se ve (D8) ──
function VerSoporte({ registro, etiqueta, onClose }) {
  const [url, setUrl] = useState(null)
  const [error, setError] = useState(null)
  const esPdf = registro.archivo_mime === 'application/pdf'
  useEffect(() => {
    let creada = null
    api.get(`/archivos-clinicos/${registro.archivo_id}`, { responseType: 'blob', timeout: 60000 })
      .then(r => { creada = URL.createObjectURL(r.data); setUrl(creada) })
      .catch(e => setError(e.status === 410 ? 'El archivo ya no está disponible en el servidor. Avisa al administrador.' : e.message))
    return () => { if (creada) URL.revokeObjectURL(creada) }
  }, [registro.archivo_id])
  return (
    <Modal title={`Papel firmado · ${etiqueta}`} onClose={onClose}>
      <p className="ayuda-campo">{detalleConsentimiento(registro)}</p>
      {error ? <p className="alerta alerta-error" role="alert">{error}</p>
        : !url ? <p className="ayuda-campo">Cargando…</p>
        : esPdf ? (
          <a className="btn btn-primary" href={url} download={registro.archivo_nombre || 'consentimiento.pdf'}>
            <i className="fa-solid fa-file-pdf" aria-hidden="true"></i> Descargar el PDF
          </a>
        ) : <img className="cons-soporte" src={url} alt={`Papel firmado del consentimiento: ${etiqueta}`} />}
    </Modal>
  )
}

export default function PanelConsentimientos({ paciente, consentimientos, onCambio, id = 'ficha-consentimientos' }) {
  const [registrar, setRegistrar] = useState(null) // tipo
  const [revocar, setRevocar] = useState(null)     // registro firmado vigente
  const [soporte, setSoporte] = useState(null)     // registro con papel
  const { actual = {}, historial = [] } = consentimientos || {}
  const etiquetaDe = (tipo) => TIPOS_CONSENTIMIENTO.find(([t]) => t === tipo)?.[1] || tipo
  const listo = (data) => { setRegistrar(null); setRevocar(null); onCambio?.(data) }

  return (
    <section className="card ficha-bloque consentimientos" aria-labelledby={`${id}-titulo`} id={id} tabIndex={-1}>
      <h2 id={`${id}-titulo`}><i className="fa-solid fa-file-signature" aria-hidden="true"></i> Consentimientos</h2>
      <ul className="cons-lista">
        {TIPOS_CONSENTIMIENTO.map(([tipo, etiqueta]) => {
          const c = actual[tipo] || { tipo, estado: 'pendiente' }
          const anteriores = historial.filter(h => h.tipo === tipo && h.id !== c.id)
          const sinAsentimiento = c.estado === 'firmado' && !autoriza(c)
          return (
            <li key={tipo} className={`cons-tarjeta estado-${c.estado}`} aria-label={`${etiqueta}: ${c.estado}`}>
              <div className="cons-cabecera">
                <i className={`fa-solid ${ICONO[tipo]} cons-icono`} aria-hidden="true"></i>
                <strong>{etiqueta}{tipo === 'investigacion' && <small className="texto-suave"> · opcional</small>}</strong>
                <Insignia estado={c.estado} />
              </div>
              <p className="cons-detalle">{detalleConsentimiento(c)}</p>
              {sinAsentimiento && <p className="cons-nota"><i className="fa-solid fa-circle-info" aria-hidden="true"></i> Sin el asentimiento del menor, sus datos no se usan en investigación.</p>}
              <div className="cons-acciones">
                {c.estado === 'firmado' ? (
                  <>
                    {c.archivo_id && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSoporte(c)}><i className="fa-solid fa-eye" aria-hidden="true"></i> Ver papel</button>}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRevocar(c)}><i className="fa-solid fa-rotate-left" aria-hidden="true"></i> Revocar</button>
                  </>
                ) : (
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => setRegistrar(tipo)} aria-label={`Registrar firma: ${etiqueta}`}>
                    <i className="fa-solid fa-signature" aria-hidden="true"></i> Registrar firma
                  </button>
                )}
                <Link className="btn btn-ghost btn-sm" to={`/pacientes/${paciente.id}/formatos/${tipo}`} aria-label={`Imprimir formato: ${etiqueta}`}>
                  <i className="fa-solid fa-print" aria-hidden="true"></i> Imprimir formato
                </Link>
              </div>
              {anteriores.length > 0 && (
                <details className="cons-historial">
                  <summary>Historial ({anteriores.length} {anteriores.length === 1 ? 'registro anterior' : 'registros anteriores'})</summary>
                  <ol>
                    {anteriores.map(h => (
                      <li key={h.id}>
                        <Insignia estado={h.estado} /> {detalleConsentimiento(h)}
                        {h.archivo_id && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSoporte(h)}>Ver papel</button>}
                      </li>
                    ))}
                  </ol>
                </details>
              )}
            </li>
          )
        })}
      </ul>
      {paciente.menor && (
        <p className="ayuda-campo"><i className="fa-solid fa-user-shield" aria-hidden="true"></i> Es menor de edad: firma el acudiente y el menor da su asentimiento. <Link to={`/pacientes/${paciente.id}/formatos/asentimiento`}>Imprimir el formato de asentimiento</Link></p>
      )}

      {registrar && <Registrar tipo={registrar} etiqueta={etiquetaDe(registrar)} paciente={paciente} onClose={() => setRegistrar(null)} onGuardado={listo} />}
      {revocar && <Revocar registro={revocar} etiqueta={etiquetaDe(revocar.tipo)} paciente={paciente} onClose={() => setRevocar(null)} onGuardado={listo} />}
      {soporte && <VerSoporte registro={soporte} etiqueta={etiquetaDe(soporte.tipo)} onClose={() => setSoporte(null)} />}
    </section>
  )
}

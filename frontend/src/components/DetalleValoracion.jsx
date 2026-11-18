// Valoración cerrada (v2.7, T0.3; separada en la v2.8 para usarla también en la ficha clínica, T1.4).
// Solo lectura: quién la cerró y cuándo, su contenido, el código de integridad y las notas aclaratorias, que es la
// única forma de corregirla (Resolución 1995 de 1999). El borrador de otra persona también se ve aquí, sin notas ni
// integridad: solo quien lo abrió puede editarlo o cerrarlo.
import { useState } from 'react'
import toast from 'react-hot-toast'
import api from '../services/api'
import Modal from './Modal'
import { fechaLarga } from '../utils/fechas'
import { CAMPOS_ANTECEDENTES, contenidoVacio } from '../utils/valoracion'

export const cuando = (valor) => {
  if (!valor) return ''
  const f = new Date(valor)
  return `${fechaLarga(f)} de ${f.getFullYear()} · ${f.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}`
}

export function Secciones({ contenido = {} }) {
  const antecedentes = CAMPOS_ANTECEDENTES.filter(([c]) => contenido.antecedentes?.[c])
  return (
    <dl className="valoracion-secciones">
      {contenido.motivo_consulta && <div><dt>Motivo de consulta</dt><dd>{contenido.motivo_consulta}</dd></div>}
      {antecedentes.map(([c, etiqueta]) => <div key={c}><dt>{etiqueta}</dt><dd>{contenido.antecedentes[c]}</dd></div>)}
      {contenido.observaciones && <div><dt>Observaciones</dt><dd>{contenido.observaciones}</dd></div>}
      {contenidoVacio(contenido) && <div><dt>Contenido</dt><dd>Sin datos registrados.</dd></div>}
    </dl>
  )
}

export default function DetalleValoracion({ valoracion, soloLectura = false, onClose }) {
  const [detalle, setDetalle] = useState(valoracion)
  const [nota, setNota] = useState('')
  const [verificacion, setVerificacion] = useState(null)
  const [ocupado, setOcupado] = useState(false)

  const agregarNota = async () => {
    if (!nota.trim()) return toast.error('Escribe la nota aclaratoria.')
    setOcupado(true)
    try {
      const { data } = await api.post(`/valoraciones/${detalle.id}/notas`, { texto: nota })
      setDetalle(d => ({ ...d, notas: [...(d.notas || []), data] }))
      setNota('')
      toast.success('Nota aclaratoria agregada')
    } catch (e) { toast.error(e.message) } finally { setOcupado(false) }
  }
  const verificar = async () => {
    try {
      const { data } = await api.get(`/valoraciones/${detalle.id}/integridad`)
      setVerificacion(data)
    } catch (e) { toast.error(e.message) }
  }

  return (
    <Modal title={`${detalle.tipo_nombre}: ${detalle.jugador_nombre}`} onClose={onClose}>
      {detalle.estado !== 'cerrada' ? (
        <>
          <p className="valoracion-firma">
            <i className="fa-solid fa-pen" aria-hidden="true"></i> Borrador abierto el {cuando(detalle.fecha_hora)}{detalle.atendio ? ` · ${detalle.atendio}` : ''}
          </p>
          <p className="ayuda-campo">Solo quien abrió el borrador puede editarlo o cerrarlo. Todavía no hace parte de la historia clínica.</p>
          <Secciones contenido={detalle.contenido} />
        </>
      ) : <>
      <p className="valoracion-firma">
        <i className="fa-solid fa-lock" aria-hidden="true"></i> Cerrada el {cuando(detalle.cerrada_en)}{detalle.atendio ? ` · ${detalle.atendio}` : ''}
      </p>
      <Secciones contenido={detalle.contenido} />

      {!soloLectura && (
        <div className="valoracion-integridad">
          {detalle.hash_cierre
            ? <span className="texto-suave">Código de integridad: <code>{String(detalle.hash_cierre).slice(0, 12)}…</code></span>
            : <span className="texto-suave">Registro migrado: sin código de integridad.</span>}
          <button type="button" className="btn btn-secondary btn-sm" onClick={verificar}>
            <i className="fa-solid fa-shield-halved" aria-hidden="true"></i> Verificar integridad
          </button>
          {verificacion && (
            <p role="status" className={verificacion.integra === false ? 'alerta alerta-error' : 'ayuda-campo'}>
              <i className={`fa-solid ${verificacion.integra ? 'fa-circle-check' : verificacion.integra === false ? 'fa-triangle-exclamation' : 'fa-circle-info'}`} aria-hidden="true"></i> {verificacion.mensaje}
            </p>
          )}
        </div>
      )}

      <h4 className="valoracion-notas-titulo">Notas aclaratorias</h4>
      {(detalle.notas || []).length === 0
        ? <p className="ayuda-campo">Sin notas aclaratorias.</p>
        : (
          <ol className="valoracion-notas">
            {detalle.notas.map(n => (
              <li key={n.id}>
                <p>{n.texto}</p>
                <small className="texto-suave">{cuando(n.creada_en)}{n.quien_atiende ? ` · ${n.quien_atiende.nombre} · ${n.quien_atiende.descripcion}` : ''}</small>
              </li>
            ))}
          </ol>
        )}
      {!soloLectura && (
        <div className="form-group">
          <label htmlFor="val-nota">Nueva nota aclaratoria</label>
          <textarea id="val-nota" rows="3" value={nota} onChange={e => setNota(e.target.value)} placeholder="Corrección o dato que faltó. La valoración original no cambia." />
          <button type="button" className="btn btn-primary" onClick={agregarNota} disabled={ocupado} style={{ alignSelf: 'flex-start' }}>Agregar nota</button>
        </div>
      )}
      </>}
    </Modal>
  )
}

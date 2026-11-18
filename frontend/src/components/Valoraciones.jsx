// Historia clínica por valoraciones (v2.7, T0.3 del plan de historia clínica).
// Resolución 1995 de 1999: cada atención queda como un registro aparte con fecha, hora y quien atiende. Una valoración
// cerrada no se modifica: se corrige con notas aclaratorias. Reemplaza el formulario anterior, que sobrescribía la
// historia en cada guardado (DEF-052).
// Pensado para celular y tableta: lista de atenciones que se toca completa, botones de tipo grandes, antecedentes
// plegables y la barra de acciones fija abajo de la ventana. La Fase 1 (T1.4) lo lleva a la ficha clínica.
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../services/api'
import Modal from './Modal'
import ConfirmModal from './ConfirmModal'
import { EstadoVacio } from './EstadoVista'
import BitacoraAccesos from './BitacoraAccesos'
import { useAuth } from '../context/AuthContext'
import { etiquetaJugador } from '../utils/jugador'
import { fechaLarga } from '../utils/fechas'
import { TIPOS_VALORACION, CAMPOS_ANTECEDENTES, normalizarContenido, contenidoVacio, MENSAJE_VACIA } from '../utils/valoracion'

const cuando = (valor) => {
  if (!valor) return ''
  const f = new Date(valor)
  return `${fechaLarga(f)} de ${f.getFullYear()} · ${f.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}`
}
const VACIO = { motivo_consulta: '', antecedentes: {}, observaciones: '' }
const errorDe = (e) => e.response?.data?.error || e.message

function Secciones({ contenido = {} }) {
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

export default function Valoraciones({ jugadores = [], soloLectura = false, jugadorFijo = null }) {
  const { usuario } = useAuth()
  const [jugadorId, setJugadorId] = useState(jugadorFijo ? String(jugadorFijo) : '')
  const [lista, setLista] = useState(null)
  const [editor, setEditor] = useState(null)        // borrador abierto
  const [detalle, setDetalle] = useState(null)      // valoración cerrada abierta
  const [nota, setNota] = useState('')
  const [verificacion, setVerificacion] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [confirmar, setConfirmar] = useState(null)  // 'cerrar' | 'descartar'
  const [verAccesos, setVerAccesos] = useState(false) // v2.7 (T0.6): bitácora de accesos

  const cargar = async (id = jugadorId) => {
    if (!id && !soloLectura) { setLista(null); return }
    try {
      const { data } = await api.get('/valoraciones', { params: id ? { jugador_id: id } : {} })
      setLista(data)
    } catch (e) {
      setLista([])
      toast.error(errorDe(e))
    }
  }
  useEffect(() => { cargar() }, [jugadorId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Abrir ──
  const nueva = () => {
    // Los antecedentes se repiten de una valoración a otra: se proponen los de la última cerrada para revisarlos
    const anterior = (lista || []).find(v => v.estado === 'cerrada' && v.contenido?.antecedentes)
    setEditor({ tipo: (lista || []).length ? 'control' : 'inicial', contenido: { ...VACIO, antecedentes: { ...(anterior?.contenido.antecedentes || {}) } }, copiados: !!anterior })
  }
  const abrir = async (v) => {
    if (v.estado === 'borrador' && Number(v.profesional_id) === Number(usuario?.id)) {
      setEditor({ id: v.id, version: v.version, tipo: v.tipo, contenido: { ...VACIO, ...v.contenido, antecedentes: { ...(v.contenido?.antecedentes || {}) } } })
      return
    }
    try {
      const { data } = await api.get(`/valoraciones/${v.id}`)
      setVerificacion(null); setNota(''); setDetalle(data)
    } catch (e) { toast.error(errorDe(e)) }
  }

  // ── Borrador ──
  const cambiar = (campo, valor) => setEditor(ed => ({ ...ed, contenido: { ...ed.contenido, [campo]: valor } }))
  const cambiarAntecedente = (campo, valor) => setEditor(ed => ({ ...ed, contenido: { ...ed.contenido, antecedentes: { ...ed.contenido.antecedentes, [campo]: valor } } }))

  const guardarBorrador = async ({ silencioso = false } = {}) => {
    const c = normalizarContenido(editor.contenido)
    if (!c.ok) { toast.error(c.error); return null }
    setOcupado(true)
    try {
      const { data } = editor.id
        ? await api.put(`/valoraciones/${editor.id}`, { tipo: editor.tipo, contenido: c.contenido, version: editor.version })
        : await api.post('/valoraciones', { jugador_id: jugadorId, tipo: editor.tipo, contenido: c.contenido })
      setEditor(ed => ({ ...ed, id: data.id, version: data.version }))
      if (!silencioso) toast.success('Borrador guardado')
      cargar()
      return data
    } catch (e) {
      toast.error(errorDe(e))
      return null
    } finally {
      setOcupado(false)
    }
  }

  const cerrar = async () => {
    setConfirmar(null)
    const c = normalizarContenido(editor.contenido)
    if (c.ok && contenidoVacio(c.contenido)) return toast.error(MENSAJE_VACIA)
    const guardada = await guardarBorrador({ silencioso: true })
    if (!guardada) return
    setOcupado(true)
    try {
      const { data } = await api.post(`/valoraciones/${guardada.id}/cerrar`, { version: guardada.version })
      toast.success('Valoración cerrada y firmada')
      setEditor(null)
      cargar()
      abrir(data)
    } catch (e) {
      toast.error(errorDe(e))
    } finally {
      setOcupado(false)
    }
  }

  const descartar = async () => {
    setConfirmar(null)
    if (!editor.id) { setEditor(null); return }
    try {
      await api.delete(`/valoraciones/${editor.id}`)
      toast.success('Borrador descartado')
      setEditor(null)
      cargar()
    } catch (e) { toast.error(errorDe(e)) }
  }

  // ── Valoración cerrada ──
  const agregarNota = async () => {
    if (!nota.trim()) return toast.error('Escribe la nota aclaratoria.')
    setOcupado(true)
    try {
      const { data } = await api.post(`/valoraciones/${detalle.id}/notas`, { texto: nota })
      setDetalle(d => ({ ...d, notas: [...(d.notas || []), data] }))
      setNota('')
      toast.success('Nota aclaratoria agregada')
    } catch (e) { toast.error(errorDe(e)) } finally { setOcupado(false) }
  }
  const verificar = async () => {
    try {
      const { data } = await api.get(`/valoraciones/${detalle.id}/integridad`)
      setVerificacion(data)
    } catch (e) { toast.error(errorDe(e)) }
  }

  const jugador = jugadores.find(j => String(j.id) === String(jugadorId))

  return (
    <section className="card valoraciones" aria-labelledby="t-valoraciones">
      <div className="valoraciones-cabecera">
        <div>
          <h3 id="t-valoraciones"><i className="fa-solid fa-notes-medical" aria-hidden="true"></i> {soloLectura ? 'Mis valoraciones' : 'Historia clínica · Valoraciones'}</h3>
          <p className="ayuda-campo">Cada atención queda como un registro aparte. Una valoración cerrada no se modifica: se corrige con una nota aclaratoria.</p>
        </div>
        <div className="valoraciones-acciones">
          {(soloLectura || jugadorId) && (
            <button type="button" className="btn btn-secondary" onClick={() => setVerAccesos(true)}>
              <i className="fa-solid fa-clock-rotate-left" aria-hidden="true"></i> {soloLectura ? '¿Quién consultó mi historia?' : 'Accesos a esta historia'}
            </button>
          )}
          {!soloLectura && (
            <button type="button" className="btn btn-primary" onClick={nueva} disabled={!jugadorId}>
              <i className="fa-solid fa-plus" aria-hidden="true"></i> Nueva valoración
            </button>
          )}
        </div>
      </div>

      {!soloLectura && !jugadorFijo && (
        <div className="form-group valoraciones-deportista">
          <label htmlFor="val-jugador">Deportista</label>
          <select id="val-jugador" value={jugadorId} onChange={e => setJugadorId(e.target.value)}>
            <option value="">Elige un deportista…</option>
            {jugadores.map(j => <option key={j.id} value={j.id}>{etiquetaJugador(j)}{j.numero_documento ? ` · ${j.tipo_documento} ${j.numero_documento}` : ' · sin documento'}{j.activo === false ? ' · retirado' : ''}</option>)}
          </select>
          {jugador && !jugador.numero_documento && (
            <small className="ayuda-campo aviso-texto">Este deportista no tiene documento registrado: complétalo en Deportistas para poder abrir una valoración.</small>
          )}
        </div>
      )}

      {lista === null ? (
        !soloLectura && <p className="ayuda-campo">Elige un deportista para ver su historia.</p>
      ) : lista.length === 0 ? (
        <EstadoVacio compacto icono="fa-notes-medical" titulo={soloLectura ? 'Aún no tienes valoraciones cerradas' : 'Sin valoraciones'}
          descripcion={soloLectura ? 'Cuando el personal de salud cierre una valoración tuya, aparecerá aquí.' : 'Usa "Nueva valoración" para registrar la primera atención.'} />
      ) : (
        <ol className="linea-tiempo" aria-label="Valoraciones, de la más reciente a la más antigua">
          {lista.map(v => (
            <li key={v.id}>
              <button type="button" className="valoracion-item" onClick={() => abrir(v)}>
                <span className="valoracion-item-titulo">
                  <strong>{v.tipo_nombre}</strong>
                  {soloLectura || jugadorFijo ? null : <span className="texto-suave"> · {v.jugador_nombre}</span>}
                </span>
                <span className={`badge ${v.estado === 'cerrada' ? 'badge-green' : 'badge-orange'}`}>
                  <i className={`fa-solid ${v.estado === 'cerrada' ? 'fa-lock' : 'fa-pen'}`} aria-hidden="true"></i> {v.estado === 'cerrada' ? 'Cerrada' : 'Borrador'}
                </span>
                <span className="valoracion-item-meta">{cuando(v.fecha_hora)}{v.atendio ? ` · ${v.atendio}` : ''}</span>
              </button>
            </li>
          ))}
        </ol>
      )}

      {/* Borrador: se edita y se cierra */}
      {editor && (
        <Modal title={`${editor.id ? 'Valoración en borrador' : 'Nueva valoración'}${jugador ? `: ${jugador.nombre}` : ''}`} onClose={() => setEditor(null)}
          footer={<>
            {editor.id && <button type="button" className="btn btn-ghost" onClick={() => setConfirmar('descartar')} disabled={ocupado}>Descartar</button>}
            <button type="button" className="btn btn-secondary" onClick={() => guardarBorrador()} disabled={ocupado}>Guardar borrador</button>
            <button type="button" className="btn btn-primary" onClick={() => setConfirmar('cerrar')} disabled={ocupado}>
              <i className="fa-solid fa-signature" aria-hidden="true"></i> Cerrar y firmar
            </button>
          </>}>
          <div className="form-group">
            <span className="etiqueta-campo" id="val-tipo">Tipo de valoración</span>
            <div className="segmentado" role="group" aria-labelledby="val-tipo">
              {TIPOS_VALORACION.map(([valor, etiqueta]) => (
                <button key={valor} type="button" aria-pressed={editor.tipo === valor} onClick={() => setEditor(ed => ({ ...ed, tipo: valor }))}>{etiqueta}</button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="val-motivo">Motivo de consulta</label>
            <textarea id="val-motivo" rows="3" value={editor.contenido.motivo_consulta || ''} onChange={e => cambiar('motivo_consulta', e.target.value)} />
          </div>
          <details className="ident-grupo" open>
            <summary><i className="fa-solid fa-book-medical" aria-hidden="true"></i> Antecedentes <small>Opcional</small></summary>
            {editor.copiados && <p className="ayuda-campo">Se copiaron de la última valoración cerrada: revísalos y actualiza lo que haya cambiado.</p>}
            <div className="form-grid">
              {CAMPOS_ANTECEDENTES.map(([campo, etiqueta]) => (
                <div className="form-group" key={campo}>
                  <label htmlFor={`val-${campo}`}>{etiqueta}</label>
                  <textarea id={`val-${campo}`} rows="2" value={editor.contenido.antecedentes?.[campo] || ''} onChange={e => cambiarAntecedente(campo, e.target.value)} />
                </div>
              ))}
            </div>
          </details>
          <div className="form-group" style={{ marginTop: 14 }}>
            <label htmlFor="val-observaciones">Observaciones</label>
            <textarea id="val-observaciones" rows="3" value={editor.contenido.observaciones || ''} onChange={e => cambiar('observaciones', e.target.value)} />
          </div>
          {usuario?.quien_atiende && (
            <p className="ayuda-campo">Al cerrarla queda firmada como <strong>{usuario.quien_atiende.nombre} · {usuario.quien_atiende.descripcion}</strong> y ya no se puede modificar.</p>
          )}
        </Modal>
      )}

      {/* Valoración cerrada: solo lectura, notas aclaratorias e integridad */}
      {detalle && (
        <Modal title={`${detalle.tipo_nombre}: ${detalle.jugador_nombre}`} onClose={() => setDetalle(null)}>
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
        </Modal>
      )}

      {verAccesos && (
        <BitacoraAccesos titulo={soloLectura ? 'Quién ha consultado mi historia' : `Accesos a la historia${jugador ? ` de ${jugador.nombre}` : ''}`}
          jugadorId={soloLectura ? null : jugadorId} onClose={() => setVerAccesos(false)} />
      )}

      <ConfirmModal
        isOpen={confirmar === 'cerrar'}
        title="¿Cerrar y firmar la valoración?"
        message="Una vez cerrada no se puede modificar ni borrar: solo se le pueden agregar notas aclaratorias (Resolución 1995 de 1999)."
        confirmText="Sí, cerrar y firmar"
        cancelText="Seguir editando"
        confirmVariant="primary"
        loading={ocupado}
        onConfirm={cerrar}
        onCancel={() => setConfirmar(null)}
      />
      <ConfirmModal
        isOpen={confirmar === 'descartar'}
        title="¿Descartar el borrador?"
        message="El borrador todavía no hace parte de la historia clínica y se borrará."
        confirmText="Sí, descartar"
        cancelText="Cancelar"
        confirmVariant="danger"
        onConfirm={descartar}
        onCancel={() => setConfirmar(null)}
      />
    </section>
  )
}

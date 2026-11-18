// Historia clínica por valoraciones (v2.7, T0.3 del plan de historia clínica).
// Resolución 1995 de 1999: cada atención queda como un registro aparte con fecha, hora y quien atiende. Una valoración
// cerrada no se modifica: se corrige con notas aclaratorias. Reemplaza el formulario anterior, que sobrescribía la
// historia en cada guardado (DEF-052).
// Pensado para celular y tableta: lista de atenciones que se toca completa, botones de tipo grandes, antecedentes
// plegables y la barra de acciones fija abajo de la ventana. La Fase 1 (T1.4) lo lleva a la ficha clínica.
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../services/api'
import { EstadoVacio } from './EstadoVista'
import EditorValoracion, { contenidoParaEditar, borradorNuevo } from './EditorValoracion'
import DetalleValoracion, { cuando } from './DetalleValoracion'
import BitacoraAccesos from './BitacoraAccesos'
import { useAuth } from '../context/AuthContext'
import { etiquetaJugador } from '../utils/jugador'

const errorDe = (e) => e.message

export default function Valoraciones({ jugadores = [], soloLectura = false, jugadorFijo = null, jugadorInicial = '' }) {
  const { usuario } = useAuth()
  const [jugadorId, setJugadorId] = useState(jugadorFijo ? String(jugadorFijo) : String(jugadorInicial || ''))
  const [lista, setLista] = useState(null)
  const [editor, setEditor] = useState(null)        // borrador abierto
  const [detalle, setDetalle] = useState(null)      // valoración cerrada abierta
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
  const nueva = () => setEditor(borradorNuevo(lista))
  const abrir = async (v) => {
    if (v.estado === 'borrador' && Number(v.profesional_id) === Number(usuario?.id)) {
      setEditor({ id: v.id, version: v.version, tipo: v.tipo, contenido: contenidoParaEditar(v.contenido) })
      return
    }
    try {
      const { data } = await api.get(`/valoraciones/${v.id}`)
      setDetalle(data)
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

      {/* Borrador: se edita, se guarda solo (T1.2) y se cierra */}
      {editor && (
        <EditorValoracion key={editor.id || 'nueva'} inicial={editor} jugadorId={jugadorId} jugadorNombre={jugador?.nombre}
          onSalir={() => setEditor(null)} onCambio={() => cargar()} onCerrada={(data) => { setEditor(null); abrir(data) }} />
      )}

      {/* Valoración cerrada: solo lectura, notas aclaratorias e integridad */}
      {detalle && <DetalleValoracion key={detalle.id} valoracion={detalle} soloLectura={soloLectura} onClose={() => setDetalle(null)} />}

      {verAccesos && (
        <BitacoraAccesos titulo={soloLectura ? 'Quién ha consultado mi historia' : `Accesos a la historia${jugador ? ` de ${jugador.nombre}` : ''}`}
          jugadorId={soloLectura ? null : jugadorId} onClose={() => setVerAccesos(false)} />
      )}

    </section>
  )
}

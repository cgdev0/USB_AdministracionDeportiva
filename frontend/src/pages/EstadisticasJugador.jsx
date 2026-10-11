import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, BarChart3 } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { ANIMACION_GRAFICA } from '../utils/movimiento'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'
import { Esqueleto, EstadoVacio, EstadoSinResultados, EstadoError } from '../components/EstadoVista'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useDeporte } from '../context/DeporteContext'
import { etiquetaJugador, nombreConDorsal } from '../utils/jugador'

const EMPTY = { jugador_id: '', partido_id: '', goles: 0, asistencias: 0, minutos_jugados: 0 }

export default function EstadisticasJugador() {
  const { tienePermiso } = useAuth()
  const puedeEditar = tienePermiso(['administrador', 'entrenador'])
  const { selectedSportId, selectedSport, setSelectedSportId } = useDeporte()

  const [stats, setStats]         = useState([])
  const [jugadores, setJugadores] = useState([])
  const [partidos, setPartidos]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [modal, setModal]         = useState(false)
  const [form, setForm]           = useState(EMPTY)
  const [editId, setEditId]       = useState(null)
  const [saving, setSaving]       = useState(false)
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null, loading: false })

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [sRes, jRes, pRes] = await Promise.all([
        api.get('/estadisticas'), api.get('/jugadores'), api.get('/partidos'),
      ])
      setStats(sRes.data); setJugadores(jRes.data); setPartidos(pRes.data)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  // Filtrar jugadores y estadísticas por el deporte seleccionado
  const jugadoresFiltrados = jugadores.filter(j => {
    if (selectedSportId && selectedSportId !== 'todos') {
      return String(j.disciplina_id) === String(selectedSportId)
    }
    return true
  })

  const statsFiltradas = stats.filter(s => {
    if (selectedSportId && selectedSportId !== 'todos') {
      const j = jugadores.find(jug => jug.id === s.jugador_id)
      return j ? String(j.disciplina_id) === String(selectedSportId) : true
    }
    return true
  })

  const openCreate = () => { setForm(EMPTY); setEditId(null); setModal(true) }
  const openEdit   = (s) => {
    setForm({
      jugador_id:      s.jugador_id,
      partido_id:      s.partido_id || '',
      goles:           s.goles,
      asistencias:     s.asistencias,
      minutos_jugados: s.minutos_jugados,
    })
    setEditId(s.id); setModal(true)
  }
  const closeModal   = () => setModal(false)
  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async () => {
    if (!form.jugador_id) return toast.error('Jugador es obligatorio')
    setSaving(true)
    try {
      if (editId) {
        await api.put(`/estadisticas/${editId}`, form)
        toast.success('Estadística actualizada')
      } else {
        await api.post('/estadisticas', form)
        toast.success('Estadística registrada')
      }
      closeModal(); load()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const handleDelete = (id) => {
    setDeleteModal({ isOpen: true, id, loading: false })
  }

  const handleConfirmDelete = async () => {
    if (!deleteModal.id) return
    setDeleteModal(prev => ({ ...prev, loading: true }))
    try {
      await api.delete(`/estadisticas/${deleteModal.id}`)
      toast.success('Estadística eliminada')
      setDeleteModal({ isOpen: false, id: null, loading: false })
      load()
    } catch (e) {
      toast.error(e.response?.data?.error || e.message)
      setDeleteModal(prev => ({ ...prev, loading: false }))
    }
  }

  // Agrupar para gráfica
  const chartData = jugadoresFiltrados.map(j => {
    const rows = statsFiltradas.filter(s => s.jugador_id === j.id)
    return {
      nombre:    j.nombre.split(' ')[0],
      goles:     rows.reduce((a, s) => a + Number(s.goles), 0),
      asistencias: rows.reduce((a, s) => a + Number(s.asistencias), 0),
      minutos:   rows.reduce((a, s) => a + Number(s.minutos_jugados), 0),
    }
  }).filter(d => d.goles || d.asistencias || d.minutos)

  return (
    <div>
      <div className="page-header">
        <h2>Estadísticas de Jugadores</h2>
        <p>
          Rendimiento individual por partido y acumulado
          {selectedSportId && selectedSportId !== 'todos' ? ` — Deporte: ${selectedSport?.nombre}` : ''}
        </p>
      </div>

      {/* Gráfica */}
      {chartData.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-title"><BarChart3 size={18} color="var(--accent)" /> Goles / Anotaciones y Asistencias por Jugador</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="nombre" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border-hover)', borderRadius: 8, color: 'var(--text-primary)' }} />
              <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }} />
              <Bar {...ANIMACION_GRAFICA} dataKey="goles"       name="Goles / Puntos"       fill="var(--accent)"  radius={[6,6,0,0]} />
              <Bar {...ANIMACION_GRAFICA} dataKey="asistencias" name="Asistencias" fill="var(--naranja)" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="page-toolbar">
        <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          {!loading && !error && `${statsFiltradas.length} registros estadísticos`}
        </span>
        {puedeEditar && (
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} /> Agregar Estadística
          </button>
        )}
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? <Esqueleto tipo="tabla" columnas={6} /> : error ? (
          <EstadoError mensaje={error} onReintentar={load} />
        ) : stats.length === 0 ? (
          <EstadoVacio
            icono="fa-chart-column"
            titulo="Aún no hay estadísticas registradas"
            descripcion={puedeEditar
              ? 'Después de cada partido, registra goles o anotaciones, asistencias y minutos de cada deportista para ver la gráfica y los máximos anotadores.'
              : 'Cuando un entrenador registre estadísticas de un partido, aparecerán aquí.'}
            accion={puedeEditar ? { texto: 'Agregar estadística', icono: 'fa-plus', onClick: openCreate } : null}
          />
        ) : statsFiltradas.length === 0 ? (
          <EstadoSinResultados
            descripcion={`No hay estadísticas de deportistas de ${selectedSport?.nombre || 'este deporte'}.`}
            onLimpiar={() => setSelectedSportId('todos')}
            textoLimpiar="Ver todos los deportes"
          />
        ) : (
          <div className="table-wrapper" tabIndex={0} role="region" aria-label="Estadísticas por partido">
            <table>
              <thead>
                <tr>
                  <th>Jugador</th><th>Partido</th><th>Rival</th>
                  <th>Goles / Puntos</th><th>Asistencias</th><th>Minutos</th>
                  {puedeEditar && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {statsFiltradas.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{nombreConDorsal(s.jugador_nombre, s.jugador_dorsal)}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}> {s.partido_fecha ? new Date(s.partido_fecha).toLocaleDateString('es') : '—'}</td>
                    <td>{s.rival || '—'}</td>
                    <td style={{ fontWeight: 700, color: s.goles > 0 ? 'var(--accent-light)' : 'var(--text-muted)' }}>
                      {s.goles}
                    </td>
                    <td style={{ fontWeight: 700, color: s.asistencias > 0 ? 'var(--accent2)' : 'var(--text-muted)' }}>
                      {s.asistencias}
                    </td>
                    <td>{s.minutos_jugados}</td>
                    {puedeEditar && (
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(s)}>
                            <Pencil size={13} /> Editar
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.id)} aria-label={`Eliminar la estadística de ${s.jugador_nombre || "este deportista"}`} title="Eliminar">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <Modal
          title={editId ? 'Editar Estadística' : 'Nueva Estadística'}
          onClose={closeModal}
          footer={
            <>
              <button className="btn btn-ghost" onClick={closeModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
                {saving ? 'Guardando…' : editId ? 'Actualizar' : 'Registrar'}
              </button>
            </>
          }
        >
          <div className="form-grid">
            <div className="form-group">
              <label>Jugador *</label>
              <select name="jugador_id" value={form.jugador_id} onChange={handleChange}>
                <option value="">Seleccionar…</option>
                {jugadoresFiltrados.map(j => <option key={j.id} value={j.id}>{etiquetaJugador(j)} {j.disciplina_nombre ? `(${j.disciplina_nombre})` : ''}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Partido</label>
              <select name="partido_id" value={form.partido_id} onChange={handleChange}>
                <option value="">Sin partido…</option>
                {partidos.map(p => (
                  <option key={p.id} value={p.id}>
                    {new Date(p.fecha).toLocaleDateString('es')} – {p.rival}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Goles / Puntos</label>
              <input name="goles" type="number" min="0" value={form.goles} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Asistencias</label>
              <input name="asistencias" type="number" min="0" value={form.asistencias} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Minutos jugados</label>
              <input name="minutos_jugados" type="number" min="0" max="120" value={form.minutos_jugados} onChange={handleChange} />
            </div>
          </div>
        </Modal>
      )}

      {/* Modal de confirmación para eliminar estadística */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        title="¿Eliminar estadística?"
        message="¿Estás seguro de que deseas eliminar este registro estadístico? Esta acción no se puede deshacer."
        confirmText="Sí, Eliminar"
        cancelText="Cancelar"
        confirmVariant="danger"
        loading={deleteModal.loading}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModal({ isOpen: false, id: null, loading: false })}
      />
    </div>
  )
}

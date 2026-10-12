import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Dumbbell } from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'
import { Esqueleto, EstadoVacio, EstadoError, EstadoSinResultados } from '../components/EstadoVista'
import api from '../services/api'
import CamposAgenda, { AGENDA_VACIA, agendaDe, resumenAgenda, useEquiposAsignables } from '../components/CamposAgenda'
import { useAuth } from '../context/AuthContext'
import { useFiltroDeporte } from '../context/DeporteContext'

const EMPTY = { fecha: '', tipo: '', descripcion: '', ...AGENDA_VACIA }
const TIPOS  = ['Resistencia','Fuerza','Táctica','Velocidad','Técnica','Físico General','Recuperación']

export default function Entrenamientos() {
  const { tienePermiso } = useAuth()
  const puedeEditar = tienePermiso(['administrador', 'entrenador'])

  const [entrenamientos, setEntrenamientos] = useState([])
  const filtro = useFiltroDeporte()
  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState(null)
  const [modal, setModal]                   = useState(false)
  const [form, setForm]                     = useState(EMPTY)
  const [editId, setEditId]                 = useState(null)
  const [saving, setSaving]                 = useState(false)
  const [deleteModal, setDeleteModal]       = useState({ isOpen: false, id: null, loading: false })
  const equipos = useEquiposAsignables(puedeEditar)

  const load = () => {
    setLoading(true)
    setError(null)
    api.get('/entrenamientos')
      .then(r => setEntrenamientos(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openCreate = () => { setForm(EMPTY); setEditId(null); setModal(true) }
  const openEdit   = (e) => { setForm({ fecha: e.fecha?.slice(0,10), tipo: e.tipo, descripcion: e.descripcion || '', ...agendaDe(e) }); setEditId(e.id); setModal(true) }
  const closeModal = ()  => setModal(false)

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async () => {
    if (!form.fecha || !form.tipo) return toast.error('Fecha y tipo son obligatorios')
    setSaving(true)
    try {
      if (editId) {
        await api.put(`/entrenamientos/${editId}`, form)
        toast.success('Entrenamiento actualizado')
      } else {
        await api.post('/entrenamientos', form)
        toast.success('Entrenamiento registrado')
      }
      closeModal(); load()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (id) => {
    setDeleteModal({ isOpen: true, id, loading: false })
  }

  const handleConfirmDelete = async () => {
    if (!deleteModal.id) return
    setDeleteModal(prev => ({ ...prev, loading: true }))
    try {
      await api.delete(`/entrenamientos/${deleteModal.id}`)
      toast.success('Entrenamiento eliminado')
      setDeleteModal({ isOpen: false, id: null, loading: false })
      load()
    } catch (e) {
      toast.error(e.response?.data?.error || e.message)
      setDeleteModal(prev => ({ ...prev, loading: false }))
    }
  }


  // Filtro por el deporte de la cabecera (v1.9): las actividades sin equipo son generales y se ven en todos
  const visibles = entrenamientos.filter(filtro.deActividad)
  return (
    <div>
      <div className="page-header">
        <h2>Entrenamientos</h2>
        <p>Planificación y registro de sesiones</p>
      </div>

      <div className="page-toolbar">
        <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          {!loading && !error && <>
            <Dumbbell size={15} style={{ display: 'inline', marginRight: 6 }} />
            {visibles.length} {visibles.length === 1 ? 'sesión' : 'sesiones'}{filtro.hay ? ` de ${filtro.nombre} y generales` : ' registradas'}
          </>}
        </span>
        {puedeEditar && (
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} /> Nuevo Entrenamiento
          </button>
        )}
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? <Esqueleto tipo="tabla" columnas={puedeEditar ? 4 : 3} /> : error ? (
          <EstadoError mensaje={error} onReintentar={load} />
        ) : entrenamientos.length === 0 ? (
          <EstadoVacio
            icono="fa-dumbbell"
            titulo="Aún no hay entrenamientos registrados"
            descripcion={puedeEditar
              ? 'Crea la primera sesión para poder tomar asistencia y ver la agenda de la semana en el inicio.'
              : 'Cuando un entrenador programe una sesión, aparecerá aquí.'}
            accion={puedeEditar ? { texto: 'Nuevo entrenamiento', icono: 'fa-plus', onClick: openCreate } : null}
          />
        ) : visibles.length === 0 ? (
          <EstadoSinResultados descripcion={`No hay entrenamientos de ${filtro.nombre}.`} onLimpiar={filtro.limpiar} textoLimpiar="Ver todos los deportes" />
        ) : (
          <div className="table-wrapper" tabIndex={0} role="region" aria-label="Entrenamientos registrados">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Descripción</th>
                  {puedeEditar && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {visibles.map(e => (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 600 }}>{new Date(e.fecha).toLocaleDateString('es', { day:'2-digit', month:'short', year:'numeric' })}</td>
                    <td><span className="badge badge-purple">{e.tipo}</span><span className="sub-agenda">{resumenAgenda(e)}</span></td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{e.descripcion || '—'}</td>
                    {puedeEditar && (
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(e)}>
                            <Pencil size={13} /> Editar
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(e.id)} aria-label={`Eliminar el entrenamiento ${e.tipo || ""} del ${new Date(e.fecha).toLocaleDateString('es')}`} title="Eliminar">
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
          title={editId ? 'Editar Entrenamiento' : 'Nuevo Entrenamiento'}
          onClose={closeModal}
          footer={
            <>
              <button className="btn btn-ghost" onClick={closeModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
                {saving ? 'Guardando…' : editId ? 'Actualizar' : 'Crear'}
              </button>
            </>
          }
        >
          <div className="form-grid">
            <div className="form-group">
              <label>Fecha *</label>
              <input name="fecha" type="date" value={form.fecha} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Tipo *</label>
              <select name="tipo" value={form.tipo} onChange={handleChange}>
                <option value="">Seleccionar…</option>
                {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Descripción</label>
              <textarea name="descripcion" rows="3" value={form.descripcion} onChange={handleChange}
                placeholder="Describe el contenido del entrenamiento…" style={{ resize: 'vertical' }} />
            </div>
            <CamposAgenda form={form} onChange={handleChange} equipos={equipos} />
          </div>
        </Modal>
      )}

      {/* Modal de confirmación para eliminar entrenamiento */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        title="¿Eliminar sesión de entrenamiento?"
        message="¿Estás seguro de que deseas eliminar este entrenamiento y sus registros de asistencia correspondientes?"
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

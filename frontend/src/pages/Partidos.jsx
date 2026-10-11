import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Pencil, Trash2, Trophy } from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'
import { Esqueleto, EstadoVacio, EstadoError } from '../components/EstadoVista'
import api from '../services/api'
import Convocatoria from '../components/Convocatoria'
import CamposAgenda, { AGENDA_VACIA, agendaDe, resumenAgenda, useEquiposAsignables } from '../components/CamposAgenda'
import { useAuth } from '../context/AuthContext'

const EMPTY = { fecha: '', rival: '', tipo: 'liga', resultado: '', ...AGENDA_VACIA }

export default function Partidos() {
  const { tienePermiso } = useAuth()
  const puedeEditar = tienePermiso(['administrador', 'entrenador'])

  const [partidos, setPartidos] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [modal, setModal]       = useState(false)
  const [form, setForm]         = useState(EMPTY)
  const [editId, setEditId]     = useState(null)
  const [saving, setSaving]     = useState(false)
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null, loading: false })
  const [convocatoriaDe, setConvocatoriaDe] = useState(null)
  const equipos = useEquiposAsignables(puedeEditar)
  const [params, setParams] = useSearchParams()

  const load = () => {
    setLoading(true)
    setError(null)
    api.get('/partidos')
      .then(r => setPartidos(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  // Un aviso lleva a /partidos?convocatoria=ID: se abre esa convocatoria cuando llegan los partidos
  useEffect(() => {
    const id = Number(params.get('convocatoria'))
    if (!id || !partidos.length) return
    const p = partidos.find(x => x.id === id)
    if (p) setConvocatoriaDe(p)
    params.delete('convocatoria')
    setParams(params, { replace: true })
  }, [params, partidos])

  const openCreate = () => { setForm(EMPTY); setEditId(null); setModal(true) }
  const openEdit   = (p) => {
    setForm({ fecha: p.fecha?.slice(0,10) || '', rival: p.rival, tipo: p.tipo, resultado: p.resultado || '', ...agendaDe(p) })
    setEditId(p.id); setModal(true)
  }
  const closeModal   = () => setModal(false)
  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async () => {
    if (!form.fecha || !form.rival || !form.tipo) return toast.error('Fecha, rival y tipo son obligatorios')
    setSaving(true)
    try {
      if (editId) {
        await api.put(`/partidos/${editId}`, form)
        toast.success('Partido actualizado')
      } else {
        await api.post('/partidos', form)
        toast.success('Partido registrado')
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
      await api.delete(`/partidos/${deleteModal.id}`)
      toast.success('Partido eliminado')
      setDeleteModal({ isOpen: false, id: null, loading: false })
      load()
    } catch (e) {
      toast.error(e.response?.data?.error || e.message)
      setDeleteModal(prev => ({ ...prev, loading: false }))
    }
  }

  const resultadoColor = (res) => {
    if (!res) return 'var(--text-muted)'
    const [g, r] = res.split('-').map(Number)
    if (g > r) return 'var(--success)'
    if (g < r) return 'var(--danger)'
    return 'var(--warning)'
  }

  return (
    <div>
      <div className="page-header">
        <h2>Partidos</h2>
        <p>Historial de liga y amistosos</p>
      </div>

      <div className="page-toolbar">
        <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          {!loading && !error && <>
            <Trophy size={15} style={{ display: 'inline', marginRight: 6 }} />
            {partidos.length} partidos · {partidos.filter(p => p.tipo === 'liga').length} de liga
          </>}
        </span>
        {puedeEditar && (
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} /> Registrar Partido
          </button>
        )}
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? <Esqueleto tipo="tabla" columnas={puedeEditar ? 5 : 4} /> : error ? (
          <EstadoError mensaje={error} onReintentar={load} />
        ) : partidos.length === 0 ? (
          <EstadoVacio
            icono="fa-trophy"
            titulo="Aún no hay partidos registrados"
            descripcion={puedeEditar
              ? 'Registra el próximo partido de liga o amistoso: el inicio mostrará la disponibilidad del plantel para ese día.'
              : 'Cuando un entrenador registre un partido, aparecerá aquí.'}
            accion={puedeEditar ? { texto: 'Registrar partido', icono: 'fa-plus', onClick: openCreate } : null}
          />
        ) : (
          <div className="table-wrapper" tabIndex={0} role="region" aria-label="Partidos registrados">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Rival</th>
                  <th>Tipo</th>
                  <th>Resultado</th>
                  <th>Convocatoria</th>
                  {puedeEditar && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {partidos.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{new Date(p.fecha).toLocaleDateString('es', { day:'2-digit', month:'short', year:'numeric' })}</td>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{p.rival}<span className="sub-agenda">{resumenAgenda(p)}</span></td>
                    <td>
                      <span className={`badge ${p.tipo === 'liga' ? 'badge-green' : 'badge-orange'}`}>{p.tipo}</span>
                    </td>
                    <td style={{ fontWeight: 700, fontSize: 16, color: resultadoColor(p.resultado) }}>
                      {p.resultado || <span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 400 }}>Pendiente</span>}
                    </td>
                    <td>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConvocatoriaDe(p)} aria-label={`Convocatoria contra ${p.rival}`}>
                        <i className="fa-solid fa-clipboard-list" aria-hidden="true"></i> Ver
                      </button>
                    </td>
                    {puedeEditar && (
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>
                            <Pencil size={13} /> Editar
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)} aria-label={`Eliminar el partido contra ${p.rival}`} title="Eliminar">
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
          title={editId ? 'Editar Partido' : 'Registrar Partido'}
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
              <label>Fecha *</label>
              <input name="fecha" type="date" value={form.fecha} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Tipo *</label>
              <select name="tipo" value={form.tipo} onChange={handleChange}>
                <option value="liga">Liga</option>
                <option value="amistoso">Amistoso</option>
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Rival *</label>
              <input name="rival" value={form.rival} onChange={handleChange} placeholder="Nombre del equipo rival" />
            </div>
            <CamposAgenda form={form} onChange={handleChange} equipos={equipos} lugarEjemplo="Ej. Estadio General Santander" />
            <div className="form-group">
              <label>Resultado (ej: 2-1)</label>
              <input name="resultado" value={form.resultado} onChange={handleChange} placeholder="Dejar vacío si aún no se jugó" />
            </div>
          </div>
        </Modal>
      )}

      {/* Modal de confirmación para eliminar partido */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        title="¿Eliminar partido?"
        message="¿Estás seguro de que deseas eliminar este partido del registro? Esta acción no se puede deshacer."
        confirmText="Sí, Eliminar"
        cancelText="Cancelar"
        confirmVariant="danger"
        loading={deleteModal.loading}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModal({ isOpen: false, id: null, loading: false })}
      />
      {convocatoriaDe && <Convocatoria partido={convocatoriaDe} onCerrar={() => setConvocatoriaDe(null)} />}
    </div>
  )
}

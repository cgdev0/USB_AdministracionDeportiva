import { useState, useEffect, useRef } from 'react'
import { Users, Plus, Upload, Edit2, Trash2, RefreshCw, X, Check, KeyRound } from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import ConfirmModal from '../components/ConfirmModal'
import Modal from '../components/Modal'
import { Esqueleto, EstadoVacio, EstadoSinResultados, EstadoError } from '../components/EstadoVista'

const ROLES = ['administrador', 'head_coach', 'entrenador', 'personal_salud', 'jugador']
const ROLE_LABELS = {
  administrador: 'Administrador',
  head_coach: 'Head Coach',
  entrenador: 'Entrenador',
  personal_salud: 'Personal Salud',
  jugador: 'Jugador',
}
const ROLE_COLORS = {
  administrador: '#B52B27',
  head_coach: '#6A3F9E',
  entrenador: '#107233',
  personal_salud: '#31708F',
  jugador: '#8A5A06',
}

export default function Usuarios() {
  const { usuario: yo } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [csvOpen, setCsvOpen] = useState(false)
  const [editando, setEditando] = useState(null)
  const [filtroRol, setFiltroRol] = useState('todos')
  const csvRef = useRef()

  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'jugador', head_coach_id: '' })
  const [csvResultado, setCsvResultado] = useState(null)
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, usuario: null, loading: false })
  const [resetModal, setResetModal] = useState({ isOpen: false, usuario: null, newPassword: '', loading: false })

  const cargar = async () => {
    setCargando(true)
    setError(null)
    try {
      const { data } = await api.get('/usuarios')
      setUsuarios(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const abrirCrear = () => {
    setEditando(null)
    setForm({ nombre: '', email: '', password: '', rol: 'jugador', head_coach_id: '' })
    setModalOpen(true)
  }

  const abrirEditar = (u) => {
    setEditando(u)
    setForm({ nombre: u.nombre, email: u.email, password: '', rol: u.rol, head_coach_id: u.head_coach_id || '' })
    setModalOpen(true)
  }

  const guardar = async (e) => {
    e.preventDefault()
    try {
      if (editando) {
        await api.put(`/usuarios/${editando.id}`, { nombre: form.nombre, email: form.email, rol: form.rol, head_coach_id: form.head_coach_id || null, activo: editando.activo })
        toast.success('Usuario actualizado')
      } else {
        await api.post('/usuarios', form)
        toast.success('Usuario creado')
      }
      setModalOpen(false)
      cargar()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const abrirResetPassword = (u) => {
    setResetModal({ isOpen: true, usuario: u, newPassword: '', loading: false })
  }

  const handleConfirmReset = async (e) => {
    e?.preventDefault()
    if (!resetModal.newPassword || resetModal.newPassword.length < 6) {
      return toast.error('La contraseña debe tener al menos 6 caracteres')
    }
    setResetModal(prev => ({ ...prev, loading: true }))
    try {
      await api.put(`/usuarios/${resetModal.usuario.id}/reset`, { password: resetModal.newPassword })
      toast.success(`Contraseña de ${resetModal.usuario.nombre} restablecida`)
      setResetModal({ isOpen: false, usuario: null, newPassword: '', loading: false })
    } catch (err) {
      toast.error(err.response?.data?.error || err.message)
      setResetModal(prev => ({ ...prev, loading: false }))
    }
  }

  const desactivar = (u) => {
    setDeleteModal({ isOpen: true, usuario: u, loading: false })
  }

  const handleConfirmDesactivar = async () => {
    if (!deleteModal.usuario) return
    setDeleteModal(prev => ({ ...prev, loading: true }))
    try {
      await api.delete(`/usuarios/${deleteModal.usuario.id}`)
      toast.success('Usuario desactivado')
      setDeleteModal({ isOpen: false, usuario: null, loading: false })
      cargar()
    } catch (err) {
      toast.error(err.response?.data?.error || err.message)
      setDeleteModal(prev => ({ ...prev, loading: false }))
    }
  }

  const subirCSV = async (e) => {
    e.preventDefault()
    const archivo = csvRef.current?.files[0]
    if (!archivo) return toast.error('Selecciona un archivo CSV')
    const fd = new FormData()
    fd.append('archivo', archivo)
    try {
      const { data } = await api.post('/usuarios/csv', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setCsvResultado(data)
      cargar()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const rolesDisponibles = yo?.rol === 'entrenador'
    ? ['jugador', 'personal_salud']
    : ROLES

  const usuariosFiltrados = filtroRol === 'todos'
    ? usuarios
    : usuarios.filter(u => u.rol === filtroRol)

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title">
          <Users size={24} />
          <h2>Gestión de Usuarios</h2>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-secondary" onClick={() => setCsvOpen(true)}>
            <Upload size={16} /> Cargar CSV
          </button>
          <button className="btn-primary" onClick={abrirCrear}>
            <Plus size={16} /> Nuevo Usuario
          </button>
        </div>
      </div>

      {/* Filtro por rol */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {['todos', ...ROLES].map(r => (
          <button
            key={r}
            type="button"
            className="chip-filtro"
            aria-pressed={filtroRol === r}
            onClick={() => setFiltroRol(r)}
          >
            {r === 'todos' ? 'Todos' : ROLE_LABELS[r]}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="table-container">
        {cargando ? (
          <Esqueleto tipo="tabla" columnas={6} filas={6} etiqueta="Cargando usuarios…" />
        ) : error ? (
          <EstadoError mensaje={error} onReintentar={cargar} />
        ) : usuarios.length === 0 ? (
          <EstadoVacio icono="fa-user-gear" titulo="Aún no hay usuarios" descripcion="Crea el primer usuario o importa varios desde un archivo CSV." />
        ) : usuariosFiltrados.length === 0 ? (
          <EstadoSinResultados
            descripcion={`No hay usuarios con el rol ${ROLE_LABELS[filtroRol] || filtroRol}.`}
            onLimpiar={() => setFiltroRol('todos')}
            textoLimpiar="Ver todos los roles"
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Primer Login</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuariosFiltrados.map(u => (
                <tr key={u.id} style={{ opacity: u.activo ? 1 : 0.5 }}>
                  <td><strong>{u.nombre}</strong></td>
                  <td>{u.email}</td>
                  <td>
                    <span style={{
                      background: ROLE_COLORS[u.rol] + '22',
                      color: ROLE_COLORS[u.rol],
                      padding: '0.2rem 0.6rem',
                      borderRadius: '12px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                    }}>
                      {ROLE_LABELS[u.rol]}
                    </span>
                  </td>
                  <td>
                    <span style={{ color: u.activo ? 'var(--ok-texto)' : 'var(--error-texto)' }}>
                      {u.activo ? <Check size={16} /> : <X size={16} />}
                    </span>
                  </td>
                  <td>{u.primer_login
                    ? <span className="badge badge-orange"><i className="fa-solid fa-clock" aria-hidden="true" /> Pendiente</span>
                    : <span className="badge badge-green"><i className="fa-solid fa-check" aria-hidden="true" /> Completado</span>}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button className="btn-icon" onClick={() => abrirEditar(u)} title="Editar">
                        <Edit2 size={15} />
                      </button>
                      <button className="btn-icon" onClick={() => abrirResetPassword(u)} title="Restablecer contraseña">
                        <RefreshCw size={15} />
                      </button>
                      {yo?.rol === 'administrador' && u.id !== yo.id && (
                        <button className="btn-icon btn-danger" onClick={() => desactivar(u)} title="Desactivar">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal crear/editar */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editando ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
              <button className="btn-icon" onClick={() => setModalOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={guardar} className="modal-form">
              <div className="form-group">
                <label>Nombre completo</label>
                <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
              </div>
              {!editando && (
                <div className="form-group">
                  <label>Contraseña</label>
                  <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required minLength={6} />
                </div>
              )}
              <div className="form-group">
                <label>Rol</label>
                <select value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}>
                  {rolesDisponibles.map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              {form.rol === 'entrenador' && <div className="form-group"><label>Head Coach asociado (opcional)</label><select value={form.head_coach_id} onChange={e => setForm(f => ({...f, head_coach_id:e.target.value}))}><option value="">Sin asociación</option>{usuarios.filter(u=>u.rol==='head_coach' && (!editando || u.id!==editando.id)).map(u=><option key={u.id} value={u.id}>{u.nombre}</option>)}</select></div>}
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">{editando ? 'Guardar' : 'Crear'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal CSV */}
      {csvOpen && (
        <div className="modal-overlay" onClick={() => { setCsvOpen(false); setCsvResultado(null) }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Carga Masiva de Usuarios (CSV)</h3>
              <button className="btn-icon" onClick={() => { setCsvOpen(false); setCsvResultado(null) }}><X size={18} /></button>
            </div>
            <div className="modal-form">
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                El CSV debe tener las columnas: <code>nombre, email, password, rol</code>
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Roles válidos: {rolesDisponibles.join(', ')}
              </p>
              {!csvResultado ? (
                <form onSubmit={subirCSV}>
                  <div className="form-group">
                    <label>Archivo CSV</label>
                    <input type="file" accept=".csv" ref={csvRef} />
                  </div>
                  <div className="modal-actions">
                    <button type="button" className="btn-secondary" onClick={() => setCsvOpen(false)}>Cancelar</button>
                    <button type="submit" className="btn-primary"><Upload size={16} /> Procesar</button>
                  </div>
                </form>
              ) : (
                <div>
                  <p style={{ color: 'var(--ok-texto)' }}><i className="fa-solid fa-circle-check" aria-hidden="true" /> Usuarios creados: <strong>{csvResultado.creados}</strong></p>
                  {csvResultado.errores.length > 0 && (
                    <>
                      <p style={{ color: 'var(--error-texto)' }}><i className="fa-solid fa-circle-xmark" aria-hidden="true" /> Errores: {csvResultado.errores.length}</p>
                      <ul style={{ fontSize: '0.85rem', color: 'var(--error-texto)' }}>
                        {csvResultado.errores.map((e, i) => (
                          <li key={i}>Fila {e.fila}: {e.error}</li>
                        ))}
                      </ul>
                    </>
                  )}
                  <button className="btn-primary" style={{ marginTop: '1rem' }} onClick={() => { setCsvOpen(false); setCsvResultado(null) }}>
                    Cerrar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Reset de Contraseña */}
      {resetModal.isOpen && (
        <Modal
          title={`Restablecer Contraseña: ${resetModal.usuario?.nombre}`}
          onClose={() => setResetModal({ isOpen: false, usuario: null, newPassword: '', loading: false })}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setResetModal({ isOpen: false, usuario: null, newPassword: '', loading: false })}
                disabled={resetModal.loading}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmReset}
                disabled={resetModal.loading || !resetModal.newPassword}
              >
                {resetModal.loading ? 'Guardando...' : 'Guardar Nueva Contraseña'}
              </button>
            </>
          }
        >
          <div className="form-group">
            <label>Nueva Contraseña *</label>
            <input
              type="password"
              value={resetModal.newPassword}
              onChange={e => setResetModal(prev => ({ ...prev, newPassword: e.target.value }))}
              placeholder="Mínimo 6 caracteres"
              autoFocus
            />
          </div>
        </Modal>
      )}

      {/* Modal de confirmación para desactivar usuario */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        title="¿Desactivar usuario?"
        message={`¿Estás seguro de que deseas desactivar al usuario "${deleteModal.usuario?.nombre}" (${deleteModal.usuario?.email})? El usuario no podrá iniciar sesión.`}
        confirmText="Sí, Desactivar"
        cancelText="Cancelar"
        confirmVariant="danger"
        loading={deleteModal.loading}
        onConfirm={handleConfirmDesactivar}
        onCancel={() => setDeleteModal({ isOpen: false, usuario: null, loading: false })}
      />
    </div>
  )
}

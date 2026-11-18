import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// `estricto` (v2.7, T0.7): en los módulos clínicos (Salud, Antropometría) el administrador no tiene el pase libre
// que tiene en el resto: no es parte del equipo de salud (Res. 1995 de 1999, art. 14).
export default function ProtectedRoute({ children, roles, estricto = false }) {
  const { usuario, cargando } = useAuth()

  if (cargando) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="spinner" />
      </div>
    )
  }

  if (!usuario) return <Navigate to="/login" replace />

  const pasaLibre = usuario.rol === 'administrador' && !estricto
  if (roles && roles.length > 0 && !roles.includes(usuario.rol) && !pasaLibre) {
    return <Navigate to="/" replace />
  }

  return children
}

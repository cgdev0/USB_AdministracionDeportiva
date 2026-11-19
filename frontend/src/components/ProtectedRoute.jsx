import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AceptarAviso from './AceptarAviso'

// `estricto` (v2.7, T0.7): en los módulos clínicos (Salud, Antropometría) el administrador no tiene el pase libre
// que tiene en el resto: no es parte del equipo de salud (Res. 1995 de 1999, art. 14).
// v2.9 (T2.5): mientras falte aceptar el aviso de manejo de datos, en lugar de la página se muestra el aviso.
export default function ProtectedRoute({ children, roles, estricto = false }) {
  const { usuario, cargando, aviso, avisoListo } = useAuth()

  if (cargando || (usuario && !avisoListo)) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="spinner" />
      </div>
    )
  }

  if (!usuario) return <Navigate to="/login" replace />
  if (aviso) return <AceptarAviso />

  const pasaLibre = usuario.rol === 'administrador' && !estricto
  if (roles && roles.length > 0 && !roles.includes(usuario.rol) && !pasaLibre) {
    return <Navigate to="/" replace />
  }

  return children
}

import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { DeporteProvider } from './context/DeporteContext'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/Estructura'
import { MODULOS } from './config/navegacion'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Equipos from './pages/Equipos'
import Jugadores from './pages/Jugadores'
import Entrenamientos from './pages/Entrenamientos'
import Asistencia from './pages/Asistencia'
import Lesiones from './pages/Lesiones'
import Evaluaciones from './pages/Evaluaciones'
import Partidos from './pages/Partidos'
import EstadisticasJugador from './pages/EstadisticasJugador'
import Antropometria from './pages/Antropometria'
import Usuarios from './pages/Usuarios'
import HeadCoach from './pages/HeadCoach'
import Salud from './pages/Salud'

// Cada ruta usa los roles definidos en config/navegacion.js: el menú y el acceso
// a las páginas salen de la misma fuente y no pueden contradecirse.
const PAGINAS = {
  '/': Dashboard,
  '/head-coach': HeadCoach,
  '/equipos': Equipos,
  '/jugadores': Jugadores,
  '/entrenamientos': Entrenamientos,
  '/asistencia': Asistencia,
  '/partidos': Partidos,
  '/estadisticas': EstadisticasJugador,
  '/lesiones': Lesiones,
  '/salud': Salud,
  '/evaluaciones': Evaluaciones,
  '/antropometria': Antropometria,
  '/usuarios': Usuarios,
}

export default function App() {
  return (
    <AuthProvider>
      <DeporteProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          {MODULOS.map(({ ruta, roles }) => {
            const Pagina = PAGINAS[ruta]
            return (
              <Route key={ruta} path={ruta} element={
                <ProtectedRoute roles={roles}>
                  <AppLayout><Pagina /></AppLayout>
                </ProtectedRoute>
              } />
            )
          })}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </DeporteProvider>
    </AuthProvider>
  )
}

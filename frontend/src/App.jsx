import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { DeporteProvider } from './context/DeporteContext'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/Estructura'
import { MODULOS } from './config/navegacion'
import Login from './pages/Login'
import LimiteCarga from './components/LimiteCarga'
import { PAGINAS, SUBPAGINAS } from './config/paginas'

// v2.8 (T1.1): catálogo de componentes clínicos, solo en la compilación de pruebas (VITE_CATALOGO=1).
// En Railway la variable no existe: Vite elimina esta ruta y su código del paquete.
const CatalogoClinico = import.meta.env.VITE_CATALOGO === '1' ? lazy(() => import('./pages/CatalogoClinico')) : null

// Cada ruta usa los roles definidos en config/navegacion.js: el menú y el acceso
// a las páginas salen de la misma fuente y no pueden contradecirse.
// Las páginas se cargan por partes (config/paginas.js).

export default function App() {
  return (
    <AuthProvider>
      <DeporteProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          {CatalogoClinico && <Route path="/catalogo-clinico" element={<Suspense fallback={null}><CatalogoClinico /></Suspense>} />}
          {MODULOS.map(({ ruta, roles, clinico }) => {
            const Pagina = PAGINAS[ruta]
            return (
              <Route key={ruta} path={ruta} element={
                <ProtectedRoute roles={roles} estricto={clinico}>
                  <AppLayout><LimiteCarga key={ruta}><Pagina /></LimiteCarga></AppLayout>
                </ProtectedRoute>
              } />
            )
          })}
          {SUBPAGINAS.map(({ ruta, modulo, Pagina }) => {
            const { roles, clinico } = MODULOS.find(m => m.ruta === modulo)
            return (
              <Route key={ruta} path={ruta} element={
                <ProtectedRoute roles={roles} estricto={clinico}>
                  <AppLayout><LimiteCarga key={ruta}><Pagina /></LimiteCarga></AppLayout>
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

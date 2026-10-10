import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

const CUENTAS_DEMO = [
  ['Administrador', 'admin@dtdeportivo.com', 'Admin123!'],
  ['Head coach', 'headcoach@dtdeportivo.com', 'HeadCoach123!'],
  ['Entrenador', 'entrenador@dtdeportivo.com', 'Coach123!'],
  ['Personal de salud', 'salud@dtdeportivo.com', 'Salud123!'],
  ['Deportista', 'jugador@dtdeportivo.com', 'Jugador123!'],
]

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [cargando, setCargando] = useState(false)
  const [verClave, setVerClave] = useState(false)
  const [error, setError] = useState('')

  const cambiar = (campo) => (e) => { setForm(f => ({ ...f, [campo]: e.target.value })); setError('') }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email.trim() || !form.password) {
      setError('Escribe tu usuario o correo y tu contraseña.')
      return
    }
    setCargando(true)
    try {
      const usuario = await login(form.email, form.password)
      toast.success(`Bienvenido, ${usuario.nombre}`)
      navigate('/')
    } catch (err) {
      setError(err.status === 401
        ? 'El usuario o la contraseña no coinciden. Revisa los datos e intenta de nuevo.'
        : err.message || 'No se pudo iniciar sesión. Intenta de nuevo en unos minutos.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="login-escena">
      <div className="login-tarjeta">
        <header className="login-banner">
          <img src="/brand/logo-horizontal-blanco.png" alt="Universidad Simón Bolívar" />
          <span className="login-sistema">ADMINISTRACIÓN DEPORTIVA</span>
        </header>
        <div className="franja" role="presentation"></div>

        <main className="login-cuerpo">
          <h1>Iniciar sesión</h1>

          {error && (
            <div className="alerta alerta-error" role="alert">
              <i className="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="email">Usuario o correo</label>
              <div className="login-control">
                <input id="email" type="text" value={form.email} onChange={cambiar('email')}
                  autoComplete="username" autoFocus aria-invalid={error ? 'true' : undefined} />
                <span className="login-icono" aria-hidden="true"><i className="fa-solid fa-user"></i></span>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">Contraseña</label>
              <div className="login-control">
                <input id="password" type={verClave ? 'text' : 'password'} value={form.password} onChange={cambiar('password')}
                  autoComplete="current-password" aria-invalid={error ? 'true' : undefined} />
                <button type="button" className="login-icono" onClick={() => setVerClave(v => !v)}
                  aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                  <i className={verClave ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'} aria-hidden="true"></i>
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-bloque login-boton" disabled={cargando}>
              <i className="fa-solid fa-right-to-bracket" aria-hidden="true"></i>
              {cargando ? 'Iniciando sesión…' : 'Iniciar sesión'}
            </button>
          </form>

          <p className="login-ayuda">¿Olvidaste tu contraseña? Pídele al administrador del club que la restablezca.</p>

          {import.meta.env.DEV && (
            <details className="login-demo">
              <summary>Accesos de demostración (solo en modo local)</summary>
              <p>Cargan los datos en el formulario. Funcionan sin backend para revisar la interfaz de cada rol.</p>
              <ul>
                {CUENTAS_DEMO.map(([rol, email, password]) => (
                  <li key={rol}>
                    <button type="button" onClick={() => { setForm({ email, password }); setError('') }}>
                      <b>{rol}</b><span>{email}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </main>

        <footer className="pie">
          <div className="login-pie">
            <img className="pie-logo" src="/brand/logo-apilado-blanco.png" alt="Universidad Simón Bolívar, Barranquilla y Cúcuta, Colombia. Vigilada MinEducación" />
            <div>
              <h3>Administración Deportiva</h3>
              <p>Plantel, entrenamientos, salud y rendimiento de los equipos deportivos de la sede Cúcuta. Uso interno.</p>
            </div>
            <div>
              <h3>Portales</h3>
              <ul>
                <li><a href="https://www.unisimon.edu.co" target="_blank" rel="noreferrer">Unisimón</a></li>
                <li><a href="https://cucuta.unisimon.edu.co/estudiante/" target="_blank" rel="noreferrer">Portal Estudiante</a></li>
              </ul>
            </div>
          </div>
          <div className="pie-final">Todos los derechos reservados © Universidad Simón Bolívar - {new Date().getFullYear()}</div>
        </footer>
      </div>
    </div>
  )
}

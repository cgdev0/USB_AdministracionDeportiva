import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function Login() {
  const { login } = useAuth()
  const navigate  = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [cargando, setCargando] = useState(false)
  const [showPass, setShowPass] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) return toast.error('Completa todos los campos')
    setCargando(true)
    try {
      const usuario = await login(form.email, form.password)
      toast.success(`Bienvenido, ${usuario.nombre}`)
      navigate('/')
    } catch (err) {
      toast.error(err.message || 'Credenciales inválidas')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">⚽</div>
          <h1>DTdeportivo</h1>
          <p>Sistema de Gestión Deportiva</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Usuario o correo electrónico</label>
            <input
              id="email"
              type="text"
              placeholder="Usuario o correo electrónico"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              autoComplete="username"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <div className="password-wrapper">
              <input
                id="password"
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="toggle-pass"
                onClick={() => setShowPass(v => !v)}
                tabIndex={-1}
              >
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button type="submit" className="btn-login" disabled={cargando}>
            {cargando ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        {import.meta.env.DEV && (
          <div style={{ marginTop: 18, padding: 14, borderRadius: 10, background: 'var(--bg-secondary, #f4f6f8)', fontSize: 12 }}>
            <strong>Accesos de demostración (modo local)</strong>
            <p style={{ margin: '6px 0 10px', color: 'var(--text-muted, #667085)' }}>Sirven para revisar la interfaz de cada rol mientras se conecta el backend.</p>
            {[['Administrador','admin@dtdeportivo.com','Admin123!'],['Head Coach','headcoach@dtdeportivo.com','HeadCoach123!'],['Entrenador','entrenador@dtdeportivo.com','Coach123!'],['Personal de salud','salud@dtdeportivo.com','Salud123!'],['Deportista','jugador@dtdeportivo.com','Jugador123!']].map(([rol, email, password]) => (
              <button key={rol} type="button" onClick={() => setForm({ email, password })} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 0', border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--text, inherit)' }}>
                <strong>{rol}:</strong> {email} <span style={{ opacity: .7 }}>· clic para cargar</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

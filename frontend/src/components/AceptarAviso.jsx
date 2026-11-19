// Aceptar el aviso de manejo de datos antes de entrar (v2.9, T2.5 del plan de historia clínica; D9 y D10).
// Lo ve todo el personal (su compromiso de confidencialidad) y el deportista en su cuenta (el aviso de privacidad)
// la primera vez que entra o cuando cambia el texto. Sin aceptarlo solo puede salir; la API tampoco le entrega datos.
// El texto viene del servidor: es el mismo cuya huella queda guardada con la aceptación.
import { useId, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { ROLES } from '../config/navegacion'
import { partesAviso } from '../utils/avisos'

function Texto({ children }) {
  return partesAviso(children).map((p, i) => (p.completar ? <mark key={i} className="aviso-completar">{p.texto}</mark> : <span key={i}>{p.texto}</span>))
}

export default function AceptarAviso() {
  const { usuario, aviso, aceptarAviso, logout } = useAuth()
  const navegar = useNavigate()
  const [marcado, setMarcado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const idCasilla = useId()
  const idTitulo = useId()

  const aceptar = async () => {
    if (!marcado || enviando) return
    setEnviando(true)
    setError(null)
    try {
      await aceptarAviso()
      toast.success('Gracias. Ya puedes continuar.')
    } catch (e) {
      setError(e.message)
      // El texto cambió mientras se leía: se trae el nuevo y hay que marcar de nuevo
      if (e.status === 409) { setMarcado(false); window.dispatchEvent(new CustomEvent('dt:aceptacion-pendiente')) }
    } finally {
      setEnviando(false)
    }
  }
  const salir = () => { logout(); navegar('/login', { replace: true }) }

  return (
    <main className="aviso-pagina" aria-labelledby={idTitulo}>
      <article className="aviso-hoja">
        <header className="aviso-cabecera">
          <img src="/brand/logo-horizontal-verde.png" alt="Universidad Simón Bolívar" />
          <p className="aviso-antes">Antes de continuar · {usuario?.nombre} · {ROLES[usuario?.rol] || usuario?.rol}</p>
          <h1 id={idTitulo}>{aviso.titulo}</h1>
          {aviso.intro && <p className="aviso-intro">{aviso.intro}</p>}
          {String(aviso.version).startsWith('borrador') && (
            <p className="aviso-borrador">Texto en revisión por el docente de salud y la universidad (versión {aviso.version}).</p>
          )}
        </header>
        <div className="aviso-cuerpo">
          {aviso.secciones.map(([titulo, texto]) => (
            <section key={titulo}>
              <h2>{titulo}</h2>
              <p><Texto>{texto}</Texto></p>
            </section>
          ))}
        </div>
        <div className="aviso-acciones">
          <label className="aviso-casilla" htmlFor={idCasilla}>
            <input id={idCasilla} type="checkbox" checked={marcado} onChange={e => setMarcado(e.target.checked)} />
            <span>{aviso.casilla}</span>
          </label>
          {error && <p className="alerta alerta-error" role="alert"><i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> {error}</p>}
          <div className="aviso-botones">
            <button type="button" className="btn btn-ghost" onClick={salir}>Salir</button>
            <button type="button" className="btn btn-primary" onClick={aceptar} disabled={!marcado || enviando}>
              <i className="fa-solid fa-check" aria-hidden="true"></i> {enviando ? 'Guardando…' : 'Aceptar y continuar'}
            </button>
          </div>
        </div>
      </article>
    </main>
  )
}

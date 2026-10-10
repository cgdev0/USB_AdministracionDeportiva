import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useDeporte } from '../context/DeporteContext'
import { MENU_INFERIOR, ROLES, iniciales, modulosDelRol } from '../config/navegacion'

const claseActiva = ({ isActive }) => (isActive ? 'activo' : undefined)

function SelectorDeporte({ id }) {
  const { disciplinas, selectedSportId, setSelectedSportId } = useDeporte()
  return (
    <label className="selector-deporte" htmlFor={id}>
      <i className="fa-solid fa-medal" aria-hidden="true"></i>
      <span>Deporte</span>
      <select id={id} value={selectedSportId || 'todos'} onChange={e => setSelectedSportId(e.target.value)}>
        <option value="todos">Todos los deportes</option>
        {disciplinas.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
      </select>
    </label>
  )
}

function Cabecera() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()
  const salir = () => { logout(); navigate('/login') }
  return (
    <header className="cabecera">
      <div className="cabecera-in">
        <img className="cabecera-logo" src="/brand/logo-horizontal-verde.png" alt="Universidad Simón Bolívar" />
        <span className="cabecera-separador" aria-hidden="true"></span>
        <span className="cabecera-sistema">ADMINISTRACIÓN<br /> DEPORTIVA</span>
        <SelectorDeporte id="deporte-pc" />
        <span className="cabecera-bienvenida">Bienvenido</span>
        <div className="cabecera-foto" aria-hidden="true">{iniciales(usuario?.nombre)}</div>
        <span className="cabecera-nombre">
          {usuario?.nombre}
          <small>{ROLES[usuario?.rol] || usuario?.rol}</small>
        </span>
        <button className="cabecera-salir" type="button" onClick={salir} title="Cerrar sesión" aria-label="Cerrar sesión">
          <i className="fa-solid fa-right-from-bracket" aria-hidden="true"></i>
        </button>
      </div>
    </header>
  )
}

function Pestanas() {
  const { usuario } = useAuth()
  const modulos = modulosDelRol(usuario?.rol)
  return (
    <nav className="pestanas" aria-label="Menú principal">
      <div className="pestanas-in">
        <ul>
          {modulos.map(m => (
            <li key={m.ruta}>
              <NavLink to={m.ruta} end={m.ruta === '/'} className={claseActiva}>{m.etiqueta}</NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}

function MenuInferior() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [hojaAbierta, setHojaAbierta] = useState(false)

  const modulos = modulosDelRol(usuario?.rol)
  const fijas = (MENU_INFERIOR[usuario?.rol] || ['/']).map(r => modulos.find(m => m.ruta === r)).filter(Boolean)
  const resto = modulos.filter(m => !fijas.includes(m))
  const enResto = resto.some(m => (m.ruta === '/' ? pathname === '/' : pathname.startsWith(m.ruta)))

  useEffect(() => { setHojaAbierta(false) }, [pathname])
  useEffect(() => {
    if (!hojaAbierta) return
    const cerrar = (e) => { if (e.key === 'Escape') setHojaAbierta(false) }
    window.addEventListener('keydown', cerrar)
    return () => window.removeEventListener('keydown', cerrar)
  }, [hojaAbierta])

  return (
    <>
      <nav className="menu-inferior" aria-label="Menú principal">
        {fijas.map(m => (
          <NavLink key={m.ruta} to={m.ruta} end={m.ruta === '/'} className={claseActiva}>
            <i className={m.icono} aria-hidden="true"></i>{m.corto}
          </NavLink>
        ))}
        <button type="button" className={enResto || hojaAbierta ? 'activo' : undefined}
          aria-expanded={hojaAbierta} aria-controls="hoja-mas" onClick={() => setHojaAbierta(v => !v)}>
          <i className="fa-solid fa-bars" aria-hidden="true"></i>Más
        </button>
      </nav>

      {hojaAbierta && (
        <>
          <div className="hoja-fondo" onClick={() => setHojaAbierta(false)} aria-hidden="true"></div>
          <div className="hoja" id="hoja-mas" role="dialog" aria-modal="true" aria-label="Más opciones">
            <div className="hoja-agarre" aria-hidden="true"></div>
            {resto.length > 0 && (
              <>
                <h2>Módulos</h2>
                <ul className="hoja-lista">
                  {resto.map(m => (
                    <li key={m.ruta}>
                      <NavLink to={m.ruta} end={m.ruta === '/'} className={claseActiva}>
                        <i className={m.icono} aria-hidden="true"></i>{m.etiqueta}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="hoja-seccion">
              <SelectorDeporte id="deporte-movil" />
              <p style={{ fontSize: 14, color: 'var(--texto-suave)' }}>
                {usuario?.nombre}, {(ROLES[usuario?.rol] || usuario?.rol || '').toLowerCase()}
              </p>
              <button className="btn btn-secondary btn-bloque" type="button" onClick={() => { logout(); navigate('/login') }}>
                <i className="fa-solid fa-right-from-bracket" aria-hidden="true"></i> Cerrar sesión
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}

export function Pie() {
  return (
    <footer className="pie">
      <div className="pie-in">
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
  )
}

export default function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <Cabecera />
      <div className="franja" role="presentation"></div>
      <Pestanas />
      <main className="main-content">{children}</main>
      <Pie />
      <MenuInferior />
    </div>
  )
}

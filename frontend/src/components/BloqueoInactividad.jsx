// Bloqueo por inactividad para el personal de salud (v2.7, T0.8 del plan de historia clínica). Ver config/seguridad.js.
// - Un minuto antes avisa ("Sigo aquí"). Al cumplirse el tiempo sin tocar la pantalla, la tapa por completo y pide
//   la contraseña. No recarga nada: al desbloquear, la persona sigue donde iba, con lo que había escrito.
// - Mientras está bloqueada, el resto de la página queda inerte (no se puede usar con teclado ni lectores de pantalla).
// - El bloqueo sobrevive a recargar la página y se comparte entre pestañas del mismo navegador.
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import CampoClave from './CampoClave'
import { BLOQUEO, CLAVE_BLOQUEO, CLAVE_ACTIVIDAD } from '../config/seguridad'

const leer = (clave) => { try { return localStorage.getItem(clave) } catch { return null } }
const escribir = (clave, valor) => { try { valor === null ? localStorage.removeItem(clave) : localStorage.setItem(clave, valor) } catch { /* sin almacenamiento */ } }
const EVENTOS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'input', 'scroll']
const LIMITE_MS = BLOQUEO.minutos * 60 * 1000
const AVISO_MS = LIMITE_MS - BLOQUEO.avisoSegundos * 1000

export default function BloqueoInactividad() {
  const { usuario, logout } = useAuth()
  const aplica = BLOQUEO.roles.includes(usuario?.rol)
  const [bloqueado, setBloqueado] = useState(() => aplica && leer(CLAVE_BLOQUEO) === '1')
  const [aviso, setAviso] = useState(false)
  const [clave, setClave] = useState('')
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const ultima = useRef(Date.now())
  const capa = useRef(null)

  const marcarActividad = useCallback(() => {
    ultima.current = Date.now()
    // Se comparte con otras pestañas, como máximo cada 10 segundos
    const guardada = Number(leer(CLAVE_ACTIVIDAD)) || 0
    if (ultima.current - guardada > 10_000) escribir(CLAVE_ACTIVIDAD, String(ultima.current))
  }, [])

  const bloquear = useCallback(() => {
    escribir(CLAVE_BLOQUEO, '1')
    setAviso(false)
    setBloqueado(true)
  }, [])

  // Si la sesión se conoce después (o cambia), se respeta un bloqueo que ya estaba: recargar no lo quita
  useEffect(() => {
    if (aplica && leer(CLAVE_BLOQUEO) === '1') setBloqueado(true)
    if (!aplica) setBloqueado(false)
  }, [aplica])

  // Actividad y reloj
  useEffect(() => {
    if (!aplica || bloqueado) return undefined
    // Solo marca la actividad: el aviso se quita con el reloj (en menos de 1 s) o con su botón. Si se quitara aquí,
    // el primer contacto del dedo con "Sigo aquí" lo haría desaparecer antes de que el botón recibiera el toque.
    const alActuar = () => marcarActividad()
    EVENTOS.forEach(e => window.addEventListener(e, alActuar, { capture: true, passive: true }))
    const reloj = setInterval(() => {
      const ultimaVez = Math.max(ultima.current, Number(leer(CLAVE_ACTIVIDAD)) || 0)
      const quieto = Date.now() - ultimaVez
      if (quieto >= LIMITE_MS) bloquear()
      else setAviso(quieto >= AVISO_MS)
    }, 1000)
    return () => {
      EVENTOS.forEach(e => window.removeEventListener(e, alActuar, { capture: true }))
      clearInterval(reloj)
    }
  }, [aplica, bloqueado, marcarActividad, bloquear])

  // Otras pestañas: si una se bloquea o se desbloquea, las demás también
  useEffect(() => {
    if (!aplica) return undefined
    const alCambiar = (e) => {
      if (e.key !== CLAVE_BLOQUEO) return
      if (e.newValue === '1') { setAviso(false); setBloqueado(true) }
      else { ultima.current = Date.now(); setBloqueado(false) }
    }
    window.addEventListener('storage', alCambiar)
    return () => window.removeEventListener('storage', alCambiar)
  }, [aplica])

  // Mientras está bloqueada, todo lo demás (página y ventanas abiertas) queda inerte
  useEffect(() => {
    if (!bloqueado) return undefined
    const otros = [...document.body.children].filter(n => n !== capa.current && !n.inert)
    otros.forEach(n => { n.inert = true; n.setAttribute('aria-hidden', 'true') })
    return () => otros.forEach(n => { n.inert = false; n.removeAttribute('aria-hidden') })
  }, [bloqueado])

  if (!aplica) return null

  const desbloquear = async (e) => {
    e.preventDefault()
    if (!clave) return setError('Escribe tu contraseña para continuar.')
    setEnviando(true)
    setError(null)
    try {
      await api.post('/auth/desbloquear', { password: clave })
      escribir(CLAVE_BLOQUEO, null)
      escribir(CLAVE_ACTIVIDAD, String(Date.now()))
      ultima.current = Date.now()
      setClave('')
      setBloqueado(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }
  const salir = () => { escribir(CLAVE_BLOQUEO, null); logout() }

  return createPortal(
    <>
      {aviso && !bloqueado && (
        <div className="aviso-inactividad" role="alertdialog" aria-labelledby="aviso-inactividad-texto">
          <p id="aviso-inactividad-texto"><i className="fa-solid fa-hourglass-half" aria-hidden="true"></i> Por seguridad, la pantalla se bloqueará en 1 minuto si no la usas.</p>
          <button type="button" className="btn btn-primary" onClick={() => { marcarActividad(); setAviso(false) }}>Sigo aquí</button>
        </div>
      )}
      {bloqueado && (
        <div ref={capa} className="bloqueo-inactividad" role="dialog" aria-modal="true" aria-labelledby="bloqueo-titulo">
          <form className="bloqueo-tarjeta" onSubmit={desbloquear}>
            <i className="fa-solid fa-lock bloqueo-icono" aria-hidden="true"></i>
            <h2 id="bloqueo-titulo">Pantalla bloqueada</h2>
            <p>Pasaron {BLOQUEO.minutos} minutos sin uso y la historia clínica quedó protegida. Lo que estabas haciendo sigue aquí.</p>
            <p className="bloqueo-usuario"><strong>{usuario?.nombre}</strong></p>
            <div className="form-group">
              <label htmlFor="bloqueo-clave">Tu contraseña</label>
              <CampoClave id="bloqueo-clave" value={clave} onChange={e => setClave(e.target.value)} autoComplete="current-password" autoFocus />
            </div>
            {error && <p className="alerta alerta-error" role="alert">{error}</p>}
            <button type="submit" className="btn btn-primary" disabled={enviando}>{enviando ? 'Comprobando…' : 'Desbloquear'}</button>
            <button type="button" className="btn btn-ghost" onClick={salir}>No soy yo: cerrar sesión</button>
          </form>
        </div>
      )}
    </>,
    document.body
  )
}

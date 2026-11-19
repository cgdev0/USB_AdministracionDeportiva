// Aceptación del aviso de privacidad por el propio deportista, en el dispositivo del profesional (v2.9, T2.6; D10).
// El profesional entrega el celular o la tableta al deportista, que lee el aviso (en lenguaje sencillo si es menor),
// escribe su nombre y marca que lo acepta. El profesional queda como testigo. Es una de las tres vías de su
// aceptación propia, junto con su cuenta y la autorización de datos firmada en papel.
import { useEffect, useId, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../services/api'
import Modal from './Modal'
import { partesAviso } from '../utils/avisos'

export const FALTA_ACEPTACION = ['falta_propia', 'sin_declaracion']

function Texto({ children }) {
  return partesAviso(children).map((p, i) => (p.completar ? <mark key={i} className="aviso-completar">{p.texto}</mark> : <span key={i}>{p.texto}</span>))
}

export default function AceptacionDeportista({ jugador, onClose, onAceptado }) {
  const [aviso, setAviso] = useState(null)
  const [error, setError] = useState(null)
  const [nombre, setNombre] = useState(jugador.nombre || '')
  const [marcado, setMarcado] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const idNombre = useId()
  const idCasilla = useId()

  useEffect(() => {
    api.get(`/avisos/deportista/${jugador.id}`).then(r => setAviso(r.data.aviso)).catch(e => setError(e.message))
  }, [jugador.id])

  const aceptar = async () => {
    if (guardando || !aviso) return
    if (!nombre.trim()) return setError('Escribe el nombre de quien acepta.')
    if (!marcado) return setError('El deportista debe marcar la casilla para aceptar.')
    setGuardando(true)
    setError(null)
    try {
      await api.post(`/avisos/deportista/${jugador.id}/aceptar`, { version: aviso.version, acepto: true, nombre: nombre.trim() })
      toast.success(`Aceptación de ${jugador.nombre} registrada`)
      onAceptado?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal title={`Aceptación del deportista: ${jugador.nombre}`} onClose={onClose} onEnviar={aceptar}
      footer={<>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn btn-primary" onClick={aceptar} disabled={guardando || !aviso || !marcado}>
          <i className="fa-solid fa-check" aria-hidden="true"></i> {guardando ? 'Guardando…' : 'Registrar aceptación'}
        </button>
      </>}>
      <p className="alerta alerta-info"><i className="fa-solid fa-tablet-screen-button" aria-hidden="true"></i>
        <span>Entrega el dispositivo al deportista para que lea y acepte. Tú quedas registrado como testigo.</span></p>
      {!aviso && !error && <p className="ayuda-campo">Cargando el aviso…</p>}
      {aviso && (
        <article className="aviso-tableta" aria-label={aviso.titulo}>
          <h4>{aviso.titulo}</h4>
          {aviso.intro && <p>{aviso.intro}</p>}
          {aviso.secciones.map(([t, x]) => <p key={t}><strong>{t}. </strong><Texto>{x}</Texto></p>)}
        </article>
      )}
      {aviso && (
        <>
          <div className="form-group">
            <label htmlFor={idNombre}>Nombre de quien acepta *</label>
            <input id={idNombre} value={nombre} maxLength={150} onChange={e => setNombre(e.target.value)} autoComplete="off" />
          </div>
          <label className="declaracion-casilla" htmlFor={idCasilla}>
            <input id={idCasilla} type="checkbox" checked={marcado} onChange={e => setMarcado(e.target.checked)} />
            <span>{aviso.casilla}</span>
          </label>
        </>
      )}
      {error && <p className="alerta alerta-error" role="alert"><i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> {error}</p>}
    </Modal>
  )
}

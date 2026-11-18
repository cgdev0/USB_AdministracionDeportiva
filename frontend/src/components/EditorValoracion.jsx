// Editor del borrador de una valoración (v2.7, T0.3; guardado automático en la v2.8, T1.2 del plan).
// - Se guarda solo cada 20 segundos, al ocultarse la página y al pulsar "Guardar borrador"; el estado se ve arriba
//   ("Guardado hace 5 s", "Sin conexión…"). Sin conexión, lo escrito espera en memoria y se guarda al volver la señal.
// - Si el borrador cambió en otro dispositivo, se avisa y la persona elige: usar la versión guardada o guardar la suya
//   encima. Nunca se pisa en silencio.
// - Al cerrar la ventana con cambios, primero se guardan; si no se puede, pide confirmación antes de perderlos.
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../services/api'
import Modal from './Modal'
import ConfirmModal from './ConfirmModal'
import EstadoGuardado from './clinico/EstadoGuardado'
import usarGuardadoAutomatico from './clinico/usarGuardadoAutomatico'
import { useAuth } from '../context/AuthContext'
import { TIPOS_VALORACION, CAMPOS_ANTECEDENTES, normalizarContenido, contenidoVacio, MENSAJE_VACIA } from '../utils/valoracion'

export const VACIO = { motivo_consulta: '', antecedentes: {}, observaciones: '' }
export const contenidoParaEditar = (contenido = {}) => ({ ...VACIO, ...contenido, antecedentes: { ...(contenido.antecedentes || {}) } })
// Una valoración nueva: inicial si es la primera; los antecedentes se repiten de una a otra, así que se proponen los
// de la última cerrada para revisarlos (regla 8 de la interfaz de salud)
export function borradorNuevo(valoraciones = []) {
  const anterior = (valoraciones || []).find(v => v.estado === 'cerrada' && v.contenido?.antecedentes)
  return { tipo: (valoraciones || []).length ? 'control' : 'inicial', contenido: { ...VACIO, antecedentes: { ...(anterior?.contenido.antecedentes || {}) } }, copiados: !!anterior }
}

export default function EditorValoracion({ inicial, jugadorId, jugadorNombre, onSalir, onCambio, onCerrada }) {
  const { usuario } = useAuth()
  const [ed, setEd] = useState(inicial) // { id?, version?, tipo, contenido, copiados }
  const ref = useRef(ed)
  ref.current = ed
  const [ocupado, setOcupado] = useState(false)
  const [confirmar, setConfirmar] = useState(null) // 'cerrar' | 'descartar'

  // La primera vez crea el borrador; después lo actualiza con su número de versión
  const guardar = async ({ tipo, contenido }) => {
    const c = normalizarContenido(contenido)
    if (!c.ok) { const e = new Error(c.error); e.status = 400; throw e }
    const actual = ref.current
    const { data } = actual.id
      ? await api.put(`/valoraciones/${actual.id}`, { tipo, contenido: c.contenido, version: actual.version })
      : await api.post('/valoraciones', { jugador_id: jugadorId, tipo, contenido: c.contenido })
    ref.current = { ...ref.current, id: data.id, version: data.version }
    setEd(e => ({ ...e, id: data.id, version: data.version }))
    onCambio?.()
    return data
  }
  const auto = usarGuardadoAutomatico({ datos: { tipo: ed.tipo, contenido: ed.contenido }, guardar })

  const cambiar = (campo, valor) => setEd(e => ({ ...e, contenido: { ...e.contenido, [campo]: valor } }))
  const cambiarAntecedente = (campo, valor) => setEd(e => ({ ...e, contenido: { ...e.contenido, antecedentes: { ...e.contenido.antecedentes, [campo]: valor } } }))

  const guardarBorrador = async () => {
    const r = await auto.guardarAhora({ forzar: !ref.current.id })
    if (r.ok) toast.success('Borrador guardado')
    else if (r.sinConexion) toast.error('Sin conexión: se guardará en cuanto vuelva la señal. No cierres esta pantalla.')
    else toast.error(r.error)
  }

  // Ctrl+S (Cmd+S en Mac) guarda el borrador, como en cualquier editor (v2.8, T1.6)
  const atajo = useRef(null)
  atajo.current = () => { if (!ocupado && !auto.conflicto) guardarBorrador() }
  useEffect(() => {
    const tecla = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.key.toLowerCase() !== 's') return
      e.preventDefault() // en vez de "Guardar página como…" del navegador
      if (!document.querySelector('.bloqueo-inactividad')) atajo.current()
    }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [])

  const cerrar = async () => {
    setConfirmar(null)
    const c = normalizarContenido(ed.contenido)
    if (c.ok && contenidoVacio(c.contenido)) return toast.error(MENSAJE_VACIA)
    const r = await auto.guardarAhora({ forzar: !ref.current.id })
    if (!r.ok) return toast.error(r.sinConexion ? 'Sin conexión: la valoración se podrá cerrar cuando vuelva la señal.' : r.error)
    setOcupado(true)
    try {
      const { data } = await api.post(`/valoraciones/${ref.current.id}/cerrar`, { version: ref.current.version })
      toast.success('Valoración cerrada y firmada')
      onCambio?.()
      onCerrada(data)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setOcupado(false)
    }
  }

  const descartar = async () => {
    setConfirmar(null)
    if (ref.current.id) {
      try {
        await api.delete(`/valoraciones/${ref.current.id}`)
        toast.success('Borrador descartado')
        onCambio?.()
      } catch (e) { return toast.error(e.message) }
    }
    auto.restablecer({ tipo: ed.tipo, contenido: ed.contenido }) // nada pendiente: no pedir confirmación al salir
    onSalir()
  }

  // Cerrar la ventana: primero se guarda; si no se puede, se pregunta antes de perder lo escrito
  const salir = async () => {
    if (auto.sucio) {
      const r = await auto.guardarAhora()
      if (!r.ok && !window.confirm('Hay cambios que no se pudieron guardar. ¿Cerrar de todos modos y perderlos?')) return
    }
    onSalir()
  }

  // Conflicto: el borrador cambió en otro dispositivo (o ya se cerró allá)
  const usarGuardada = async () => {
    try {
      const { data } = await api.get(`/valoraciones/${ref.current.id}`)
      if (data.estado === 'cerrada') { auto.restablecer({ tipo: ed.tipo, contenido: ed.contenido }); onCambio?.(); return onCerrada(data) }
      const nuevo = { ...ref.current, version: data.version, tipo: data.tipo, contenido: contenidoParaEditar(data.contenido) }
      ref.current = nuevo
      setEd(nuevo)
      auto.restablecer({ tipo: nuevo.tipo, contenido: nuevo.contenido })
      toast.success('Se cargó la versión guardada.')
    } catch (e) { toast.error(e.message) }
  }
  const guardarEncima = async () => {
    try {
      const { data } = await api.get(`/valoraciones/${ref.current.id}`)
      if (data.estado === 'cerrada') return toast.error('La valoración ya se cerró en otro dispositivo: agrega una nota aclaratoria.')
      ref.current = { ...ref.current, version: data.version }
      setEd(e => ({ ...e, version: data.version }))
      auto.resolverConflicto()
      const r = await auto.guardarAhora({ forzar: true })
      if (r.ok) toast.success('Se guardó tu versión.')
    } catch (e) { toast.error(e.message) }
  }

  return (
    <>
      <Modal title={`${ed.id ? 'Valoración en borrador' : 'Nueva valoración'}${jugadorNombre ? `: ${jugadorNombre}` : ''}`} onClose={salir}
        footer={<>
          {ed.id && <button type="button" className="btn btn-ghost" onClick={() => setConfirmar('descartar')} disabled={ocupado}>Descartar</button>}
          <button type="button" className="btn btn-secondary" onClick={guardarBorrador} disabled={ocupado || !!auto.conflicto} title="Guardar borrador (Ctrl+S)" aria-keyshortcuts="Control+S Meta+S">Guardar borrador</button>
          <button type="button" className="btn btn-primary" onClick={() => setConfirmar('cerrar')} disabled={ocupado || !!auto.conflicto}>
            <i className="fa-solid fa-signature" aria-hidden="true"></i> Cerrar y firmar
          </button>
        </>}>
        <EstadoGuardado estado={auto.conflicto ? null : auto.estado} guardadoEn={auto.guardadoEn} />
        {auto.conflicto && (
          <div className="alerta alerta-aviso conflicto-version" role="alert">
            <i className="fa-solid fa-code-compare" aria-hidden="true"></i>
            <div>
              <p><strong>No se guardó.</strong> {auto.conflicto} Elige qué versión conservar.</p>
              <div className="conflicto-botones">
                <button type="button" className="btn btn-secondary" onClick={usarGuardada}>Usar la versión guardada</button>
                <button type="button" className="btn btn-ghost" onClick={guardarEncima}>Guardar la mía encima</button>
              </div>
            </div>
          </div>
        )}
        <div className="form-group">
          <span className="etiqueta-campo" id="val-tipo">Tipo de valoración</span>
          <div className="segmentado" role="group" aria-labelledby="val-tipo">
            {TIPOS_VALORACION.map(([valor, etiqueta]) => (
              <button key={valor} type="button" aria-pressed={ed.tipo === valor} onClick={() => setEd(e => ({ ...e, tipo: valor }))}>{etiqueta}</button>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="val-motivo">Motivo de consulta</label>
          <textarea id="val-motivo" rows="3" value={ed.contenido.motivo_consulta || ''} onChange={e => cambiar('motivo_consulta', e.target.value)} />
        </div>
        <details className="ident-grupo" open>
          <summary><i className="fa-solid fa-book-medical" aria-hidden="true"></i> Antecedentes <small>Opcional</small></summary>
          {ed.copiados && <p className="ayuda-campo">Se copiaron de la última valoración cerrada: revísalos y actualiza lo que haya cambiado.</p>}
          <div className="form-grid">
            {CAMPOS_ANTECEDENTES.map(([campo, etiqueta]) => (
              <div className="form-group" key={campo}>
                <label htmlFor={`val-${campo}`}>{etiqueta}</label>
                <textarea id={`val-${campo}`} rows="2" value={ed.contenido.antecedentes?.[campo] || ''} onChange={e => cambiarAntecedente(campo, e.target.value)} />
              </div>
            ))}
          </div>
        </details>
        <div className="form-group" style={{ marginTop: 14 }}>
          <label htmlFor="val-observaciones">Observaciones</label>
          <textarea id="val-observaciones" rows="3" value={ed.contenido.observaciones || ''} onChange={e => cambiar('observaciones', e.target.value)} />
        </div>
        {usuario?.quien_atiende && (
          <p className="ayuda-campo">Al cerrarla queda firmada como <strong>{usuario.quien_atiende.nombre} · {usuario.quien_atiende.descripcion}</strong> y ya no se puede modificar.</p>
        )}
      </Modal>

      <ConfirmModal
        isOpen={confirmar === 'cerrar'}
        title="¿Cerrar y firmar la valoración?"
        message="Una vez cerrada no se puede modificar ni borrar: solo se le pueden agregar notas aclaratorias (Resolución 1995 de 1999)."
        confirmText="Sí, cerrar y firmar"
        cancelText="Seguir editando"
        confirmVariant="primary"
        loading={ocupado}
        onConfirm={cerrar}
        onCancel={() => setConfirmar(null)}
      />
      <ConfirmModal
        isOpen={confirmar === 'descartar'}
        title="¿Descartar el borrador?"
        message="El borrador todavía no hace parte de la historia clínica y se borrará."
        confirmText="Sí, descartar"
        cancelText="Cancelar"
        confirmVariant="danger"
        onConfirm={descartar}
        onCancel={() => setConfirmar(null)}
      />
    </>
  )
}

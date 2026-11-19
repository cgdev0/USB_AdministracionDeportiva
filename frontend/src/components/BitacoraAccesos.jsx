// Bitácora de accesos a la historia clínica (v2.7, T0.6 del plan de historia clínica).
// Quién vio, registró, cambió o descargó la historia y cuándo, en lenguaje claro y en forma de lista (cabe en el
// celular). La usan el personal de salud ("Accesos a esta historia"), el deportista ("¿Quién consultó mi historia?")
// y el administrador (vista general de auditoría). Nunca muestra contenido clínico.
import { useEffect, useState } from 'react'
import api from '../services/api'
import Modal from './Modal'
import { EstadoVacio } from './EstadoVista'
import { ROLES } from '../config/navegacion'
import { fechaLarga } from '../utils/fechas'

const ACCION = {
  listar: 'consultó', ver: 'abrió', crear: 'registró', editar: 'modificó', cerrar: 'cerró y firmó',
  descartar: 'descartó', descargar: 'descargó', verificar: 'verificó la integridad de', exportar: 'exportó', eliminar: 'eliminó',
  revocar: 'revocó', // v2.9 (T2.1)
}
const RECURSO = {
  valoracion: ['la valoración', 'las valoraciones'], nota: ['una nota aclaratoria', 'las notas aclaratorias'],
  archivo: ['el archivo clínico', 'los archivos clínicos'], control: ['el control médico', 'los controles médicos'],
  seguimiento: ['el seguimiento de lesión', 'los seguimientos de lesión'], lesion: ['la lesión', 'las lesiones'],
  historia: ['la historia anterior', 'las historias anteriores'], antropometria: ['la medición antropométrica', 'las mediciones antropométricas'],
  identificacion: ['los datos de identificación', 'los datos de identificación'],
  paciente: ['la ficha clínica', 'la lista de pacientes'],
  consentimiento: ['el consentimiento', 'los consentimientos'],
}
const ACCIONES_FILTRO = [['', 'Todas las acciones'], ['ver', 'Abrió'], ['descargar', 'Descargó'], ['crear', 'Registró'], ['editar', 'Modificó'], ['cerrar', 'Cerró'], ['revocar', 'Revocó'], ['listar', 'Consultó listas']]

const cuando = (valor) => {
  const f = new Date(valor)
  return `${fechaLarga(f)} de ${f.getFullYear()} · ${f.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}`
}
export function frase(e) {
  const [uno, varios] = RECURSO[e.recurso] || [e.recurso, e.recurso]
  return `${ACCION[e.accion] || e.accion} ${e.accion === 'listar' ? varios : uno}${e.recurso_id && e.accion !== 'listar' ? ` #${e.recurso_id}` : ''}`
}

// enLinea (v2.8, T1.4): sin ventana, dentro de una pestaña de la ficha clínica en el celular
export default function BitacoraAccesos({ titulo, jugadorId = null, general = false, onClose, enLinea = false }) {
  const [filas, setFilas] = useState(null)
  const [error, setError] = useState(null)
  const [texto, setTexto] = useState('')
  const [accion, setAccion] = useState('')

  useEffect(() => {
    const params = {}
    if (jugadorId) params.jugador_id = jugadorId
    if (accion) params.accion = accion
    setFilas(null)
    api.get('/bitacora', { params }).then(r => setFilas(r.data)).catch(e => { setError(e.message); setFilas([]) })
  }, [jugadorId, accion])

  const t = texto.trim().toLowerCase()
  const visibles = (filas || []).filter(e => !t || `${e.usuario_nombre} ${e.jugador_nombre}`.toLowerCase().includes(t))

  const contenido = (
    <>
      <p className="ayuda-campo">Cada vez que alguien consulta, registra, cambia o descarga un dato clínico queda aquí, con la fecha y la hora. Este registro no se puede modificar ni borrar.</p>
      {general && (
        <div className="form-grid bitacora-filtros">
          <div className="form-group">
            <label htmlFor="bit-buscar">Buscar por persona o deportista</label>
            <input id="bit-buscar" type="search" value={texto} onChange={e => setTexto(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="bit-accion">Acción</label>
            <select id="bit-accion" value={accion} onChange={e => setAccion(e.target.value)}>
              {ACCIONES_FILTRO.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
          </div>
        </div>
      )}
      {error && <p className="alerta alerta-error" role="alert">{error}</p>}
      {filas === null ? <p className="ayuda-campo">Cargando…</p>
        : visibles.length === 0 ? <EstadoVacio compacto icono="fa-clock-rotate-left" titulo="Sin accesos registrados" descripcion="Aún nadie ha consultado ni modificado estos datos." />
        : (
          <ol className="bitacora-lista" aria-label="Accesos, del más reciente al más antiguo">
            {visibles.map(e => (
              <li key={e.id}>
                <p><strong>{e.usuario_nombre || 'Usuario'}</strong> <span className="texto-suave">({ROLES[e.usuario_rol] || e.usuario_rol})</span> {frase(e)}
                  {(general || !jugadorId) && e.jugador_nombre ? <> de <strong>{e.jugador_nombre}</strong></> : null}</p>
                <small className="texto-suave">{cuando(e.creado_en)}{general && e.ip ? ` · IP ${e.ip}` : ''}</small>
              </li>
            ))}
          </ol>
        )}
    </>
  )
  return enLinea ? contenido : <Modal title={titulo} onClose={onClose}>{contenido}</Modal>
}

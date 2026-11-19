// Pacientes (v2.8, T1.3 del plan de historia clínica): que el personal de salud encuentre a un deportista en segundos
// desde el celular. Busca por nombre (sin importar tildes), documento (con o sin puntos) o dorsal (#10), filtra con
// botones rápidos (lesión activa, borrador sin cerrar, control vencido, sin documento) y muestra de un vistazo la
// disponibilidad y los avisos (alergias, menor de edad…). Tarjetas grandes en celular y tableta (también horizontal);
// tabla en computador, desde 1280 px (T1.6). Al tocar un paciente se abre su ficha clínica (T1.4).
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import EncabezadoPagina from '../components/EncabezadoPagina'
import { Esqueleto, EstadoVacio, EstadoSinResultados, EstadoError } from '../components/EstadoVista'
import { usarConsulta, COMPUTADOR } from '../components/clinico/usarModoPantalla'
import { useFiltroDeporte } from '../context/DeporteContext'
import { Avisos, Disponibilidad, Foto, documentoDe as documento, consentimientosPendientes } from '../components/clinico/Paciente'
import { SUBPAGINAS } from '../config/paginas'
import { nombreConDorsal, tieneDorsal } from '../utils/jugador'
import { fechaCorta } from '../utils/fechas'

// Minúsculas y sin tildes: "Tomás" se encuentra escribiendo "tomas"
const plano = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const FILTROS = [
  ['lesion', 'Lesión activa', p => p.lesion_activa],
  ['borrador', 'Borrador sin cerrar', p => p.borradores > 0],
  ['control', 'Control vencido', p => p.control_vencido],
  ['documento', 'Sin documento', p => !p.numero_documento],
  ['consentimiento', 'Consentimiento pendiente', p => consentimientosPendientes(p).length > 0], // v2.9 (T2.3)
  ['aceptacion', 'Falta aceptación', p => ['falta_propia', 'sin_declaracion'].includes(p.autorizacion)], // v2.9 (T2.6)
]

const enlace = (p) => `/pacientes/${p.id}`
// La ficha se descarga en cuanto se muestra la intención de abrirla (como el menú)
const precargarFicha = SUBPAGINAS.find(s => s.ruta === '/pacientes/:id').precargar

export default function Pacientes() {
  const tabla = usarConsulta(COMPUTADOR)
  const filtroDeporte = useFiltroDeporte()
  const [pacientes, setPacientes] = useState(null)
  const [error, setError] = useState(null)
  const [texto, setTexto] = useState('')
  const [activos, setActivos] = useState([]) // filtros rápidos activos
  const [equipo, setEquipo] = useState('')
  const [retirados, setRetirados] = useState(false)

  const cargar = async () => {
    setError(null)
    try {
      const { data } = await api.get('/pacientes', { params: retirados ? { retirados: 'incluir' } : {} })
      setPacientes(data)
    } catch (e) {
      setError(e.message)
    }
  }
  useEffect(() => { setPacientes(null); cargar() }, [retirados]) // eslint-disable-line react-hooks/exhaustive-deps

  const equipos = useMemo(() => [...new Map((pacientes || []).filter(p => p.equipo_id).map(p => [p.equipo_id, p.equipo_nombre])).entries()]
    .sort((a, b) => String(a[1]).localeCompare(String(b[1]))), [pacientes])

  const visibles = useMemo(() => {
    const t = plano(texto)
    const tDoc = t.replace(/[\s.\-]/g, '')
    const tDorsal = t.replace('#', '')
    return (pacientes || []).filter(p => {
      if (!filtroDeporte.deDisciplina(p.disciplina_id)) return false
      if (equipo && String(p.equipo_id) !== equipo) return false
      for (const [clave, , cumple] of FILTROS) if (activos.includes(clave) && !cumple(p)) return false
      if (!t) return true
      return plano(p.nombre).includes(t)
        || (tDoc.length >= 3 && plano(p.numero_documento).includes(tDoc))
        || (tieneDorsal(p.dorsal) && /^\d{1,2}$/.test(tDorsal) && String(p.dorsal) === tDorsal)
    })
  }, [pacientes, texto, activos, equipo, filtroDeporte])

  const alternar = (clave) => setActivos(a => (a.includes(clave) ? a.filter(x => x !== clave) : [...a, clave]))
  const limpiar = () => { setTexto(''); setActivos([]); setEquipo(''); filtroDeporte.limpiar() }
  const conteo = (clave) => (pacientes || []).filter(p => filtroDeporte.deDisciplina(p.disciplina_id) && FILTROS.find(f => f[0] === clave)[2](p)).length

  return (
    <div>
      <EncabezadoPagina icono="fa-hospital-user" antetitulo="Salud" titulo="Pacientes"
        descripcion="Busca a un deportista por nombre, documento o dorsal y abre su ficha clínica." />

      <div className="pacientes-busqueda">
        <div className="buscador">
          <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
          <input type="search" value={texto} onChange={e => setTexto(e.target.value)} placeholder="Nombre, documento o dorsal"
            aria-label="Buscar paciente por nombre, documento o dorsal" autoComplete="off" />
        </div>
        <div className="pacientes-filtros" role="group" aria-label="Filtros rápidos">
          {FILTROS.map(([clave, etiqueta]) => (
            <button key={clave} type="button" className="chip-filtro" aria-pressed={activos.includes(clave)} onClick={() => alternar(clave)}>
              {etiqueta} {pacientes && <span>{conteo(clave)}</span>}
            </button>
          ))}
          <button type="button" className="chip-filtro" aria-pressed={retirados} onClick={() => setRetirados(r => !r)}>Incluir retirados</button>
        </div>
        {equipos.length > 1 && (
          <div className="form-group pacientes-equipo">
            <label htmlFor="pac-equipo">Equipo</label>
            <select id="pac-equipo" value={equipo} onChange={e => setEquipo(e.target.value)}>
              <option value="">Todos los equipos</option>
              {equipos.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
            </select>
          </div>
        )}
      </div>

      {error ? <div className="card"><EstadoError mensaje={error} onReintentar={cargar} /></div>
        : pacientes === null ? <div className="card" style={{ padding: 0 }}><Esqueleto tipo={tabla ? 'tabla' : 'panel'} filas={6} etiqueta="Cargando pacientes…" /></div>
        : pacientes.length === 0 ? <div className="card"><EstadoVacio icono="fa-hospital-user" titulo="Aún no hay deportistas" descripcion="Cuando se registren deportistas, aparecerán aquí." /></div>
        : visibles.length === 0 ? <div className="card"><EstadoSinResultados onLimpiar={limpiar} textoLimpiar="Ver todos los pacientes" /></div>
        : (
          <>
            <p className="pacientes-conteo" role="status">{visibles.length} {visibles.length === 1 ? 'paciente' : 'pacientes'}</p>
            {tabla ? (
              <div className="card" style={{ padding: 0 }}>
                <div className="table-wrapper" tabIndex={0} role="region" aria-label="Pacientes">
                  <table className="tabla-pacientes">
                    <thead><tr><th>Deportista</th><th>Deporte y equipo</th><th>Disponibilidad</th><th>Avisos</th><th>Última valoración</th><th><span className="sr-only">Abrir</span></th></tr></thead>
                    <tbody>
                      {visibles.map(p => (
                        <tr key={p.id}>
                          <td>
                            <div className="celda-persona">
                              <Foto paciente={p} />
                              <span><b>{nombreConDorsal(p.nombre, p.dorsal)}</b><small>{documento(p)}</small></span>
                            </div>
                          </td>
                          <td>{p.disciplina_nombre || '—'}{p.equipo_nombre ? <small className="texto-suave"> · {p.equipo_nombre}</small> : null}</td>
                          <td><Disponibilidad valor={p.disponibilidad} /></td>
                          <td><Avisos paciente={p} /></td>
                          <td>{p.ultima_valoracion ? fechaCorta(new Date(p.ultima_valoracion)) : <span className="texto-suave">Sin valoraciones</span>}</td>
                          <td><Link className="btn btn-secondary btn-sm" to={enlace(p)} onMouseEnter={precargarFicha} onFocus={precargarFicha} aria-label={`Abrir la ficha de ${p.nombre}`}>Abrir ficha</Link></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <ol className="pacientes-tarjetas" aria-label="Pacientes">
                {visibles.map(p => (
                  <li key={p.id}>
                    <Link className="paciente-tarjeta" to={enlace(p)} onTouchStart={precargarFicha} onMouseEnter={precargarFicha}>
                      <Foto paciente={p} />
                      <span className="paciente-datos">
                        <strong>{nombreConDorsal(p.nombre, p.dorsal)}</strong>
                        <small>{documento(p)}{p.disciplina_nombre ? ` · ${p.disciplina_nombre}` : ''}{p.equipo_nombre ? ` · ${p.equipo_nombre}` : ''}</small>
                        <Disponibilidad valor={p.disponibilidad} />
                        <Avisos paciente={p} />
                      </span>
                      <i className="fa-solid fa-chevron-right paciente-flecha" aria-hidden="true"></i>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
    </div>
  )
}

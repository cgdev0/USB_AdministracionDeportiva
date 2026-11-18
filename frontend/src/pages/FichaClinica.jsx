// Ficha clínica del deportista (v2.8, T1.4 del plan de historia clínica).
// Todo lo clínico de un deportista en una pantalla, con el botón para iniciar una valoración a un toque.
// - Encabezado con la identificación y los avisos (alergias, lesión, menor de edad…), visibles en todas las pestañas.
//   El aviso de consentimientos llega con la Fase 2.
// - Celular y tableta vertical: pestañas Resumen, Historia y Accesos, y la barra con "Nueva valoración" fija abajo.
// - Tableta horizontal y computador: resumen fijo a la izquierda e historia a la derecha.
// - Historia: valoraciones, controles, lesiones con sus seguimientos, mediciones y archivos, del más reciente al más
//   antiguo, con filtros por tipo. Cada registro se abre desde aquí.
// Abrir la ficha queda una sola vez en la bitácora (GET /api/pacientes/:id trae todo en una consulta).
// ?abrir=lesion-12 (o valoracion-, control-, medicion-) abre ese registro al entrar: así cada aviso del inicio del
// personal de salud lleva directo a su registro (T1.5).
import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../services/api'
import Modal from '../components/Modal'
import { Esqueleto, EstadoError, EstadoVacio } from '../components/EstadoVista'
import EditorValoracion, { borradorNuevo, contenidoParaEditar } from '../components/EditorValoracion'
import DetalleValoracion from '../components/DetalleValoracion'
import BitacoraAccesos from '../components/BitacoraAccesos'
import BarraAcciones from '../components/clinico/BarraAcciones'
import usarModoPantalla from '../components/clinico/usarModoPantalla'
import { Avisos, Disponibilidad, Foto, documentoDe } from '../components/clinico/Paciente'
import { useAuth } from '../context/AuthContext'
import { nombreConDorsal } from '../utils/jugador'
import { aFecha, fechaCorta, fechaTabla, capitalizar } from '../utils/fechas'
import { CAMPOS_ANTECEDENTES } from '../utils/valoracion'
import { DISCAPACIDADES, PAISES, PERTENENCIAS_ETNICAS, ZONAS, tipoDocumento } from '../utils/identificacion'

const APTITUD = { apto: 'Apto', apto_restricciones: 'Apto con restricciones', no_apto_temporal: 'No apto temporalmente', pendiente: 'Pendiente' }
const TONO_APTITUD = { apto: 'badge-green', apto_restricciones: 'badge-orange', no_apto_temporal: 'badge-red' }
const ARCHIVO = { consentimiento: 'Consentimiento', postura: 'Foto de postura', examen: 'Examen', otro: 'Archivo' }
const TIPOS = [
  ['valoracion', 'Valoraciones', 'fa-notes-medical'],
  ['control', 'Controles', 'fa-stethoscope'],
  ['lesion', 'Lesiones', 'fa-kit-medical'],
  ['medicion', 'Mediciones', 'fa-ruler-combined'],
  ['archivo', 'Archivos', 'fa-file-medical'],
]
const ICONO = Object.fromEntries(TIPOS.map(([t, , i]) => [t, i]))
const PESTANAS = [['resumen', 'Resumen'], ['historia', 'Historia'], ['accesos', 'Accesos']]

const numero = (v, decimales = 1) => (v === null || v === undefined || v === '' ? null : Number(v).toLocaleString('es-CO', { maximumFractionDigits: decimales }))
const etiquetaDe = (lista, valor) => lista.find(([c]) => c === valor)?.[1] || valor
// Fecha sola ('2026-11-09', sin desfase de zona) o fecha y hora
const momento = (v) => (String(v).length <= 10 ? aFecha(v) : new Date(v))
const tamano = (b) => (b >= 1048576 ? `${numero(b / 1048576)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`

// Todos los registros en una sola línea de tiempo, del más reciente al más antiguo
function lineaDeTiempo(d) {
  return [
    ...d.valoraciones.map(v => ({
      clave: `valoracion-${v.id}`, tipo: 'valoracion', fecha: v.fecha_hora, registro: v, titulo: `Valoración · ${v.tipo_nombre}`,
      insignia: v.estado === 'cerrada' ? ['badge-green', 'fa-lock', 'Cerrada'] : ['badge-orange', 'fa-pen', 'Borrador'], meta: v.atendio,
    })),
    ...d.controles.map(c => ({
      clave: `control-${c.id}`, tipo: 'control', fecha: c.fecha, registro: c, titulo: c.tipo || 'Control médico',
      insignia: [TONO_APTITUD[c.aptitud] || 'badge-neutro', 'fa-stethoscope', APTITUD[c.aptitud] || c.aptitud], meta: c.restricciones || c.atendio,
    })),
    ...d.lesiones.map(l => ({
      clave: `lesion-${l.id}`, tipo: 'lesion', fecha: l.fecha_inicio, registro: l, titulo: `Lesión · ${l.tipo}`,
      insignia: l.activa ? ['badge-red', 'fa-kit-medical', 'Activa'] : ['badge-neutro', 'fa-check', l.fecha_fin ? `Alta ${fechaCorta(l.fecha_fin)}` : 'Registrada'],
      meta: l.seguimientos.length ? plural(l.seguimientos.length, 'seguimiento', 'seguimientos') : 'Sin seguimientos',
    })),
    ...d.mediciones.map(m => ({
      clave: `medicion-${m.id}`, tipo: 'medicion', fecha: m.fecha, registro: m, titulo: 'Medición antropométrica',
      meta: [m.peso && `${numero(m.peso)} kg`, m.imc && `IMC ${numero(m.imc)}`, m.porcentaje_grasa && `grasa ${numero(m.porcentaje_grasa)} %`].filter(Boolean).join(' · '),
    })),
    ...d.archivos.map(a => ({
      clave: `archivo-${a.id}`, tipo: 'archivo', fecha: a.creado_en, registro: a, titulo: a.nombre_original,
      insignia: ['badge-blue', 'fa-download', ARCHIVO[a.tipo] || 'Archivo'], meta: [tamano(a.tamano), a.subido_por_nombre].filter(Boolean).join(' · '),
    })),
  ].sort((a, b) => momento(b.fecha) - momento(a.fecha))
}

// Un dato de la ficha; si no hay valor, no se muestra
function Dato({ etiqueta, children, clase }) {
  if (children === null || children === undefined || children === '' || children === false) return null
  return <div className={clase}><dt>{etiqueta}</dt><dd>{children}</dd></div>
}

function Resumen({ p, mediciones }) {
  const ultima = mediciones[0]
  const antecedentes = CAMPOS_ANTECEDENTES.filter(([c]) => p.antecedentes?.[c])
  const contacto = (nombre, parentesco, telefono) => (nombre || telefono) && (
    <>{nombre}{parentesco ? ` (${parentesco.toLowerCase()})` : ''}{telefono ? <> · <a href={`tel:${telefono}`}>{telefono}</a></> : null}</>
  )
  return (
    <div className="ficha-resumen">
      <section className="card ficha-bloque" aria-labelledby="fr-estado">
        <h2 id="fr-estado"><i className="fa-solid fa-heart-pulse" aria-hidden="true"></i> Estado</h2>
        <dl className="ficha-datos">
          <Dato etiqueta="Disponibilidad"><Disponibilidad valor={p.disponibilidad} /></Dato>
          <Dato etiqueta="Lesión activa">{p.lesion_activa && `${p.lesion_tipo} · desde el ${fechaCorta(p.lesion_desde)}${p.retorno_estimado ? ` · retorno estimado: ${fechaCorta(p.retorno_estimado)}` : ''}`}</Dato>
          <Dato etiqueta="Último control">{p.control_fecha ? `${fechaTabla(p.control_fecha)} · ${APTITUD[p.aptitud] || p.aptitud}${p.restricciones ? ` · ${p.restricciones}` : ''}` : 'Sin controles registrados'}</Dato>
          <Dato etiqueta="Próximo control" clase={p.control_vencido ? 'dato-alerta' : undefined}>{p.control_proxima && `${fechaTabla(p.control_proxima)}${p.control_vencido ? ' · vencido' : ''}`}</Dato>
        </dl>
      </section>

      <section className="card ficha-bloque" aria-labelledby="fr-antecedentes">
        <h2 id="fr-antecedentes"><i className="fa-solid fa-book-medical" aria-hidden="true"></i> Antecedentes</h2>
        {antecedentes.length ? (
          <>
            <p className="ayuda-campo">De la última valoración cerrada ({fechaTabla(new Date(p.ultima_valoracion))}).</p>
            <dl className="ficha-datos">
              {antecedentes.map(([c, etiqueta]) => <Dato key={c} etiqueta={etiqueta} clase={c === 'alergias' ? 'dato-alerta' : undefined}>{p.antecedentes[c]}</Dato>)}
            </dl>
          </>
        ) : <p className="ayuda-campo">Sin antecedentes en una valoración cerrada.</p>}
      </section>

      <section className="card ficha-bloque" aria-labelledby="fr-medicion">
        <h2 id="fr-medicion"><i className="fa-solid fa-ruler-combined" aria-hidden="true"></i> Última medición</h2>
        {ultima ? (
          <dl className="ficha-datos ficha-datos-cifras">
            <Dato etiqueta="Fecha">{fechaTabla(ultima.fecha)}</Dato>
            <Dato etiqueta="Peso">{ultima.peso && `${numero(ultima.peso)} kg`}</Dato>
            <Dato etiqueta="Talla">{ultima.estatura && `${numero(ultima.estatura, 2)} m`}</Dato>
            <Dato etiqueta="IMC">{numero(ultima.imc)}</Dato>
            <Dato etiqueta="Grasa">{ultima.porcentaje_grasa && `${numero(ultima.porcentaje_grasa)} %`}</Dato>
          </dl>
        ) : <p className="ayuda-campo">Sin mediciones antropométricas.</p>}
      </section>

      <section className="card ficha-bloque" aria-labelledby="fr-identificacion">
        <h2 id="fr-identificacion"><i className="fa-solid fa-id-card" aria-hidden="true"></i> Identificación y contacto</h2>
        <dl className="ficha-datos">
          <Dato etiqueta="Documento">{p.numero_documento ? `${tipoDocumento(p.tipo_documento)?.nombre || p.tipo_documento} ${p.numero_documento}` : 'Sin documento'}</Dato>
          <Dato etiqueta="Nacimiento">{p.fecha_nacimiento ? `${fechaTabla(p.fecha_nacimiento)} · ${p.edad} años` : p.edad !== null && `${p.edad} años`}</Dato>
          <Dato etiqueta="Sexo">{p.genero ? capitalizar(p.genero) : 'Sin registrar'}</Dato>
          <Dato etiqueta="Posición">{p.posicion}</Dato>
          <Dato etiqueta="EPS">{p.eps}</Dato>
          <Dato etiqueta="Teléfono">{p.telefono && <a href={`tel:${p.telefono}`}>{p.telefono}</a>}</Dato>
          <Dato etiqueta="Residencia">{[p.municipio_residencia, p.zona_residencia && `zona ${etiquetaDe(ZONAS, p.zona_residencia).toLowerCase()}`].filter(Boolean).join(' · ')}</Dato>
          <Dato etiqueta="Nacionalidad">{p.nacionalidad && etiquetaDe(PAISES, p.nacionalidad)}</Dato>
          <Dato etiqueta="Contacto de emergencia">{contacto(p.contacto_emergencia_nombre, p.contacto_emergencia_parentesco, p.contacto_emergencia_telefono)}</Dato>
          <Dato etiqueta="Acudiente">{contacto(p.acudiente_nombre, p.acudiente_parentesco, p.acudiente_telefono)}</Dato>
          <Dato etiqueta="Pertenencia étnica">{p.pertenencia_etnica && etiquetaDe(PERTENENCIAS_ETNICAS, p.pertenencia_etnica)}</Dato>
          <Dato etiqueta="Discapacidad">{p.discapacidad && etiquetaDe(DISCAPACIDADES, p.discapacidad)}</Dato>
          <Dato etiqueta="Retiro">{p.activo === false && `${p.retirado_en ? fechaTabla(new Date(p.retirado_en)) : 'Retirado'}${p.motivo_retiro ? ` · ${p.motivo_retiro}` : ''}`}</Dato>
        </dl>
        {(p.pertenencia_etnica || p.discapacidad) && <p className="ayuda-campo">La pertenencia étnica y la discapacidad son datos sensibles: solo los ve el personal de salud.</p>}
      </section>
    </div>
  )
}

function Historia({ items, filtro, onFiltro, onAbrir }) {
  const visibles = filtro === 'todo' ? items : items.filter(i => i.tipo === filtro)
  const conteo = (t) => items.filter(i => i.tipo === t).length
  return (
    <section className="card ficha-historia" aria-labelledby="fh-titulo">
      <h2 id="fh-titulo"><i className="fa-solid fa-timeline" aria-hidden="true"></i> Historia</h2>
      <div className="pacientes-filtros" role="group" aria-label="Filtrar la historia por tipo">
        <button type="button" className="chip-filtro" aria-pressed={filtro === 'todo'} onClick={() => onFiltro('todo')}>Todo <span>{items.length}</span></button>
        {TIPOS.map(([t, nombre]) => (
          <button key={t} type="button" className="chip-filtro" aria-pressed={filtro === t} onClick={() => onFiltro(filtro === t ? 'todo' : t)}>
            {nombre} <span>{conteo(t)}</span>
          </button>
        ))}
      </div>
      {visibles.length === 0 ? (
        <EstadoVacio compacto icono="fa-folder-open" titulo={items.length ? 'Nada de este tipo' : 'Aún no hay registros'}
          descripcion={items.length ? 'Elige otro filtro para ver el resto de la historia.' : 'Usa "Nueva valoración" para registrar la primera atención.'} />
      ) : (
        <ol className="ficha-linea" aria-label="Registros, del más reciente al más antiguo">
          {visibles.map(i => (
            <li key={i.clave}>
              <button type="button" className={`ficha-item tipo-${i.tipo}`} onClick={() => onAbrir(i)}>
                <span className="ficha-item-icono" aria-hidden="true"><i className={`fa-solid ${ICONO[i.tipo]}`}></i></span>
                <span className="ficha-item-cuerpo">
                  <span className="ficha-item-fecha">{fechaTabla(momento(i.fecha))}</span>
                  <strong>{i.titulo}</strong>
                  {i.meta && <small>{i.meta}</small>}
                </span>
                {i.insignia && <span className={`badge ${i.insignia[0]}`}><i className={`fa-solid ${i.insignia[1]}`} aria-hidden="true"></i> {i.insignia[2]}</span>}
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

// Controles, lesiones y mediciones ya vienen completos en la ficha: se muestran sin otra consulta
function DetalleRegistro({ item, onClose }) {
  const r = item.registro
  if (item.tipo === 'control') {
    return (
      <Modal title={`${r.tipo || 'Control médico'} · ${fechaTabla(r.fecha)}`} onClose={onClose}>
        <dl className="ficha-datos">
          <Dato etiqueta="Aptitud">{APTITUD[r.aptitud] || r.aptitud}</Dato>
          <Dato etiqueta="Restricciones">{r.restricciones}</Dato>
          <Dato etiqueta="Resultado y observaciones">{r.resultado}</Dato>
          <Dato etiqueta="Próximo control">{r.proxima_fecha && fechaTabla(r.proxima_fecha)}</Dato>
          <Dato etiqueta="Atendió">{r.atendio}</Dato>
        </dl>
      </Modal>
    )
  }
  if (item.tipo === 'lesion') {
    return (
      <Modal title={`Lesión: ${r.tipo}`} onClose={onClose}>
        <dl className="ficha-datos">
          <Dato etiqueta="Desde">{fechaTabla(r.fecha_inicio)}</Dato>
          <Dato etiqueta="Estado">{r.activa ? 'Activa' : r.fecha_fin ? `Alta el ${fechaTabla(r.fecha_fin)}` : 'Registrada'}</Dato>
          <Dato etiqueta="Descripción">{r.descripcion}</Dato>
        </dl>
        <h4 className="valoracion-notas-titulo">Seguimientos</h4>
        {r.seguimientos.length === 0 ? <p className="ayuda-campo">Sin seguimientos registrados.</p> : (
          <ol className="valoracion-notas">
            {r.seguimientos.map(s => (
              <li key={s.id}>
                <p><strong>{fechaTabla(s.fecha_seguimiento)}</strong>{s.estado ? ` · ${capitalizar(String(s.estado).replace(/_/g, ' '))}` : ''}{s.gravedad ? ` · gravedad ${s.gravedad}` : ''}{s.zona_corporal ? ` · ${s.zona_corporal}` : ''}</p>
                <dl className="ficha-datos">
                  <Dato etiqueta="Diagnóstico">{s.diagnostico}</Dato>
                  <Dato etiqueta="Tratamiento">{s.tratamiento}</Dato>
                  <Dato etiqueta="Evolución">{s.evolucion}</Dato>
                  <Dato etiqueta="Retorno estimado">{s.fecha_retorno_estimada && fechaTabla(s.fecha_retorno_estimada)}</Dato>
                  <Dato etiqueta="Retorno real">{s.fecha_retorno_real && fechaTabla(s.fecha_retorno_real)}</Dato>
                </dl>
                {s.atendio && <small className="texto-suave">{s.atendio}</small>}
              </li>
            ))}
          </ol>
        )}
        <p className="ayuda-campo"><Link to="/lesiones">Registrar un seguimiento en Lesiones</Link></p>
      </Modal>
    )
  }
  return (
    <Modal title={`Medición antropométrica · ${fechaTabla(r.fecha)}`} onClose={onClose}>
      <dl className="ficha-datos ficha-datos-cifras">
        <Dato etiqueta="Peso">{r.peso && `${numero(r.peso)} kg`}</Dato>
        <Dato etiqueta="Talla">{r.estatura && `${numero(r.estatura, 2)} m`}</Dato>
        <Dato etiqueta="IMC">{numero(r.imc)}</Dato>
        <Dato etiqueta="Grasa">{r.porcentaje_grasa && `${numero(r.porcentaje_grasa)} %`}</Dato>
        <Dato etiqueta="Masa muscular">{r.masa_muscular_esqueletica && `${numero(r.masa_muscular_esqueletica)} kg`}</Dato>
        <Dato etiqueta="Masa ósea">{r.masa_mineral_osea && `${numero(r.masa_mineral_osea)} kg`}</Dato>
        <Dato etiqueta="Suma de pliegues">{r.sumatoria_pliegues && `${numero(r.sumatoria_pliegues)} mm`}</Dato>
        <Dato etiqueta="Somatotipo">{r.endomorfia !== null && r.endomorfia !== undefined && `${numero(r.endomorfia)} – ${numero(r.mesomorfia)} – ${numero(r.ectomorfia)}`}</Dato>
      </dl>
      <p className="ayuda-campo"><Link to="/antropometria">Ver todas las mediciones en Antropometría</Link></p>
    </Modal>
  )
}

function Pestanas({ actual, onCambiar, conteo }) {
  const refs = useRef({})
  // Flechas izquierda y derecha entre pestañas (patrón de pestañas de WAI-ARIA)
  const teclas = (e, i) => {
    const paso = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!paso) return
    e.preventDefault()
    const siguiente = PESTANAS[(i + paso + PESTANAS.length) % PESTANAS.length][0]
    onCambiar(siguiente)
    refs.current[siguiente]?.focus()
  }
  return (
    <div className="ficha-pestanas" role="tablist" aria-label="Secciones de la ficha">
      {PESTANAS.map(([clave, nombre], i) => (
        <button key={clave} type="button" role="tab" id={`ficha-tab-${clave}`} aria-controls={`ficha-panel-${clave}`}
          aria-selected={actual === clave} tabIndex={actual === clave ? 0 : -1} ref={el => { refs.current[clave] = el }}
          onClick={() => onCambiar(clave)} onKeyDown={e => teclas(e, i)}>
          {nombre}{clave === 'historia' && <span className="ficha-pestana-conteo">{conteo}</span>}
        </button>
      ))}
    </div>
  )
}

export default function FichaClinica() {
  const { id } = useParams()
  const modo = usarModoPantalla()
  const { usuario } = useAuth()
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)
  const [pestana, setPestana] = useState('resumen')
  const [filtro, setFiltro] = useState('todo')
  const [editor, setEditor] = useState(null)       // borrador abierto
  const [detalle, setDetalle] = useState(null)     // valoración abierta (cerrada o borrador ajeno)
  const [registro, setRegistro] = useState(null)   // control, lesión o medición abiertos
  const [verAccesos, setVerAccesos] = useState(false)
  const cambio = useRef(false)
  const [parametros, setParametros] = useSearchParams()

  const cargar = async ({ silencioso = false } = {}) => {
    if (!silencioso) { setDatos(null); setError(null) }
    try {
      const { data } = await api.get(`/pacientes/${id}`)
      setDatos(data)
    } catch (e) {
      if (silencioso) toast.error(e.message)
      else setError(e)
    }
  }
  useEffect(() => { setPestana('resumen'); setFiltro('todo'); cargar() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const abrirValoracion = async (v) => {
    if (v.estado === 'borrador' && Number(v.profesional_id) === Number(usuario?.id)) {
      setEditor({ id: v.id, version: v.version, tipo: v.tipo, contenido: contenidoParaEditar(v.contenido) })
      return
    }
    try {
      const { data } = await api.get(`/valoraciones/${v.id}`)
      setDetalle(data)
    } catch (e) { toast.error(e.message) }
  }
  const descargar = async (a) => {
    try {
      const r = await api.get(`/archivos-clinicos/${a.id}`, { responseType: 'blob', timeout: 60000 })
      // Solo en memoria mientras se descarga (D8: nada clínico en el almacenamiento del navegador)
      const url = URL.createObjectURL(r.data)
      const enlace = document.createElement('a')
      enlace.href = url
      enlace.download = a.nombre_original
      document.body.appendChild(enlace)
      enlace.click()
      enlace.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (e) {
      toast.error(e.status === 410 ? 'El archivo ya no está disponible en el servidor. Avisa al administrador.' : e.status === 404 ? 'Archivo no encontrado' : e.message)
    }
  }
  const abrir = (item) => {
    if (item.tipo === 'valoracion') return abrirValoracion(item.registro)
    if (item.tipo === 'archivo') return descargar(item.registro)
    setRegistro(item)
  }

  // Un registro pedido desde el inicio: se abre una sola vez y se quita de la dirección
  const pedido = parametros.get('abrir')
  useEffect(() => {
    if (!datos || !pedido) return
    setParametros({}, { replace: true })
    const item = lineaDeTiempo(datos).find(i => i.clave === pedido)
    if (!item) { toast.error('Ese registro ya no está en la historia.'); return }
    setPestana('historia')
    abrir(item)
  }, [datos, pedido]) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className="card">
        <EstadoError titulo={error.status === 404 ? 'No encontramos a este deportista' : undefined} mensaje={error.message}
          onReintentar={error.status === 404 ? undefined : () => cargar()} />
        <p style={{ textAlign: 'center' }}><Link to="/pacientes">Volver a pacientes</Link></p>
      </div>
    )
  }
  if (!datos) return <div className="card" style={{ padding: 0 }}><Esqueleto tipo="panel" filas={8} etiqueta="Cargando la ficha clínica…" /></div>

  const p = datos.paciente
  const items = lineaDeTiempo(datos)
  const miBorrador = datos.valoraciones.find(v => v.estado === 'borrador' && Number(v.profesional_id) === Number(usuario?.id))
  const amplio = modo === 'amplio'
  const nueva = () => setEditor(borradorNuevo(datos.valoraciones))

  const sinDocumento = !p.numero_documento
  const acciones = (
    <>
      {miBorrador && (
        <button type="button" className="btn btn-secondary" onClick={() => abrirValoracion(miBorrador)}>
          <i className="fa-solid fa-pen" aria-hidden="true"></i> Continuar borrador
        </button>
      )}
      <button type="button" className="btn btn-primary" onClick={nueva} disabled={sinDocumento} aria-describedby={sinDocumento ? 'ficha-avisos' : undefined}>
        <i className="fa-solid fa-plus" aria-hidden="true"></i> Nueva valoración
      </button>
    </>
  )
  const edad = p.edad !== null && p.edad !== undefined ? `${p.edad} años` : null

  return (
    <div className="ficha">
      <header className="card ficha-cabecera">
        <Link to="/pacientes" className="ficha-volver"><i className="fa-solid fa-chevron-left" aria-hidden="true"></i> Pacientes</Link>
        <div className="ficha-persona">
          <Foto paciente={p} className="ficha-foto" />
          <div className="ficha-identidad">
            <h1>{nombreConDorsal(p.nombre, p.dorsal)}</h1>
            <p>{[documentoDe(p), edad, p.disciplina_nombre, p.equipo_nombre].filter(Boolean).join(' · ')}</p>
            <Disponibilidad valor={p.disponibilidad} />
          </div>
          {amplio && (
            <div className="ficha-acciones">
              <button type="button" className="btn btn-ghost" onClick={() => setVerAccesos(true)}>
                <i className="fa-solid fa-clock-rotate-left" aria-hidden="true"></i> Accesos a esta historia
              </button>
              {acciones}
            </div>
          )}
        </div>
        <Avisos paciente={p} id="ficha-avisos" />
      </header>

      {amplio ? (
        <div className="ficha-columnas">
          <aside aria-label="Resumen del deportista"><Resumen p={p} mediciones={datos.mediciones} /></aside>
          <Historia items={items} filtro={filtro} onFiltro={setFiltro} onAbrir={abrir} />
        </div>
      ) : (
        <>
          <Pestanas actual={pestana} onCambiar={setPestana} conteo={items.length} />
          <div role="tabpanel" id={`ficha-panel-${pestana}`} aria-labelledby={`ficha-tab-${pestana}`} className="ficha-panel">
            {pestana === 'resumen' && <Resumen p={p} mediciones={datos.mediciones} />}
            {pestana === 'historia' && <Historia items={items} filtro={filtro} onFiltro={setFiltro} onAbrir={abrir} />}
            {pestana === 'accesos' && (
              <section className="card" aria-labelledby="fa-titulo">
                <h2 id="fa-titulo" className="ficha-subtitulo"><i className="fa-solid fa-clock-rotate-left" aria-hidden="true"></i> Accesos a esta historia</h2>
                <BitacoraAccesos enLinea jugadorId={p.id} />
              </section>
            )}
          </div>
          <BarraAcciones etiqueta="Acciones de la ficha">{acciones}</BarraAcciones>
        </>
      )}

      {editor && (
        <EditorValoracion key={editor.id || 'nueva'} inicial={editor} jugadorId={p.id} jugadorNombre={p.nombre}
          onCambio={() => { cambio.current = true }}
          onSalir={() => { setEditor(null); if (cambio.current) { cambio.current = false; cargar({ silencioso: true }) } }}
          onCerrada={(data) => { setEditor(null); cambio.current = false; cargar({ silencioso: true }); abrirValoracion(data) }} />
      )}
      {detalle && <DetalleValoracion key={detalle.id} valoracion={detalle} onClose={() => setDetalle(null)} />}
      {registro && <DetalleRegistro item={registro} onClose={() => setRegistro(null)} />}
      {verAccesos && <BitacoraAccesos titulo={`Accesos a la historia de ${p.nombre}`} jugadorId={p.id} onClose={() => setVerAccesos(false)} />}
    </div>
  )
}

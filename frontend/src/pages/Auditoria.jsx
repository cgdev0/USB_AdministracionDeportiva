// Auditoría (v2.9, T2.7 del plan de historia clínica; D12 y D13). Exclusiva del administrador.
// En un solo lugar, sin contenido clínico: qué se hizo con las personas y las cuentas, las cargas masivas, las
// aceptaciones de los avisos, quién tiene la aceptación pendiente, los accesos a la historia clínica y los ajustes
// (como encender la regla D2 cuando el docente apruebe los formatos). Todo se puede filtrar y exportar a CSV.
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../services/api'
import EncabezadoPagina from '../components/EncabezadoPagina'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'
import BitacoraAccesos from '../components/BitacoraAccesos'
import { EstadoVacio, EstadoError, Esqueleto } from '../components/EstadoVista'
import { ROLES } from '../config/navegacion'
import { fechaLarga } from '../utils/fechas'

const PESTANAS = [
  ['actividad', 'Actividad'], ['cargas', 'Cargas masivas'], ['aceptaciones', 'Aceptaciones'],
  ['pendientes', 'Pendientes'], ['historia', 'Historia clínica'], ['ajustes', 'Ajustes'],
]
const ACCIONES = [
  ['', 'Todas las acciones'], ['crear', 'Altas'], ['cambiar_rol', 'Cambios de rol'], ['editar', 'Ediciones'],
  ['restablecer_clave', 'Contraseñas restablecidas'], ['desactivar', 'Cuentas desactivadas'], ['activar', 'Cuentas reactivadas'],
  ['retirar', 'Retiros del plantel'], ['reactivar', 'Reincorporaciones'], ['eliminar', 'Eliminaciones'], ['importar', 'Cargas masivas'],
  ['sesion_fallida', 'Inicios de sesión fallidos'], ['sesion_bloqueada', 'Bloqueos por intentos'], ['ajuste', 'Ajustes'], ['exportar', 'Exportaciones'],
]
const AVISO = { compromiso_personal: 'el compromiso del personal', aviso_deportista: 'el aviso de privacidad', declaracion_registro: 'la declaración de registro', declaracion_carga: 'la declaración de una carga' }
const VIA = { cuenta: 'en su cuenta', tableta: 'en la tableta del profesional', papel: 'con la autorización firmada', registro: 'al registrar al deportista', carga: 'en una carga masiva' }
const AJUSTES = {
  exigir_consentimiento_atencion: {
    titulo: 'Exigir el consentimiento de atención firmado para iniciar una valoración',
    ayuda: 'Regla D2 del plan de historia clínica. Enciéndela cuando el docente de salud apruebe los formatos de consentimiento: desde entonces, sin el consentimiento de atención firmado no se podrá abrir una valoración.',
  },
}
const rol = (r) => ROLES[r] || r || ''
const cuando = (valor) => {
  const f = new Date(valor)
  return `${fechaLarga(f)} de ${f.getFullYear()} · ${f.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}`
}
const corto = (sha) => (sha ? `${String(sha).slice(0, 10)}…` : '')
const siNo = (v) => (v === true ? 'encendido' : v === false ? 'apagado' : String(v))

// Lo que pasó, en una frase
export function fraseEvento(e) {
  const d = e.detalle || {}
  const quien = d.nombre ? ` ${d.nombre}` : e.recurso_id ? ` #${e.recurso_id}` : ''
  switch (`${e.accion}:${e.recurso}`) {
    case 'crear:usuario': return `creó la cuenta de${quien}${d.rol ? ` (${rol(d.rol)})` : ''}`
    case 'crear:deportista': return `registró al deportista${quien}${d.desde === 'cuenta' ? ' con su cuenta' : ''}`
    case 'cambiar_rol:usuario': return `cambió el rol de${quien}: ${rol(d.cambios?.rol?.antes)} → ${rol(d.cambios?.rol?.despues)}`
    case 'editar:usuario': return `editó la cuenta de${quien}${Object.keys(d.cambios || {}).length ? ` (${Object.keys(d.cambios).join(', ')})` : ''}`
    case 'restablecer_clave:usuario': return `restableció la contraseña de${quien}`
    case 'desactivar:usuario': return `desactivó la cuenta de${quien}`
    case 'activar:usuario': return `reactivó la cuenta de${quien}`
    case 'eliminar:deportista': return `eliminó al deportista${quien}`
    case 'retirar:deportista': return `retiró del plantel a${quien}${d.motivo ? ` (${d.motivo})` : ''}`
    case 'reactivar:deportista': return `reincorporó al plantel a${quien}`
    case 'importar:carga': return `cargó ${d.archivo || 'un archivo'} (${d.tipo}): ${d.creadas} creados, ${d.rechazadas} rechazados`
    case 'sesion_fallida:sesion': return `Inicio de sesión fallido con «${d.intento || 'sin usuario'}»`
    case 'sesion_bloqueada:sesion': return `Inicio de sesión bloqueado por intentos con «${d.intento || 'sin usuario'}»`
    case 'ajuste:ajuste': return `cambió «${AJUSTES[d.clave]?.titulo || d.clave}»: ${siNo(d.antes)} → ${siNo(d.despues)}`
    case 'exportar:auditoria': return `exportó la auditoría (${d.fuente}, ${d.filas} filas)`
    default: return `${e.accion} ${e.recurso}${quien}`
  }
}

async function descargarCsv(fuente, filtros) {
  try {
    const r = await api.get('/auditoria/exportar', { params: { fuente, ...filtros }, responseType: 'blob', timeout: 60000 })
    const url = URL.createObjectURL(r.data)
    const a = document.createElement('a')
    a.href = url
    a.download = `auditoria-${fuente}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 30000)
    toast.success('Exportación descargada (queda registrada en la auditoría)')
  } catch (e) {
    toast.error(e.message)
  }
}

// Una lista con filtros de texto y fechas, y exportación
function usarLista(ruta, filtrosIniciales = {}) {
  const [filtros, setFiltros] = useState({ q: '', desde: '', hasta: '', ...filtrosIniciales })
  const [filas, setFilas] = useState(null)
  const [error, setError] = useState(null)
  const espera = useRef(null)
  useEffect(() => {
    clearTimeout(espera.current)
    espera.current = setTimeout(() => {
      const params = Object.fromEntries(Object.entries(filtros).filter(([, v]) => v !== ''))
      setError(null)
      api.get(ruta, { params }).then(r => setFilas(r.data)).catch(e => { setError(e.message); setFilas([]) })
    }, 250)
    return () => clearTimeout(espera.current)
  }, [ruta, filtros])
  const cambiar = (campo) => (e) => setFiltros(f => ({ ...f, [campo]: e.target.value }))
  const activos = Object.fromEntries(Object.entries(filtros).filter(([, v]) => v !== ''))
  return { filtros, cambiar, filas, error, activos }
}

function Filtros({ lista, id, extra, fuente }) {
  return (
    <div className="aud-filtros">
      <div className="form-group">
        <label htmlFor={`${id}-q`}>Buscar persona</label>
        <input id={`${id}-q`} type="search" value={lista.filtros.q} onChange={lista.cambiar('q')} placeholder="Nombre o correo" />
      </div>
      {extra}
      <div className="form-group">
        <label htmlFor={`${id}-desde`}>Desde</label>
        <input id={`${id}-desde`} type="date" value={lista.filtros.desde} onChange={lista.cambiar('desde')} />
      </div>
      <div className="form-group">
        <label htmlFor={`${id}-hasta`}>Hasta</label>
        <input id={`${id}-hasta`} type="date" value={lista.filtros.hasta} onChange={lista.cambiar('hasta')} />
      </div>
      {fuente && (
        <button type="button" className="btn btn-secondary aud-exportar" onClick={() => descargarCsv(fuente, lista.activos)}>
          <i className="fa-solid fa-file-csv" aria-hidden="true"></i> Exportar CSV
        </button>
      )}
    </div>
  )
}

function Lista({ lista, vacio, children }) {
  if (lista.error) return <EstadoError compacto mensaje={lista.error} />
  if (lista.filas === null) return <Esqueleto tipo="panel" filas={5} etiqueta="Cargando…" />
  if (!lista.filas.length) return <EstadoVacio compacto icono="fa-magnifying-glass" titulo="Sin registros" descripcion={vacio} />
  return <ol className="aud-lista">{lista.filas.map(children)}</ol>
}

function Actividad({ onVerCarga }) {
  const lista = usarLista('/auditoria/eventos', { accion: '' })
  return (
    <>
      <Filtros lista={lista} id="aud-ev" fuente="eventos" extra={(
        <div className="form-group">
          <label htmlFor="aud-ev-accion">Acción</label>
          <select id="aud-ev-accion" value={lista.filtros.accion} onChange={lista.cambiar('accion')}>
            {ACCIONES.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
          </select>
        </div>
      )} />
      <Lista lista={lista} vacio="Aún no hay actividad con esos filtros.">
        {e => (
          <li key={e.id} className={e.recurso === 'sesion' ? 'aud-alerta' : undefined}>
            <p>{e.usuario_nombre ? <><strong>{e.usuario_nombre}</strong> <span className="texto-suave">({rol(e.usuario_rol)})</span> </> : null}{fraseEvento(e)}
              {e.recurso === 'carga' && e.recurso_id ? <> · <button type="button" className="btn-enlace" onClick={() => onVerCarga(e.recurso_id)}>Ver carga</button></> : null}</p>
            <small className="texto-suave">{cuando(e.creado_en)}{e.ip ? ` · IP ${e.ip}` : ''}</small>
          </li>
        )}
      </Lista>
    </>
  )
}

function Cargas({ onVerCarga }) {
  const lista = usarLista('/auditoria/cargas')
  return (
    <>
      <Filtros lista={lista} id="aud-ca" fuente="cargas" />
      <Lista lista={lista} vacio="Aún no se han hecho cargas masivas.">
        {c => (
          <li key={c.id}>
            <p><strong>{c.usuario_nombre}</strong> <span className="texto-suave">({rol(c.usuario_rol)})</span> cargó <strong>{c.archivo_nombre || 'un archivo'}</strong> de {c.tipo}:
              {' '}{c.creadas} {c.creadas === 1 ? 'creado' : 'creados'}, {c.rechazadas} {c.rechazadas === 1 ? 'rechazado' : 'rechazados'} de {c.filas_total} filas</p>
            <small className="texto-suave">{cuando(c.creado_en)}{c.archivo_sha256 ? ` · huella ${corto(c.archivo_sha256)}` : ''}</small>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onVerCarga(c.id)} aria-label={`Ver la carga ${c.archivo_nombre || c.id}`}>Ver detalle</button>
          </li>
        )}
      </Lista>
    </>
  )
}

function DetalleCarga({ id, onClose }) {
  const [c, setC] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => { api.get(`/auditoria/cargas/${id}`).then(r => setC(r.data)).catch(e => setError(e.message)) }, [id])
  return (
    <Modal title={c ? `Carga masiva: ${c.archivo_nombre || `#${c.id}`}` : 'Carga masiva'} onClose={onClose}>
      {error ? <p className="alerta alerta-error" role="alert">{error}</p> : !c ? <p className="ayuda-campo">Cargando…</p> : (
        <div className="aud-detalle">
          <dl className="ficha-datos">
            <div><dt>Quién</dt><dd>{c.usuario_nombre} ({rol(c.usuario_rol)})</dd></div>
            <div><dt>Cuándo</dt><dd>{cuando(c.creado_en)}</dd></div>
            <div><dt>Tipo</dt><dd>{c.tipo === 'usuarios' ? 'Usuarios' : 'Deportistas'}</dd></div>
            <div><dt>Huella del archivo</dt><dd><code>{c.archivo_sha256 || 'sin huella'}</code></dd></div>
            <div><dt>Resultado</dt><dd>{c.filas_total} filas: {c.creadas} creados, {c.rechazadas} rechazados</dd></div>
            <div><dt>Declaración</dt><dd>{c.declaracion ? `Aceptada por ${c.declaracion.usuario_nombre} (versión ${c.declaracion.version})` : '—'}</dd></div>
          </dl>
          <h4>Creados ({c.creados.length})</h4>
          {c.creados.length ? <ul className="aud-nombres">{c.creados.map(x => <li key={x.id}>{x.nombre}</li>)}</ul> : <p className="ayuda-campo">Ninguno.</p>}
          <h4>Filas rechazadas ({c.errores.length})</h4>
          {c.errores.length ? <ul className="aud-nombres">{c.errores.map((e, i) => <li key={i}>Fila {e.fila}: {e.error}</li>)}</ul> : <p className="ayuda-campo">Ninguna.</p>}
        </div>
      )}
    </Modal>
  )
}

function Aceptaciones() {
  const lista = usarLista('/auditoria/aceptaciones', { aviso: '', via: '' })
  return (
    <>
      <Filtros lista={lista} id="aud-ac" fuente="aceptaciones" extra={<>
        <div className="form-group">
          <label htmlFor="aud-ac-aviso">Aviso</label>
          <select id="aud-ac-aviso" value={lista.filtros.aviso} onChange={lista.cambiar('aviso')}>
            <option value="">Todos</option>
            {Object.entries(AVISO).map(([v, n]) => <option key={v} value={v}>{n.replace(/^(el|la) /, '')}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="aud-ac-via">Cómo</label>
          <select id="aud-ac-via" value={lista.filtros.via} onChange={lista.cambiar('via')}>
            <option value="">Todas</option>
            {Object.entries(VIA).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
          </select>
        </div>
      </>} />
      <Lista lista={lista} vacio="Aún no hay aceptaciones con esos filtros.">
        {a => (
          <li key={a.id}>
            <p><strong>{a.aceptante_nombre || a.usuario_nombre || 'Sin nombre'}</strong>{a.usuario_rol && !a.testigo_nombre ? <span className="texto-suave"> ({rol(a.usuario_rol)})</span> : null}
              {' '}aceptó {AVISO[a.aviso] || a.aviso} {VIA[a.via] || a.via}
              {a.jugador_nombre ? <> · deportista <strong>{a.jugador_nombre}</strong></> : null}
              {a.testigo_nombre ? <> · testigo {a.testigo_nombre}</> : null}</p>
            <small className="texto-suave">{cuando(a.aceptado_en)} · versión {a.version} · huella {corto(a.texto_sha256)}{a.ip ? ` · IP ${a.ip}` : ''}</small>
          </li>
        )}
      </Lista>
    </>
  )
}

function Pendientes() {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => { api.get('/auditoria/pendientes').then(r => setDatos(r.data)).catch(e => setError(e.message)) }, [])
  if (error) return <EstadoError compacto mensaje={error} />
  if (!datos) return <Esqueleto tipo="panel" filas={5} etiqueta="Cargando…" />
  return (
    <div className="aud-pendientes">
      <section aria-labelledby="aud-pend-personal">
        <h3 id="aud-pend-personal">Personal que no ha aceptado su compromiso <span className="pend-conteo">{datos.personal.length}</span></h3>
        {datos.personal.length === 0 ? <p className="ayuda-campo">Todo el personal activo aceptó la versión vigente.</p> : (
          <ul className="aud-nombres">{datos.personal.map(u => <li key={u.id}><strong>{u.nombre}</strong> <span className="texto-suave">· {rol(u.rol)} · {u.email}</span></li>)}</ul>
        )}
        <p className="ayuda-campo">Lo verán al entrar; mientras no lo acepten, no pueden consultar ni registrar datos.</p>
      </section>
      <section aria-labelledby="aud-pend-deportistas">
        <h3 id="aud-pend-deportistas">Deportistas a los que les falta su aceptación <span className="pend-conteo">{datos.deportistas.length}</span></h3>
        {datos.deportistas.length === 0 ? <p className="ayuda-campo">Ningún deportista registrado desde la v2.9 tiene la aceptación pendiente.</p> : (
          <ul className="aud-nombres">{datos.deportistas.map(j => <li key={j.id}><strong>{j.nombre}</strong> <span className="texto-suave">· {j.disciplina_nombre || 'sin deporte'} · {j.autorizacion === 'sin_declaracion' ? 'sin autorización registrada' : 'falta su aceptación'}</span></li>)}</ul>
        )}
        <p className="ayuda-campo">Solo se avisa: la acepta en su cuenta, en la tableta del profesional o con la autorización firmada. Los deportistas de demostración no aparecen.</p>
      </section>
    </div>
  )
}

function Ajustes() {
  const [ajustes, setAjustes] = useState(null)
  const [error, setError] = useState(null)
  const [confirmar, setConfirmar] = useState(null) // { clave, valor }
  const [guardando, setGuardando] = useState(false)
  useEffect(() => { api.get('/auditoria/ajustes').then(r => setAjustes(r.data)).catch(e => setError(e.message)) }, [])
  const cambiar = async () => {
    setGuardando(true)
    try {
      const { data } = await api.put('/auditoria/ajustes', { [confirmar.clave]: confirmar.valor })
      setAjustes(data)
      toast.success('Ajuste guardado (queda registrado en la auditoría)')
    } catch (e) { toast.error(e.message) } finally { setGuardando(false); setConfirmar(null) }
  }
  if (error) return <EstadoError compacto mensaje={error} />
  if (!ajustes) return <Esqueleto tipo="panel" filas={3} etiqueta="Cargando…" />
  return (
    <ul className="aud-ajustes">
      {Object.entries(AJUSTES).map(([clave, def]) => {
        const a = ajustes[clave] || { valor: false }
        return (
          <li key={clave} className="card">
            <div className="aud-ajuste-cabecera">
              <strong id={`aj-${clave}`}>{def.titulo}</strong>
              <span className={`badge ${a.valor ? 'badge-green' : 'badge-neutro'}`}>{a.valor ? 'Encendido' : 'Apagado'}</span>
            </div>
            <p className="ayuda-campo">{def.ayuda}</p>
            {a.actualizado_por && <small className="texto-suave">Último cambio: {a.actualizado_por}, {cuando(a.actualizado_en)}</small>}
            <button type="button" className={`btn ${a.valor ? 'btn-secondary' : 'btn-primary'}`} aria-describedby={`aj-${clave}`}
              onClick={() => setConfirmar({ clave, valor: !a.valor })}>{a.valor ? 'Apagar' : 'Encender'}</button>
          </li>
        )
      })}
      <ConfirmModal isOpen={!!confirmar} title={confirmar?.valor ? '¿Encender la regla?' : '¿Apagar la regla?'}
        message={confirmar?.valor ? 'Desde ahora, sin el consentimiento de atención firmado no se podrá iniciar una valoración. Hazlo solo si el docente de salud ya aprobó los formatos.' : 'Se podrán iniciar valoraciones sin el consentimiento de atención firmado.'}
        confirmText={confirmar?.valor ? 'Sí, encender' : 'Sí, apagar'} cancelText="Cancelar" confirmVariant="primary" loading={guardando}
        onConfirm={cambiar} onCancel={() => setConfirmar(null)} />
    </ul>
  )
}

export default function Auditoria() {
  const [pestana, setPestana] = useState('actividad')
  const [carga, setCarga] = useState(null)
  const refs = useRef({})
  const teclas = (e, i) => {
    const paso = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!paso) return
    e.preventDefault()
    const siguiente = PESTANAS[(i + paso + PESTANAS.length) % PESTANAS.length][0]
    setPestana(siguiente)
    refs.current[siguiente]?.focus()
  }
  return (
    <div>
      <EncabezadoPagina icono="fa-user-shield" antetitulo="Gestión" titulo="Auditoría"
        descripcion="Quién hizo qué con las personas, las cuentas y los datos, y cuándo. Nada de esto se puede modificar ni borrar." />
      <div className="ficha-pestanas aud-pestanas" role="tablist" aria-label="Secciones de la auditoría">
        {PESTANAS.map(([clave, nombre], i) => (
          <button key={clave} type="button" role="tab" id={`aud-tab-${clave}`} aria-controls={`aud-panel-${clave}`} aria-selected={pestana === clave}
            tabIndex={pestana === clave ? 0 : -1} ref={el => { refs.current[clave] = el }} onClick={() => setPestana(clave)} onKeyDown={e => teclas(e, i)}>
            {nombre}
          </button>
        ))}
      </div>
      <section className="card aud-panel" role="tabpanel" id={`aud-panel-${pestana}`} aria-labelledby={`aud-tab-${pestana}`}>
        {pestana === 'actividad' && <Actividad onVerCarga={setCarga} />}
        {pestana === 'cargas' && <Cargas onVerCarga={setCarga} />}
        {pestana === 'aceptaciones' && <Aceptaciones />}
        {pestana === 'pendientes' && <Pendientes />}
        {pestana === 'historia' && <BitacoraAccesos enLinea general />}
        {pestana === 'ajustes' && <Ajustes />}
      </section>
      {carga && <DetalleCarga id={carga} onClose={() => setCarga(null)} />}
    </div>
  )
}

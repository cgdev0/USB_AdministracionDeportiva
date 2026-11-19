// Formatos de consentimiento para imprimir (v2.9, T2.2 del plan de historia clínica). 🩺
// Hoja carta lista para firmar a mano, con espacio para la firma, el documento y la huella:
//  - /pacientes/:id/formatos/:tipo   con los datos del deportista (y de su acudiente, si es menor) ya diligenciados;
//  - /formatos-consentimiento/:tipo  en blanco, para revisar los textos o tener copias a mano.
// :tipo es atencion, datos_personales, investigacion, asentimiento o todos.
// Los textos son BORRADORES hasta que los apruebe el docente (frontend/src/utils/formatosConsentimiento.js).
// Se muestra sin el menú de la aplicación, para imprimir solo la hoja; el bloqueo por inactividad sigue activo.
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../services/api'
import BloqueoInactividad from '../components/BloqueoInactividad'
import { Esqueleto, EstadoError } from '../components/EstadoVista'
import { FORMATOS, formatoDe, partesDelTexto } from '../utils/formatosConsentimiento'
import { VERSION_FORMATO } from '../utils/consentimientos'
import { tipoDocumento } from '../utils/identificacion'

const NOMBRES = { atencion: 'Atención', datos_personales: 'Datos personales', investigacion: 'Investigación', asentimiento: 'Asentimiento', todos: 'Los cuatro' }

function Texto({ children }) {
  return partesDelTexto(children).map((p, i) => (p.completar ? <mark key={i} className="fc-completar">{p.texto}</mark> : <span key={i}>{p.texto}</span>))
}
const documento = (tipo, numero) => (numero ? `${tipoDocumento(tipo)?.nombre || tipo || ''} ${numero}`.trim() : '')

function Dato({ etiqueta, valor, ancho = 1 }) {
  return (
    <div className="fc-dato" style={{ gridColumn: `span ${ancho}` }}>
      <span className="fc-dato-etiqueta">{etiqueta}</span>
      <span className="fc-dato-valor">{valor || ' '}</span>
    </div>
  )
}

function Firma({ titulo, nombre, doc, huella = false, detalle = 'Documento' }) {
  return (
    <div className={`fc-firma${huella ? ' con-huella' : ''}`}>
      <div>
        <div className="fc-linea-firma"></div>
        <p className="fc-firma-titulo">{titulo}</p>
        <p>Nombre: <span className="fc-relleno">{nombre || ' '}</span></p>
        <p>{detalle}: <span className="fc-relleno">{doc || ' '}</span></p>
      </div>
      {huella && <div className="fc-huella" aria-label="Espacio para la huella">Huella<br />índice derecho</div>}
    </div>
  )
}

function Hoja({ formato, p }) {
  const menor = !!p?.menor
  const acudiente = p && menor
  const esAsentimiento = formato.tipo === 'asentimiento'
  const titular = esAsentimiento ? 'el deportista' : (p ? (menor ? 'el acudiente (representante legal)' : 'el deportista') : 'el deportista o su representante legal')
  return (
    <article className="fc-hoja" aria-label={formato.titulo}>
      <header className="fc-cabecera">
        <img src="/brand/logo-horizontal-verde.png" alt="Universidad Simón Bolívar" />
        <div>
          <p className="fc-sede">Sede Cúcuta · Administración Deportiva · Área de salud</p>
          <h1>{formato.titulo}</h1>
          <p className="fc-normas">{formato.normas}</p>
        </div>
      </header>
      <p className="fc-borrador">BORRADOR PARA REVISIÓN: no es un formato aprobado. Deben revisarlo el docente de salud y la universidad antes de usarlo.</p>

      <section className="fc-datos" aria-label="Datos de quien firma">
        <Dato etiqueta="Deportista" valor={p?.nombre} ancho={2} />
        <Dato etiqueta="Documento" valor={p && documento(p.tipo_documento, p.numero_documento)} />
        <Dato etiqueta="Edad" valor={p?.edad != null ? `${p.edad} años` : ''} />
        <Dato etiqueta="Deporte y equipo" valor={p && [p.disciplina_nombre, p.equipo_nombre].filter(Boolean).join(' · ')} ancho={2} />
        <Dato etiqueta="Teléfono" valor={p?.telefono} />
        <Dato etiqueta="EPS" valor={p?.eps} />
        {(!p || menor) && (
          <>
            <Dato etiqueta={p || formato.soloMenores ? 'Acudiente (representante legal)' : 'Si es menor de edad: acudiente'} valor={acudiente ? p.acudiente_nombre : ''} ancho={2} />
            <Dato etiqueta="Documento del acudiente" valor={acudiente ? documento(p.acudiente_tipo_documento, p.acudiente_numero_documento) : ''} />
            <Dato etiqueta="Parentesco" valor={acudiente ? p.acudiente_parentesco : ''} />
          </>
        )}
      </section>

      {!esAsentimiento && (
        <p className="fc-declaracion">
          Yo, quien firma este documento como {titular}, declaro que me explicaron en lenguaje claro lo que sigue, que pude hacer
          preguntas y que me las respondieron.
        </p>
      )}
      <div className="fc-secciones">
        {formato.secciones.map(([titulo, texto]) => (
          <p key={titulo}><strong>{/[?!.]$/.test(titulo) ? titulo : `${titulo}.`} </strong><Texto>{texto}</Texto></p>
        ))}
      </div>

      <section className="fc-decisiones" aria-label="Decisión">
        {formato.decisiones.map(([pregunta, si, no]) => (
          <div key={pregunta} className="fc-decision">
            <span>{pregunta}</span>
            <span className="fc-opciones"><span className="fc-casilla" aria-hidden="true"></span> {si} <span className="fc-casilla" aria-hidden="true"></span> {no}</span>
          </div>
        ))}
      </section>

      <p className="fc-lugar">Lugar y fecha: Cúcuta, día ______ del mes de ____________________ de ________</p>
      <section className="fc-firmas" aria-label="Firmas">
        {esAsentimiento ? (
          <>
            <Firma titulo="Firma del deportista (menor de edad)" nombre={p?.nombre} doc={p && documento(p.tipo_documento, p.numero_documento)} />
            <Firma titulo="Firma del acudiente presente" nombre={acudiente ? p.acudiente_nombre : ''} doc={acudiente ? documento(p.acudiente_tipo_documento, p.acudiente_numero_documento) : ''} />
            <Firma titulo="Firma de quien explica" detalle="Profesión y vínculo (profesional, practicante o estudiante)" />
          </>
        ) : (
          <>
            <Firma titulo={`Firma ${titular.replace(/^el /, 'del ')}`} huella
              nombre={p ? (menor ? p.acudiente_nombre : p.nombre) : ''}
              doc={p ? (menor ? documento(p.acudiente_tipo_documento, p.acudiente_numero_documento) : documento(p.tipo_documento, p.numero_documento)) : ''} />
            <Firma titulo="Firma de quien explica y recibe" detalle="Profesión y vínculo (profesional, practicante o estudiante)" />
          </>
        )}
      </section>
      <footer className="fc-pie">
        <span>Versión del formato: {VERSION_FORMATO}</span>
        <span>Este documento hace parte de la historia clínica del deportista.</span>
      </footer>
    </article>
  )
}

export default function FormatoConsentimiento() {
  const { id, tipo = 'todos' } = useParams()
  const navegar = useNavigate()
  const [paciente, setPaciente] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!id) return
    setPaciente(null); setError(null)
    api.get(`/pacientes/${id}`).then(r => setPaciente(r.data.paciente)).catch(setError)
  }, [id])

  const base = id ? `/pacientes/${id}/formatos` : '/formatos-consentimiento'
  const pedidos = tipo === 'todos' ? FORMATOS : [formatoDe(tipo)].filter(Boolean)
  // El asentimiento solo aplica a menores de edad
  const hojas = paciente && !paciente.menor ? pedidos.filter(f => !f.soloMenores) : pedidos
  const noAplica = paciente && !paciente.menor && tipo === 'asentimiento'

  let contenido
  if (!pedidos.length) contenido = <div className="card"><EstadoError titulo="Ese formato no existe" mensaje="Elige uno de los formatos de arriba." /></div>
  else if (error) contenido = <div className="card"><EstadoError mensaje={error.message} onReintentar={() => navegar(0)} /></div>
  else if (id && !paciente) contenido = <div className="card" style={{ padding: 0 }}><Esqueleto tipo="panel" filas={8} etiqueta="Preparando el formato…" /></div>
  else if (noAplica) contenido = <div className="card"><p>{paciente.nombre} es mayor de edad: el asentimiento solo se firma cuando el deportista es menor.</p></div>
  else contenido = hojas.map(f => <Hoja key={f.tipo} formato={f} p={paciente} />)

  return (
    <div className="fc">
      <div className="fc-barra no-imprimir">
        <Link className="btn btn-ghost" to={id ? `/pacientes/${id}` : '/pacientes'}>
          <i className="fa-solid fa-chevron-left" aria-hidden="true"></i> {id ? 'Volver a la ficha' : 'Pacientes'}
        </Link>
        <nav className="pacientes-filtros" aria-label="Formatos">
          {[...FORMATOS.map(f => f.tipo), 'todos'].map(t => (
            <Link key={t} className="chip-filtro" to={`${base}/${t}`} aria-current={t === tipo ? 'page' : undefined}>{NOMBRES[t]}</Link>
          ))}
        </nav>
        <button type="button" className="btn btn-primary" onClick={() => window.print()} disabled={!!id && !paciente}>
          <i className="fa-solid fa-print" aria-hidden="true"></i> Imprimir
        </button>
      </div>
      <p className="fc-aviso no-imprimir">
        {id ? 'Los datos del deportista ya están diligenciados. ' : 'Formato en blanco. '}
        Imprime en hoja carta, sin márgenes adicionales. Al firmar, toma una foto del papel y regístrala en la pestaña de consentimientos de la ficha.
      </p>
      {contenido}
      <BloqueoInactividad />
    </div>
  )
}

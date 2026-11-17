// Fecha y hora de un entrenamiento o partido (v2.6).
// En lugar del selector de fecha y hora del navegador, el sistema muestra un calendario propio, sin días pasados,
// y los botones de las horas que el servidor reporta como disponibles (de 6:00 a. m. a 10:00 p. m., cada 30 minutos,
// sin las que ya pasaron ni las que el equipo ya tiene ocupadas). El servidor aplica las mismas reglas al guardar.
import { useEffect, useState } from 'react'
import api from '../services/api'
import { hoyISO, fechaLarga } from '../utils/fechas'

const DIAS = [['L', 'lunes'], ['M', 'martes'], ['X', 'miércoles'], ['J', 'jueves'], ['V', 'viernes'], ['S', 'sábado'], ['D', 'domingo']]
const aIso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const mesDe = (iso) => ({ y: Number(iso.slice(0, 4)), m: Number(iso.slice(5, 7)) - 1 })
const indice = ({ y, m }) => y * 12 + m
const nombreMes = ({ y, m }) => new Date(y, m, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })

// '17:30' → '5:30 p. m.'
export function horaLegible(hora) {
  if (!hora) return ''
  const [h, m] = hora.split(':').map(Number)
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`
}

const FRANJAS = [['Mañana', h => h < '12:00'], ['Tarde', h => h >= '12:00' && h < '18:00'], ['Noche', h => h >= '18:00']]

export default function SelectorFechaHora({ fecha, hora, equipoId, tabla, idActual, original = {}, onChange }) {
  const hoy = hoyISO()
  // Fecha y hora guardadas del registro que se edita: se pueden conservar aunque ya hayan pasado
  const fechaOriginal = original.fecha || null
  const horaOriginal = original.hora || null
  const [mes, setMes] = useState(mesDe(fecha || hoy))
  const [horas, setHoras] = useState(null) // null mientras se consulta
  const [fallo, setFallo] = useState(false)

  useEffect(() => {
    if (!fecha) return undefined
    let vivo = true
    setHoras(null)
    setFallo(false)
    api.get(`/${tabla}/horas-disponibles`, { params: { fecha, equipo_id: equipoId || undefined, id: idActual || undefined } })
      .then(({ data }) => { if (vivo) setHoras(data.horas) })
      .catch(() => { if (vivo) { setHoras([]); setFallo(true) } })
    return () => { vivo = false }
  }, [fecha, equipoId, tabla, idActual])

  const conservaOriginal = (h) => fecha === fechaOriginal && h === horaOriginal

  // Si la hora elegida deja de estar disponible (cambió el día o el equipo), se quita la selección
  useEffect(() => {
    if (!horas || !hora || conservaOriginal(hora)) return
    if (!horas.some(x => x.hora === hora && x.disponible)) onChange('hora', '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horas])

  // ── Calendario ──
  const minimo = fechaOriginal && fechaOriginal < hoy ? mesDe(fechaOriginal) : mesDe(hoy)
  const puedeAtras = indice(mes) > indice(minimo)
  const mover = (delta) => setMes(({ y, m }) => { const t = y * 12 + m + delta; return { y: Math.floor(t / 12), m: t % 12 } })
  const vacios = (new Date(mes.y, mes.m, 1).getDay() + 6) % 7 // la semana empieza el lunes
  const diasDelMes = new Date(mes.y, mes.m + 1, 0).getDate()
  const elegirDia = (valor) => { if (valor !== fecha) onChange('fecha', valor) }

  // ── Horas ──
  const libres = (horas || []).filter(x => x.disponible).map(x => x.hora)
  const ocupadas = (horas || []).filter(x => x.motivo === 'ocupada').map(x => x.hora)
  // La hora guardada se ofrece aunque ya no esté en la lista (registro antiguo o día ya pasado)
  if (horaOriginal && fecha === fechaOriginal && !libres.includes(horaOriginal)) libres.push(horaOriginal)
  libres.sort()
  const boton = (h) => (
    <button key={h} type="button" className="selector-hora" aria-pressed={hora === h} onClick={() => onChange('hora', hora === h ? '' : h)}>
      {horaLegible(h)}
    </button>
  )

  return (
    <div className="selector-fecha-hora">
      <div className="selector-calendario" role="group" aria-labelledby="sfh-titulo-fecha">
        <div className="selector-calendario-cabecera">
          <span id="sfh-titulo-fecha" className="selector-etiqueta">Fecha *</span>
          <div className="selector-mes">
            <button type="button" className="btn btn-ghost btn-icon" onClick={() => mover(-1)} disabled={!puedeAtras} aria-label="Mes anterior">
              <i className="fa-solid fa-chevron-left" aria-hidden="true"></i>
            </button>
            <strong aria-live="polite">{nombreMes(mes)}</strong>
            <button type="button" className="btn btn-ghost btn-icon" onClick={() => mover(1)} aria-label="Mes siguiente">
              <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
            </button>
          </div>
        </div>
        <div className="selector-dias">
          {DIAS.map(([corto, largo]) => <abbr key={largo} title={largo} className="selector-dia-semana">{corto}</abbr>)}
          {Array.from({ length: vacios }, (_, i) => <span key={`v${i}`} aria-hidden="true" />)}
          {Array.from({ length: diasDelMes }, (_, i) => {
            const valor = aIso(mes.y, mes.m, i + 1)
            const habilitado = valor >= hoy || valor === fechaOriginal
            return (
              <button key={valor} type="button" className={`selector-dia${valor === hoy ? ' hoy' : ''}`}
                disabled={!habilitado} aria-pressed={valor === fecha} aria-label={fechaLarga(valor)}
                onClick={() => elegirDia(valor)}>
                {i + 1}
              </button>
            )
          })}
        </div>
      </div>

      <div className="selector-horas" role="group" aria-labelledby="sfh-titulo-hora">
        <span id="sfh-titulo-hora" className="selector-etiqueta">
          Hora {fecha ? <small>· {fechaLarga(fecha)}</small> : null}
        </span>
        {!fecha && <p className="selector-nota">Elige primero el día.</p>}
        {fecha && horas === null && <p className="selector-nota">Consultando horas disponibles…</p>}
        {fecha && fallo && <p className="selector-nota error">No se pudieron consultar las horas. Revisa la conexión e intenta de nuevo.</p>}
        {fecha && horas !== null && !fallo && (
          <>
            {libres.length === 0
              ? <p className="selector-nota">No quedan horas disponibles este día. Elige otro día.</p>
              : FRANJAS.map(([nombre, enFranja]) => {
                const lista = libres.filter(enFranja)
                return lista.length ? (
                  <div key={nombre} className="selector-franja">
                    <span className="selector-franja-nombre">{nombre}</span>
                    <div className="selector-horas-lista">{lista.map(boton)}</div>
                  </div>
                ) : null
              })}
            <div className="selector-horas-lista">
              <button type="button" className="selector-hora sin-hora" aria-pressed={!hora} onClick={() => onChange('hora', '')}>Sin hora definida</button>
            </div>
            {ocupadas.length > 0 && (
              <p className="selector-nota">El equipo ya tiene actividades a las {ocupadas.map(horaLegible).join(', ')}.</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

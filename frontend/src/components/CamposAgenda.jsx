// Equipo, hora y lugar de un entrenamiento o partido (v1.7: agenda por equipo).
// El administrador puede elegir cualquier equipo; el entrenador, solo los equipos donde tiene deportistas
// (el servidor aplica la misma regla). Sin equipo, la actividad es general y la ven todos.
import { useEffect, useState } from 'react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

// Solo lo usan quienes crean o editan la agenda (administrador y entrenador); los demás roles no consultan equipos
export function useEquiposAsignables(activo = true) {
  const { usuario } = useAuth()
  const [equipos, setEquipos] = useState([])
  useEffect(() => {
    if (!activo) return undefined
    let vivo = true
    Promise.all([api.get('/equipos'), usuario?.rol === 'administrador' ? null : api.get('/jugadores')])
      .then(([eq, jug]) => {
        if (!vivo) return
        const propios = jug ? new Set(jug.data.map(j => j.equipo_id).filter(Boolean)) : null
        setEquipos(eq.data.filter(e => !propios || propios.has(e.id)))
      })
      .catch(() => { /* sin equipos disponibles: la actividad queda general */ })
    return () => { vivo = false }
  }, [usuario?.rol, activo])
  return equipos
}

// Valores iniciales y valores desde una actividad existente
export const AGENDA_VACIA = { equipo_id: '', hora: '', lugar: '' }
export const agendaDe = (a) => ({ equipo_id: a.equipo_id ? String(a.equipo_id) : '', hora: a.hora || '', lugar: a.lugar || '' })

export default function CamposAgenda({ form, onChange, equipos, lugarEjemplo = 'Ej. Cancha sintética' }) {
  return (
    <>
      <div className="form-group">
        <label htmlFor="agenda-equipo">Equipo</label>
        <select id="agenda-equipo" name="equipo_id" value={form.equipo_id} onChange={onChange}>
          <option value="">General (todos los equipos)</option>
          {equipos.map(e => <option key={e.id} value={e.id}>{e.nombre}{e.categoria ? ` · ${e.categoria}` : ''}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label htmlFor="agenda-hora">Hora</label>
        <input id="agenda-hora" name="hora" type="time" value={form.hora} onChange={onChange} />
      </div>
      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
        <label htmlFor="agenda-lugar">Lugar</label>
        <input id="agenda-lugar" name="lugar" value={form.lugar} onChange={onChange} placeholder={lugarEjemplo} />
      </div>
    </>
  )
}

// "Equipo · Lugar · 17:30" para mostrar debajo del nombre en tablas y listas
export const resumenAgenda = (a) => [a.equipo_nombre || (a.equipo_id ? null : 'General'), a.lugar, a.hora].filter(Boolean).join(' · ')

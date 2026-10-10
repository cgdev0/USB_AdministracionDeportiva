import { useEffect, useState } from 'react'
import { Users, ShieldCheck, CalendarDays, RefreshCw } from 'lucide-react'
import api from '../services/api'
import LoadingSpinner from '../components/LoadingSpinner'
import toast from 'react-hot-toast'

export default function HeadCoach() {
  const [data, setData] = useState({ entrenadores: [], jugadores: [], total_equipos: 0, proximos_partidos: 0 })
  const [loading, setLoading] = useState(true)
  const load = async () => { setLoading(true); try { const { data } = await api.get('/head-coach/resumen'); setData(data) } catch (e) { toast.error(e.message || 'No fue posible cargar el panel') } finally { setLoading(false) } }
  useEffect(() => { load() }, [])
  if (loading) return <LoadingSpinner />
  return <div>
    <div className="page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
      <div><h2>Panel del Head Coach</h2><p>Resumen de los entrenadores y deportistas asociados</p></div>
      <button className="btn btn-secondary" onClick={load}><RefreshCw size={15}/> Actualizar</button>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:16,marginBottom:24}}>
      {[{label:'Entrenadores asociados',value:data.entrenadores.length,Icon:Users},{label:'Equipos vinculados',value:data.total_equipos,Icon:ShieldCheck},{label:'Deportistas',value:data.jugadores.length,Icon:Users},{label:'Partidos próximos (global)',value:data.proximos_partidos,Icon:CalendarDays}].map(({label,value,Icon})=><div className="card" key={label} style={{padding:18}}><Icon size={22} color="var(--accent2)"/><p style={{color:'var(--text-muted)',fontSize:13,margin:'12px 0 4px'}}>{label}</p><strong style={{fontSize:28}}>{value}</strong></div>)}
    </div>
    <div className="card" style={{padding:18,marginBottom:20}}><h3>Mis entrenadores</h3>{data.entrenadores.length===0?<p style={{color:'var(--text-muted)'}}>Todavía no tienes entrenadores asociados. Un administrador debe asignarlos desde la gestión de usuarios.</p>:<div className="table-wrapper"><table><thead><tr><th>Nombre</th><th>Correo</th></tr></thead><tbody>{data.entrenadores.map(x=><tr key={x.id}><td>{x.nombre}</td><td>{x.email}</td></tr>)}</tbody></table></div>}</div>
    <div className="card" style={{padding:18}}><h3>Deportistas de mis entrenadores</h3>{data.jugadores.length===0?<p style={{color:'var(--text-muted)'}}>No hay deportistas asignados a tus entrenadores.</p>:<div className="table-wrapper"><table><thead><tr><th>Deportista</th><th>Equipo</th><th>Entrenador</th><th>Posición</th></tr></thead><tbody>{data.jugadores.map(x=><tr key={x.id}><td>{x.nombre}</td><td>{x.equipo_nombre||'Sin equipo'}</td><td>{x.entrenador_nombre}</td><td>{x.posicion||'—'}</td></tr>)}</tbody></table></div>}</div>
  </div>
}

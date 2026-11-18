import { useEffect, useState } from 'react'
import { HeartPulse, ClipboardPlus, Bell, CalendarCheck } from 'lucide-react'
import api from '../services/api'
import toast from 'react-hot-toast'
import { Esqueleto, EstadoVacio, EstadoError } from '../components/EstadoVista'
import { useAuth } from '../context/AuthContext'
import { useFiltroDeporte } from '../context/DeporteContext'
import { etiquetaJugador, nombreConDorsal } from '../utils/jugador'
import Valoraciones from '../components/Valoraciones'

const blank = { jugador_id:'', tipo:'Control médico', fecha:'', proxima_fecha:'', resultado:'', restricciones:'', aptitud:'pendiente' }
// v2.7 (T0.3, DEF-052): la historia clínica ya no es un formulario que se sobrescribe; ahora son valoraciones
// separadas (componente Valoraciones). Las historias anteriores se migraron como la primera valoración.
export default function Salud(){
 const {usuario}=useAuth(); const filtro=useFiltroDeporte(); const [jugadores,setJugadores]=useState([]); const [controles,setControles]=useState([]); const [notificaciones,setNotificaciones]=useState([]); const [form,setForm]=useState(blank); const [loading,setLoading]=useState(true); const [error,setError]=useState(null); const staff=['administrador','personal_salud'].includes(usuario?.rol)
 const load=async()=>{setLoading(true);setError(null);try{const requests=[api.get('/salud/controles'),api.get('/salud/notificaciones')];if(staff)requests.push(api.get('/jugadores',{params:{retirados:'incluir'}}));const r=await Promise.all(requests);setControles(r[0].data);setNotificaciones(r[1].data);if(staff)setJugadores(r[2].data)}catch(e){setError(e.message)}finally{setLoading(false)}}
 useEffect(()=>{load()},[])
 const save=async(e)=>{e.preventDefault();try{await api.post('/salud/controles',form);toast.success('Control médico registrado');setForm(blank);load()}catch(e){toast.error(e.message)}}
 const read=async(id)=>{try{await api.patch(`/salud/notificaciones/${id}/leida`);setNotificaciones(n=>n.map(x=>x.id===id?{...x,leida:true}:x))}catch(e){toast.error(e.message)}}
 const cabecera=<div className="page-header"><h1><HeartPulse size={23} style={{display:'inline',marginRight:8}}/>Salud y seguimiento</h1><p>Controles médicos, aptitud deportiva y notificaciones del deportista.</p></div>
 // Filtro por el deporte de la cabecera (v1.9)
 const jugadoresV=jugadores.filter(j=>filtro.deDisciplina(j.disciplina_id)); const controlesV=controles.filter(c=>filtro.deDisciplina(c.disciplina_id))
 if(loading)return <div>{cabecera}<div className="card" style={{padding:0}}><Esqueleto tipo="panel" filas={8} etiqueta="Cargando salud…"/></div></div>
 if(error)return <div>{cabecera}<div className="card"><EstadoError mensaje={error} onReintentar={load}/></div></div>
 return <div>{cabecera}
 {/* v2.7 (T0.2): con qué datos queda registrado quien atiende (vínculo, registro y supervisor) */}
 {usuario?.quien_atiende&&<p className="quien-atiende"><i className="fa-solid fa-user-doctor" aria-hidden="true"></i> Registras como <strong>{usuario.quien_atiende.nombre}</strong> · {usuario.quien_atiende.descripcion}</p>}
 {/* v2.7 (T0.3): historia clínica secuencial. La crea y la ve el personal de salud; el deportista consulta las suyas cerradas */}
 {usuario?.rol==='personal_salud'&&<Valoraciones jugadores={jugadoresV}/>}
 {usuario?.rol==='jugador'&&<Valoraciones soloLectura/>}
 {staff&&<form className="card" onSubmit={save} style={{padding:18,marginBottom:22}}><h3><ClipboardPlus size={18} style={{display:'inline',marginRight:6}}/>Registrar control médico</h3><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12,marginTop:14}}>
 <label>Deportista<select required value={form.jugador_id} onChange={e=>setForm({...form,jugador_id:e.target.value})} style={{display:'block',width:'100%',padding:10,marginTop:5}}><option value="">Seleccionar</option>{jugadoresV.filter(j=>j.activo!==false).map(j=><option key={j.id} value={j.id}>{etiquetaJugador(j)}</option>)}</select></label>
 <label>Tipo de control<input required value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value})} style={{display:'block',width:'100%',padding:10,marginTop:5}}/></label>
 <label>Fecha<input type="date" value={form.fecha} onChange={e=>setForm({...form,fecha:e.target.value})} style={{display:'block',width:'100%',padding:10,marginTop:5}}/></label>
 <label>Próximo control<input type="date" value={form.proxima_fecha} onChange={e=>setForm({...form,proxima_fecha:e.target.value})} style={{display:'block',width:'100%',padding:10,marginTop:5}}/></label>
 <label>Aptitud<select value={form.aptitud} onChange={e=>setForm({...form,aptitud:e.target.value})} style={{display:'block',width:'100%',padding:10,marginTop:5}}><option value="pendiente">Pendiente</option><option value="apto">Apto</option><option value="apto_restricciones">Apto con restricciones</option><option value="no_apto_temporal">No apto temporalmente</option></select></label>
 <label>Restricciones<input value={form.restricciones} onChange={e=>setForm({...form,restricciones:e.target.value})} style={{display:'block',width:'100%',padding:10,marginTop:5}}/></label>
 <label style={{gridColumn:'1/-1'}}>Resultado / observaciones<textarea value={form.resultado} onChange={e=>setForm({...form,resultado:e.target.value})} rows="2" style={{display:'block',width:'100%',padding:10,marginTop:5}}/></label>
 </div><button className="btn btn-primary" type="submit" style={{marginTop:14}}>Guardar control</button></form>}
 <div className="card" style={{padding:18,marginBottom:20}}><h3><CalendarCheck size={18} style={{display:'inline',marginRight:6}}/><span id="t-controles">Historial de controles{filtro.hay?` de ${filtro.nombre}`:''}</span></h3>{controlesV.length===0?<EstadoVacio compacto icono="fa-stethoscope" titulo="Aún no hay controles médicos" descripcion="Cuando se registre un control, aparecerá aquí con la aptitud del deportista."/>:<div className="table-wrapper" tabIndex={0} role="region" aria-labelledby="t-controles"><table><thead><tr><th>Deportista</th><th>Fecha</th><th>Tipo</th><th>Aptitud</th><th>Próximo control</th><th>Restricciones</th><th>Atendió</th></tr></thead><tbody>{controlesV.map(c=><tr key={c.id}><td>{c.jugador_nombre ? nombreConDorsal(c.jugador_nombre, c.jugador_dorsal) : 'Mi perfil'}</td><td>{String(c.fecha||'').slice(0,10)}</td><td>{c.tipo}</td><td>{({'apto':'Apto','apto_restricciones':'Apto con restricciones','no_apto_temporal':'No apto temporalmente','pendiente':'Pendiente'})[c.aptitud]||c.aptitud}</td><td>{c.proxima_fecha?String(c.proxima_fecha).slice(0,10):'—'}</td><td>{c.restricciones||'—'}</td><td>{c.atendio||'—'}</td></tr>)}</tbody></table></div>}</div>
 <div className="card" style={{padding:18}}><h3><Bell size={18} style={{display:'inline',marginRight:6}}/>Mis notificaciones</h3>{notificaciones.length===0?<EstadoVacio compacto icono="fa-bell" titulo="No tienes notificaciones" descripcion="Aquí llegan los avisos de controles y cambios de aptitud."/>:notificaciones.map(n=><div key={n.id} style={{padding:'12px 0',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',gap:12}}><div><strong>{n.titulo}</strong><p style={{margin:'4px 0',color:'var(--text-secondary)'}}>{n.mensaje}</p><small>{String(n.created_at||'').slice(0,16).replace('T',' ')}</small></div>{!n.leida&&<button className="btn btn-secondary" onClick={()=>read(n.id)}>Marcar leída</button>}</div>)}</div>
 </div>
}

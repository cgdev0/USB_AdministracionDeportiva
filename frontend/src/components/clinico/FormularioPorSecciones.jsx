// Formulario largo por secciones (v2.8, T1.1 del plan de historia clínica). La valoración fisioterapéutica (Fase 3)
// tiene unas 9 secciones; según la pantalla se recorre así:
//   celular              → una sección por pantalla, "Paso 3 de 9" con barra de avance y Anterior / Siguiente
//   tableta vertical     → índice desplegable arriba y la sección a todo el ancho
//   tableta horizontal y computador → índice fijo a la izquierda con el estado de cada sección
// Cada sección dice si está completa, no evaluada o pendiente. Al cambiar de sección, el foco va a su título
// (para teclado y lectores de pantalla) y la página vuelve arriba.
import { useEffect, useRef } from 'react'
import usarModoPantalla from './usarModoPantalla'
import BarraAcciones from './BarraAcciones'

const ESTADO = {
  completa: { icono: 'fa-circle-check', texto: 'completa' },
  no_evaluado: { icono: 'fa-circle-minus', texto: 'no evaluada' },
  pendiente: { icono: 'fa-circle', texto: 'pendiente' },
}

export default function FormularioPorSecciones({ id = 'fps', secciones, actual, onCambiar, etiqueta = 'Secciones', acciones = null }) {
  const modo = usarModoPantalla()
  const titulo = useRef(null)
  const primeraVez = useRef(true)
  const i = Math.max(0, secciones.findIndex(s => s.id === actual))
  const seccion = secciones[i]
  const total = secciones.length

  useEffect(() => {
    if (primeraVez.current) { primeraVez.current = false; return }
    titulo.current?.focus({ preventScroll: true })
    titulo.current?.scrollIntoView?.({ block: 'start', behavior: 'auto' })
  }, [actual])

  const ir = (k) => { if (k >= 0 && k < total) onCambiar(secciones[k].id) }
  const estadoDe = (s) => ESTADO[s.estado] || ESTADO.pendiente

  return (
    <div className={`fps fps-${modo}`}>
      {modo === 'amplio' && (
        <nav className="fps-indice" aria-label={etiqueta}>
          <ol>
            {secciones.map((s, k) => (
              <li key={s.id}>
                <button type="button" onClick={() => ir(k)} aria-current={k === i ? 'step' : undefined} className={`fps-item estado-${s.estado || 'pendiente'}`}>
                  <i className={`fa-${s.estado === 'pendiente' || !s.estado ? 'regular' : 'solid'} ${estadoDe(s).icono}`} aria-hidden="true"></i>
                  <span>{k + 1}. {s.titulo}</span>
                  <span className="sr-only"> ({estadoDe(s).texto})</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="fps-cuerpo">
        {modo === 'tableta' && (
          <div className="form-group fps-selector">
            <label htmlFor={`${id}-seccion`}>{etiqueta}</label>
            <select id={`${id}-seccion`} value={seccion.id} onChange={e => onCambiar(e.target.value)}>
              {secciones.map((s, k) => <option key={s.id} value={s.id}>{k + 1}. {s.titulo} ({estadoDe(s).texto})</option>)}
            </select>
          </div>
        )}
        {modo === 'celular' && (
          <div className="fps-pasos">
            <span>Paso {i + 1} de {total}</span>
            <div className="fps-barra" role="progressbar" aria-label="Avance del formulario" aria-valuemin={1} aria-valuemax={total} aria-valuenow={i + 1}>
              <span style={{ width: `${((i + 1) / total) * 100}%` }}></span>
            </div>
          </div>
        )}

        <section className="fps-seccion" aria-labelledby={`${id}-titulo`}>
          <h3 id={`${id}-titulo`} ref={titulo} tabIndex={-1}>{seccion.titulo}</h3>
          {seccion.contenido}
        </section>

        <BarraAcciones>
          {/* En el celular, Anterior y Siguiente son flechas (el texto queda para lectores de pantalla): una sola fila */}
          <button type="button" className="btn btn-secondary fps-nav" onClick={() => ir(i - 1)} disabled={i === 0}>
            <i className="fa-solid fa-arrow-left" aria-hidden="true"></i> <span className="texto-pc">Anterior</span>
          </button>
          {acciones}
          <button type="button" className="btn btn-secondary fps-nav" onClick={() => ir(i + 1)} disabled={i === total - 1}>
            <span className="texto-pc">Siguiente</span> <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
          </button>
        </BarraAcciones>
      </div>
    </div>
  )
}

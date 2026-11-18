// Opciones como botones grandes (v2.8, T1.1 del plan de historia clínica), en lugar de listas desplegables:
// Normal / Alterado, Positivo / Negativo / No concluyente, Derecho / Izquierdo / Bilateral…
// Se tocan con el dedo (48 px de alto) y se leen de un vistazo. Tocar la opción elegida la quita (si se permite).
// `opciones`: [[valor, etiqueta, { icono, tono }]]; `tono`: 'ok' (verde), 'alerta' (rojo) o 'aviso' (naranja).
export default function OpcionesBoton({ id, etiqueta, opciones, valor, onCambio, permitirVacio = true, ayuda }) {
  return (
    <div className="form-group">
      <span className="etiqueta-campo" id={`${id}-etiqueta`}>{etiqueta}</span>
      <div className="opciones-boton" role="group" aria-labelledby={`${id}-etiqueta`} aria-describedby={ayuda ? `${id}-ayuda` : undefined}>
        {opciones.map(([v, texto, extra = {}]) => (
          <button key={v} type="button" aria-pressed={valor === v} className={`opcion-boton${extra.tono ? ` tono-${extra.tono}` : ''}`}
            onClick={() => onCambio(valor === v && permitirVacio ? '' : v)}>
            {extra.icono && <i className={`fa-solid ${extra.icono}`} aria-hidden="true"></i>}
            {texto}
          </button>
        ))}
      </div>
      {ayuda && <small id={`${id}-ayuda`} className="ayuda-campo">{ayuda}</small>}
    </div>
  )
}

// Lado del cuerpo, para pruebas semiológicas, longitudes y hallazgos posturales
export const LADOS = [['derecho', 'Derecho'], ['izquierdo', 'Izquierdo'], ['bilateral', 'Bilateral']]
export function SelectorLado({ id, etiqueta = 'Lado', valor, onCambio, conBilateral = true }) {
  return <OpcionesBoton id={id} etiqueta={etiqueta} valor={valor} onCambio={onCambio}
    opciones={conBilateral ? LADOS : LADOS.slice(0, 2)} />
}

// Barra de acciones fija (v2.8, T1.1). Guardar, siguiente o cerrar siempre a la mano, sin desplazarse hasta el final:
// en celular y tableta queda pegada abajo, encima del menú inferior; en computador, al final del formulario visible.
export default function BarraAcciones({ children, etiqueta = 'Acciones del formulario' }) {
  return <div className="barra-acciones" role="group" aria-label={etiqueta}>{children}</div>
}

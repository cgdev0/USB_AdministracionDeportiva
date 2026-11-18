// Sección clínica opcional (v2.8, T1.1 del plan de historia clínica). El docente pidió que nada sea obligatorio
// salvo la identificación, pero que quede registrado lo que no se evaluó: el interruptor "No evaluado" oculta los
// campos y deja constancia en la valoración (se distingue "no evaluado" de "olvidado").
export default function SeccionOpcional({ id, titulo, noEvaluado = false, onNoEvaluado, ayuda, children }) {
  return (
    <section className={`seccion-opcional${noEvaluado ? ' no-evaluada' : ''}`} aria-labelledby={`${id}-titulo`}>
      <header className="seccion-opcional-cabecera">
        <h4 id={`${id}-titulo`}>{titulo}</h4>
        <label className="interruptor" htmlFor={`${id}-no-evaluado`}>
          <input id={`${id}-no-evaluado`} type="checkbox" role="switch" checked={noEvaluado} onChange={e => onNoEvaluado?.(e.target.checked)} />
          <span className="interruptor-pista" aria-hidden="true"></span>
          <span>No evaluado</span>
        </label>
      </header>
      {ayuda && !noEvaluado && <p className="ayuda-campo">{ayuda}</p>}
      {noEvaluado
        ? <p className="ayuda-campo seccion-opcional-nota"><i className="fa-solid fa-circle-minus" aria-hidden="true"></i> Quedará registrada como no evaluada en esta valoración.</p>
        : children}
    </section>
  )
}
